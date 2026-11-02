import type { Centavos } from './dinero.ts';
import type { ItemVenta } from './caja.ts';
import { type Inventario, type Presentacion, type Producto, aUnidades, precioDe } from './inventario.ts';

/**
 * Carrito del mostrador. Es inmutable: cada operación devuelve un carrito
 * nuevo, así React detecta los cambios sin trucos y se puede deshacer fácil.
 * Los precios no se guardan en el carrito: se leen del inventario al
 * resumirlo, para cobrar siempre el precio vigente.
 */
export type Carrito = readonly ItemVenta[];

export const CARRITO_VACIO: Carrito = [];

export interface LineaCarrito extends ItemVenta {
  nombre: string;
  unidadesPorCaja: number;
  precioUnitario: Centavos;
  subtotal: Centavos;
  /** Unidades que saldrían del stock con esta línea. */
  unidades: number;
}

export interface ResumenCarrito {
  lineas: LineaCarrito[];
  total: Centavos;
  totalUnidades: number;
  /** Productos cuyo pedido (sumando líneas) supera el stock disponible. */
  sinStock: { productoId: string; nombre: string; pedido: number; disponible: number }[];
}

export interface Escaneo {
  codigo: string;
  cantidad: number;
  presentacion: Presentacion;
}

function mismaLinea(a: ItemVenta, productoId: string, presentacion: Presentacion): boolean {
  return a.productoId === productoId && a.presentacion === presentacion;
}

function validarCantidad(cantidad: number): void {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error('La cantidad debe ser un entero mayor o igual a 1');
  }
}

/** Agrega un producto; si ya está con la misma presentación suma la cantidad. */
export function agregarAlCarrito(
  carrito: Carrito,
  productoId: string,
  presentacion: Presentacion = 'unidad',
  cantidad = 1,
): Carrito {
  validarCantidad(cantidad);
  const existe = carrito.some((l) => mismaLinea(l, productoId, presentacion));
  if (!existe) return [...carrito, { productoId, presentacion, cantidad }];
  return carrito.map((l) =>
    mismaLinea(l, productoId, presentacion) ? { ...l, cantidad: l.cantidad + cantidad } : l,
  );
}

/** Fija la cantidad de una línea; con 0 la quita. */
export function cambiarCantidad(
  carrito: Carrito,
  productoId: string,
  presentacion: Presentacion,
  cantidad: number,
): Carrito {
  if (cantidad === 0) return quitarDelCarrito(carrito, productoId, presentacion);
  validarCantidad(cantidad);
  if (!carrito.some((l) => mismaLinea(l, productoId, presentacion))) {
    throw new Error('El producto no está en el carrito');
  }
  return carrito.map((l) => (mismaLinea(l, productoId, presentacion) ? { ...l, cantidad } : l));
}

export function quitarDelCarrito(carrito: Carrito, productoId: string, presentacion: Presentacion): Carrito {
  return carrito.filter((l) => !mismaLinea(l, productoId, presentacion));
}

/**
 * Cambia una línea de unidad a caja o al revés (el cliente decide llevar la
 * caja cerrada). Si ya existía la otra presentación, las cantidades se juntan.
 */
export function alternarPresentacion(carrito: Carrito, productoId: string, actual: Presentacion): Carrito {
  const linea = carrito.find((l) => mismaLinea(l, productoId, actual));
  if (!linea) throw new Error('El producto no está en el carrito');
  const otra: Presentacion = actual === 'unidad' ? 'caja' : 'unidad';
  return agregarAlCarrito(quitarDelCarrito(carrito, productoId, actual), productoId, otra, linea.cantidad);
}

/**
 * Interpreta lo que llega del lector de código de barras o del teclado:
 * - `7771609000124`      → 1 unidad
 * - `3*7771609000124`    → 3 unidades (también `3x`)
 * - `c*7771609000124`    → 1 caja
 * - `2c*7771609000124`   → 2 cajas
 */
export function interpretarEscaneo(texto: string): Escaneo {
  const limpio = texto.trim();
  const m = /^(?:(\d+)?\s*([cC])?\s*[*xX]\s*)?(\S+)$/.exec(limpio);
  if (!limpio || !m || !m[3]) throw new Error('Escaneo vacío o inválido');
  const [, cant, caja, codigo] = m;
  const cantidad = cant ? Number(cant) : 1;
  validarCantidad(cantidad);
  return { codigo, cantidad, presentacion: caja ? 'caja' : 'unidad' };
}

/** Escanea un código y lo agrega al carrito. Lanza error si no está registrado. */
export function escanear(
  carrito: Carrito,
  inventario: Inventario,
  texto: string,
): { carrito: Carrito; producto: Producto; escaneo: Escaneo } {
  const escaneo = interpretarEscaneo(texto);
  const producto = inventario.buscarPorCodigo(escaneo.codigo);
  if (!producto || !producto.activo) {
    throw new Error(`Código ${escaneo.codigo} no registrado`);
  }
  return {
    carrito: agregarAlCarrito(carrito, producto.id, escaneo.presentacion, escaneo.cantidad),
    producto,
    escaneo,
  };
}

/** Calcula precios, total y faltantes de stock con los datos vigentes del inventario. */
export function resumirCarrito(carrito: Carrito, inventario: Inventario): ResumenCarrito {
  const pedido = new Map<string, number>();
  const lineas: LineaCarrito[] = carrito.map((item) => {
    const p = inventario.obtener(item.productoId);
    const unidades = aUnidades(p, item.cantidad, item.presentacion);
    pedido.set(p.id, (pedido.get(p.id) ?? 0) + unidades);
    const precioUnitario = precioDe(p, item.presentacion);
    return {
      ...item,
      nombre: p.nombre,
      unidadesPorCaja: p.unidadesPorCaja,
      precioUnitario,
      subtotal: precioUnitario * item.cantidad,
      unidades,
    };
  });

  const sinStock: ResumenCarrito['sinStock'] = [];
  for (const [id, unidades] of pedido) {
    const p = inventario.obtener(id);
    if (unidades > p.stockUnidades) {
      sinStock.push({ productoId: id, nombre: p.nombre, pedido: unidades, disponible: p.stockUnidades });
    }
  }

  return {
    lineas,
    total: lineas.reduce((t, l) => t + l.subtotal, 0),
    totalUnidades: lineas.reduce((t, l) => t + l.unidades, 0),
    sinStock,
  };
}

/**
 * Sugerencia de ahorro: si el cliente lleva sueltas una caja completa o más,
 * indica cuánto pagaría llevándolas como caja cerrada.
 */
export function sugerenciasDeCaja(
  carrito: Carrito,
  inventario: Inventario,
): { productoId: string; nombre: string; cajas: number; ahorro: Centavos }[] {
  return carrito
    .filter((l) => l.presentacion === 'unidad')
    .flatMap((l) => {
      const p = inventario.obtener(l.productoId);
      if (p.unidadesPorCaja < 2) return [];
      const cajas = Math.floor(l.cantidad / p.unidadesPorCaja);
      const ahorro = cajas * (p.precioUnidad * p.unidadesPorCaja - p.precioCaja);
      return cajas > 0 && ahorro > 0 ? [{ productoId: p.id, nombre: p.nombre, cajas, ahorro }] : [];
    });
}

/**
 * Aplica la sugerencia de ahorro: las unidades sueltas que completan cajas
 * pasan a cajas cerradas y el resto queda suelto (13 latas → 2 packs + 1 lata).
 */
export function convertirACajas(carrito: Carrito, inventario: Inventario, productoId: string): Carrito {
  const linea = carrito.find((l) => mismaLinea(l, productoId, 'unidad'));
  if (!linea) throw new Error('El producto no está en el carrito como unidad');
  const { unidadesPorCaja } = inventario.obtener(productoId);
  const cajas = Math.floor(linea.cantidad / unidadesPorCaja);
  if (unidadesPorCaja < 2 || cajas === 0) throw new Error('No alcanza para una caja completa');
  const sueltas = linea.cantidad - cajas * unidadesPorCaja;
  const sinUnidades = quitarDelCarrito(carrito, productoId, 'unidad');
  const conCajas = agregarAlCarrito(sinUnidades, productoId, 'caja', cajas);
  return sueltas > 0 ? agregarAlCarrito(conCajas, productoId, 'unidad', sueltas) : conCajas;
}
