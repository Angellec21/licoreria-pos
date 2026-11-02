import { useCallback, useState } from 'react';
import { crearInventarioDeEjemplo } from '../data/catalogo.ts';
import { Caja } from '../domain/caja.ts';
import type { Inventario } from '../domain/inventario.ts';

export interface PuntoDeVenta {
  inventario: Inventario;
  caja: Caja;
  /** Cambia cada vez que se modifica el estado, para que React vuelva a dibujar. */
  version: number;
  /**
   * Ejecuta una operación del negocio. Si lanza error devuelve el mensaje
   * en vez de romper la pantalla; si sale bien, refresca la interfaz.
   */
  ejecutar: <T>(operacion: () => T) => { ok: true; valor: T } | { ok: false; error: string };
}

/** Estado del punto de venta: un inventario y una caja vivos durante la sesión. */
export function usePuntoDeVenta(): PuntoDeVenta {
  const [{ inventario, caja }] = useState(() => {
    const inv = crearInventarioDeEjemplo();
    return { inventario: inv, caja: new Caja(inv) };
  });
  const [version, setVersion] = useState(0);

  const ejecutar = useCallback(<T,>(operacion: () => T) => {
    try {
      const valor = operacion();
      setVersion((v) => v + 1);
      return { ok: true as const, valor };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  return { inventario, caja, version, ejecutar };
}
