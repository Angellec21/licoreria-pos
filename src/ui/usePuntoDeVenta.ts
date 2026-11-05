import { useCallback, useEffect, useRef, useState } from 'react';
import { crearInventarioDeEjemplo } from '../data/catalogo.ts';
import { Caja } from '../domain/caja.ts';
import type { Inventario } from '../domain/inventario.ts';
import {
  type Almacen,
  CLAVE_ESTADO,
  borrarEstado,
  cargarEstado,
  deserializar,
  guardarEstado,
  serializar,
} from '../domain/persistencia.ts';

export interface EstadoGuardadoUI {
  /** `memoria`: el navegador no permite guardar (modo privado o bloqueado). */
  tipo: 'guardado' | 'error' | 'memoria';
  /** Momento del último guardado correcto (ISO). */
  hora?: string;
  mensaje?: string;
}

export interface PuntoDeVenta {
  inventario: Inventario;
  caja: Caja;
  /** Cambia cada vez que se modifica el estado, para que React vuelva a dibujar. */
  version: number;
  /**
   * Ejecuta una operación del negocio. Si lanza error devuelve el mensaje
   * en vez de romper la pantalla; si sale bien, guarda y refresca la interfaz.
   */
  ejecutar: <T>(operacion: () => T) => { ok: true; valor: T } | { ok: false; error: string };
  /** Cambia cuando se reemplaza todo el estado (respaldo, restablecer u otra pestaña). */
  generacion: number;
  guardado: EstadoGuardadoUI;
  /** Aviso al iniciar (p. ej. guardado dañado que se apartó). */
  avisoCarga?: string;
  /** JSON con todo el estado, para descargar como respaldo. */
  exportarRespaldo: () => string;
  /** Reemplaza todo por un respaldo descargado antes. Lanza error si el archivo no sirve. */
  importarRespaldo: (texto: string) => void;
  /** Borra lo guardado y vuelve al catálogo de ejemplo. */
  restablecer: () => void;
}

interface Estado {
  inventario: Inventario;
  caja: Caja;
}

function ejemplo(): Estado {
  const inventario = crearInventarioDeEjemplo();
  return { inventario, caja: new Caja(inventario) };
}

/** `localStorage` si el navegador lo permite; si no, `undefined` (se trabaja solo en memoria). */
function almacenDelNavegador(): Almacen | undefined {
  try {
    const s = window.localStorage;
    s.getItem(CLAVE_ESTADO);
    return s;
  } catch {
    return undefined;
  }
}

function cargarInicial(almacen: Almacen | undefined): { estado: Estado; aviso?: string; hora?: string } {
  if (!almacen) return { estado: ejemplo() };
  const r = cargarEstado(almacen);
  if (r.tipo === 'ok') return { estado: r.estado, hora: r.estado.guardado };
  if (r.tipo === 'danado') {
    return {
      estado: ejemplo(),
      aviso: `No se pudieron recuperar los datos guardados (${r.error}). Se apartó una copia y se cargó el catálogo de ejemplo.`,
    };
  }
  return { estado: ejemplo() };
}

/**
 * Estado del punto de venta: inventario y caja que se guardan en el
 * navegador después de cada operación y se recuperan al recargar la página.
 */
export function usePuntoDeVenta(): PuntoDeVenta {
  const [almacen] = useState(almacenDelNavegador);
  const [inicial] = useState(() => cargarInicial(almacen));
  const [estado, setEstado] = useState<Estado>(inicial.estado);
  const [version, setVersion] = useState(0);
  const [generacion, setGeneracion] = useState(0);
  const [avisoCarga, setAvisoCarga] = useState(inicial.aviso);
  const [guardado, setGuardado] = useState<EstadoGuardadoUI>(
    almacen ? { tipo: 'guardado', hora: inicial.hora } : { tipo: 'memoria' },
  );
  // Referencia al estado vigente para las funciones memorizadas.
  const actual = useRef(estado);
  useEffect(() => {
    actual.current = estado;
  }, [estado]);

  const guardar = useCallback(
    (e: Estado) => {
      if (!almacen) return;
      const ahora = new Date();
      const error = guardarEstado(almacen, e.inventario, e.caja, ahora);
      setGuardado(error ? { tipo: 'error', mensaje: error } : { tipo: 'guardado', hora: ahora.toISOString() });
    },
    [almacen],
  );

  const reemplazar = useCallback(
    (e: Estado) => {
      actual.current = e;
      setEstado(e);
      setVersion((v) => v + 1);
      setGeneracion((g) => g + 1);
      guardar(e);
    },
    [guardar],
  );

  const ejecutar = useCallback(
    <T,>(operacion: () => T) => {
      try {
        const valor = operacion();
        guardar(actual.current);
        setVersion((v) => v + 1);
        return { ok: true as const, valor };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
      }
    },
    [guardar],
  );

  // Si otra pestaña del mismo navegador guarda cambios, se recargan aquí
  // para que dos pestañas no se pisen el stock.
  useEffect(() => {
    if (!almacen) return;
    const alCambiar = (ev: StorageEvent) => {
      if (ev.key !== CLAVE_ESTADO || ev.newValue === null) return;
      try {
        const r = deserializar(ev.newValue);
        const nuevo = { inventario: r.inventario, caja: r.caja };
        actual.current = nuevo;
        setEstado(nuevo);
        setVersion((v) => v + 1);
        setGeneracion((g) => g + 1);
        setGuardado({ tipo: 'guardado', hora: r.guardado });
      } catch {
        // Un guardado inválido de otra pestaña no reemplaza lo que hay aquí.
      }
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, [almacen]);

  const exportarRespaldo = useCallback(
    () => serializar(actual.current.inventario, actual.current.caja),
    [],
  );

  const importarRespaldo = useCallback(
    (texto: string) => {
      const r = deserializar(texto);
      setAvisoCarga(undefined);
      reemplazar({ inventario: r.inventario, caja: r.caja });
    },
    [reemplazar],
  );

  const restablecer = useCallback(() => {
    if (almacen) borrarEstado(almacen);
    setAvisoCarga(undefined);
    reemplazar(ejemplo());
  }, [almacen, reemplazar]);

  return {
    inventario: estado.inventario,
    caja: estado.caja,
    version,
    generacion,
    ejecutar,
    guardado,
    avisoCarga,
    exportarRespaldo,
    importarRespaldo,
    restablecer,
  };
}
