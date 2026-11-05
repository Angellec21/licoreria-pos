import { Caja, type EstadoCaja, type Reloj } from './caja.ts';
import { Inventario, type EstadoInventario } from './inventario.ts';

/**
 * Guardado del punto de venta en el navegador (u otro almacén de texto).
 *
 * El estado se guarda como JSON con un número de esquema: si en una versión
 * futura cambia el formato, se puede migrar en vez de perder los datos.
 */
export const ESQUEMA_ACTUAL = 1;
export const CLAVE_ESTADO = 'licoreria-pos:estado';
/** Copia de un guardado que no se pudo leer, para no perderlo. */
export const CLAVE_RESPALDO_DANADO = 'licoreria-pos:estado-danado';

/** Lo mínimo que se necesita de `localStorage`; en las pruebas se usa uno en memoria. */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

export interface EstadoGuardado {
  esquema: number;
  /** Momento del guardado (ISO), para mostrar "guardado a las…". */
  guardado: string;
  inventario: EstadoInventario;
  caja: EstadoCaja;
}

export interface PuntoDeVentaRestaurado {
  inventario: Inventario;
  caja: Caja;
  guardado: string;
}

export function serializar(inventario: Inventario, caja: Caja, ahora: Date = new Date()): string {
  const estado: EstadoGuardado = {
    esquema: ESQUEMA_ACTUAL,
    guardado: ahora.toISOString(),
    inventario: inventario.exportar(),
    caja: caja.exportar(),
  };
  return JSON.stringify(estado);
}

/** Lee un guardado (o un respaldo descargado). Lanza un error claro si no sirve. */
export function deserializar(texto: string, reloj?: Reloj): PuntoDeVentaRestaurado {
  let datos: Partial<EstadoGuardado>;
  try {
    datos = JSON.parse(texto) as Partial<EstadoGuardado>;
  } catch {
    throw new Error('El archivo guardado no es un JSON válido');
  }
  if (!datos || typeof datos !== 'object') throw new Error('El archivo guardado está vacío');
  if (datos.esquema !== ESQUEMA_ACTUAL) {
    throw new Error(`Versión de datos no compatible (${String(datos.esquema)}); se esperaba ${ESQUEMA_ACTUAL}`);
  }
  const inventario = Inventario.restaurar(datos.inventario as EstadoInventario, reloj);
  const caja = Caja.restaurar(inventario, datos.caja as EstadoCaja, reloj);
  return { inventario, caja, guardado: String(datos.guardado ?? '') };
}

/** Guarda todo el estado. Devuelve un mensaje de error si el almacén lo rechaza (lleno o bloqueado). */
export function guardarEstado(almacen: Almacen, inventario: Inventario, caja: Caja, ahora?: Date): string | undefined {
  try {
    almacen.setItem(CLAVE_ESTADO, serializar(inventario, caja, ahora));
    return undefined;
  } catch (e) {
    return `No se pudo guardar en este navegador: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export type ResultadoCarga =
  | { tipo: 'vacio' }
  | { tipo: 'ok'; estado: PuntoDeVentaRestaurado }
  | { tipo: 'danado'; error: string };

/**
 * Carga el estado guardado. Si está dañado no lo borra: lo copia a
 * `CLAVE_RESPALDO_DANADO` para poder recuperarlo a mano y avisa del error.
 */
export function cargarEstado(almacen: Almacen, reloj?: Reloj): ResultadoCarga {
  let texto: string | null;
  try {
    texto = almacen.getItem(CLAVE_ESTADO);
  } catch (e) {
    return { tipo: 'danado', error: `No se pudo leer el guardado: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (texto === null) return { tipo: 'vacio' };
  try {
    return { tipo: 'ok', estado: deserializar(texto, reloj) };
  } catch (e) {
    try {
      almacen.setItem(CLAVE_RESPALDO_DANADO, texto);
    } catch {
      // Si ni siquiera se puede copiar, el original sigue en su clave.
    }
    return { tipo: 'danado', error: e instanceof Error ? e.message : String(e) };
  }
}

export function borrarEstado(almacen: Almacen): void {
  almacen.removeItem(CLAVE_ESTADO);
}

/** Almacén en memoria, útil para pruebas o cuando el navegador bloquea `localStorage`. */
export function almacenEnMemoria(inicial: Record<string, string> = {}): Almacen & { datos: Map<string, string> } {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (c) => datos.get(c) ?? null,
    setItem: (c, v) => void datos.set(c, v),
    removeItem: (c) => void datos.delete(c),
  };
}
