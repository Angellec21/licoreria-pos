import { Caja, type ItemVenta, type MetodoPago } from '../domain/caja.ts';
import { type Centavos, bs } from '../domain/dinero.ts';
import { type Categoria, Inventario, type Presentacion } from '../domain/inventario.ts';
import { DESFASE_BOLIVIA_MIN, fechaHoraLocal } from '../domain/reporte.ts';
import { catalogoEjemplo } from './catalogo.ts';

/**
 * Historial de ejemplo de una licorería de barrio en Santa Cruz: una semana
 * de ventas en dos turnos por día, con compras al distribuidor, anulaciones
 * y arqueos. Sirve para que el reporte del día y el inventario no arranquen
 * vacíos al probar el sistema.
 *
 * Todo se registra con las mismas operaciones que usa la caja real
 * (`ingresar`, `abrirTurno`, `vender`, `anularVenta`, `cerrarTurno`), así que
 * el stock final cuadra con las compras y las ventas. Es determinista: con la
 * misma fecha y semilla se obtiene exactamente el mismo historial.
 */
export interface OpcionesHistorial {
  /** Fecha de referencia; el historial termina el día anterior (hora de Bolivia). */
  hoy?: Date;
  /** Cantidad de días cerrados a generar (por defecto 7). */
  dias?: number;
  /** Semilla del generador pseudoaleatorio. */
  semilla?: number;
}

export interface HistorialEjemplo {
  inventario: Inventario;
  caja: Caja;
}

interface TurnoPlantilla {
  cajero: string;
  /** Hora local de apertura y de cierre (hora de Bolivia). */
  desde: number;
  hasta: number;
  montoInicial: Centavos;
}

const TURNOS: TurnoPlantilla[] = [
  { cajero: 'Carla Rojas', desde: 9, hasta: 16, montoInicial: bs(200) },
  { cajero: 'Jorge Suárez', desde: 16, hasta: 24, montoInicial: bs(300) },
];

/** Peso relativo de ventas por hora local: la licorería se mueve de noche. */
const PESO_HORA: Record<number, number> = {
  9: 1, 10: 1, 11: 2, 12: 3, 13: 3, 14: 2, 15: 2,
  16: 3, 17: 4, 18: 6, 19: 9, 20: 11, 21: 12, 22: 10, 23: 6,
};

/** Ventas por día según el día de la semana (0 = domingo). */
const VENTAS_POR_DIA = [30, 14, 16, 18, 24, 42, 50];

/** Qué tan seguido se lleva cada producto (de 13 en el catálogo). */
const POPULARIDAD: Record<string, number> = {
  'pacena-620': 30, 'huari-620': 12, 'pacena-lata': 16, 'casareal-negra': 8,
  'rujero-azul': 6, 'kohlberg-tinto': 6, 'campos-cabernet': 2, 'fernet-750': 5,
  'havana-3': 2, 'smirnoff-750': 3, 'jw-red': 2, 'coca-2l': 10, 'hielo-3kg': 8,
};

/** Distribuidor habitual por categoría. */
const PROVEEDOR: Record<Categoria, string> = {
  cerveza: 'Cervecería Boliviana Nacional',
  singani: 'Distribuidora Tarija Sur',
  vino: 'Distribuidora Tarija Sur',
  fernet: 'Importadora Oriente',
  ron: 'Importadora Oriente',
  vodka: 'Importadora Oriente',
  whisky: 'Importadora Oriente',
  gaseosa: 'Embol S.A.',
  otros: 'Hielos El Pozo',
};

const MOTIVOS_ANULACION = ['Error en el cobro', 'Cliente devolvió el producto', 'Producto registrado dos veces'];

/** Generador pseudoaleatorio pequeño (mulberry32), suficiente para datos de ejemplo. */
function crearAzar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function elegirPonderado<T>(azar: () => number, opciones: [T, number][]): T {
  const total = opciones.reduce((t, [, p]) => t + p, 0);
  let r = azar() * total;
  for (const [valor, peso] of opciones) {
    r -= peso;
    if (r < 0) return valor;
  }
  return opciones[opciones.length - 1]![0];
}

/** Instante UTC de una fecha local de Bolivia (AAAA-MM-DD) a cierta hora y minuto. */
function instanteLocal(fecha: string, hora: number, minuto: number): Date {
  const medianocheUtc = Date.parse(`${fecha}T00:00:00Z`);
  return new Date(medianocheUtc + (hora * 60 + minuto) * 60_000 - DESFASE_BOLIVIA_MIN * 60_000);
}

function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Monto con el que suele pagar el cliente en efectivo (billetes de Bs 10, 20, 50, 100, 200). */
function billeteRecibido(azar: () => number, total: Centavos): Centavos {
  if (azar() < 0.35) return total; // paga justo
  for (const billete of [10, 20, 50, 100, 200].map(bs)) {
    if (billete >= total) return billete;
  }
  return Math.ceil(total / bs(50)) * bs(50);
}

export function crearHistorialDeEjemplo(opciones: OpcionesHistorial = {}): HistorialEjemplo {
  const hoy = fechaHoraLocal((opciones.hoy ?? new Date()).toISOString()).fecha;
  const dias = opciones.dias ?? 7;
  const azar = crearAzar(opciones.semilla ?? 591);

  let ahora = instanteLocal(sumarDias(hoy, -dias), 8, 0);
  const reloj = () => ahora;
  const inventario = new Inventario(reloj);
  for (const p of catalogoEjemplo) inventario.agregar(p);
  const caja = new Caja(inventario, reloj);
  const productos = inventario.listar();
  let factura = 4100;

  for (let d = dias; d >= 1; d -= 1) {
    const fecha = sumarDias(hoy, -d);
    const diaSemana = new Date(`${fecha}T00:00:00Z`).getUTCDay();

    // 08:30 — llega el pedido al distribuidor para lo que quedó bajo el mínimo.
    ahora = instanteLocal(fecha, 8, 30);
    for (const s of inventario.sugerenciaDePedido()) {
      const p = inventario.obtener(s.productoId);
      factura += 1;
      inventario.ingresar(p.id, {
        cajas: s.cajas + (p.categoria === 'cerveza' && diaSemana >= 4 ? 2 : 0),
        proveedor: PROVEEDOR[p.categoria],
        documento: `F-${factura}`,
      });
    }

    // Horarios de las ventas del día, ordenados.
    const cantidad = Math.round((VENTAS_POR_DIA[diaSemana] ?? 20) * (0.85 + azar() * 0.3));
    const horas = Object.entries(PESO_HORA).map(([h, p]) => [Number(h), p] as [number, number]);
    const minutos = Array.from({ length: cantidad }, () => elegirPonderado(azar, horas) * 60 + Math.floor(azar() * 60))
      .sort((a, b) => a - b);

    for (const plantilla of TURNOS) {
      ahora = instanteLocal(fecha, plantilla.desde, 0);
      caja.abrirTurno(plantilla.cajero, plantilla.montoInicial);
      const delTurno = minutos.filter((m) => m >= plantilla.desde * 60 && m < plantilla.hasta * 60);
      const ventasTurno: string[] = [];

      for (const m of delTurno) {
        ahora = instanteLocal(fecha, Math.floor(m / 60), m % 60);
        const items = armarPedido(azar, inventario, productos.map((p) => p.id));
        if (items.length === 0) continue;
        const metodo = elegirPonderado<MetodoPago>(azar, [['efectivo', 60], ['qr', 32], ['tarjeta', 8]]);
        const total = items.reduce((t, i) => {
          const p = inventario.obtener(i.productoId);
          return t + (i.presentacion === 'caja' ? p.precioCaja : p.precioUnidad) * i.cantidad;
        }, 0);
        const venta = caja.vender(items, {
          metodo,
          ...(metodo === 'efectivo' && { recibido: billeteRecibido(azar, total) }),
        });
        ventasTurno.push(venta.id);
      }

      // De vez en cuando se anula una venta del turno (siempre con motivo).
      if (ventasTurno.length > 3 && azar() < 0.45) {
        const id = ventasTurno[Math.floor(azar() * ventasTurno.length)]!;
        const vendida = Date.parse(caja.todasLasVentas().find((v) => v.id === id)!.fecha);
        ahora = new Date(Math.min(vendida + 4 * 60_000, cierreDe(fecha, plantilla).getTime()));
        caja.anularVenta(id, MOTIVOS_ANULACION[Math.floor(azar() * MOTIVOS_ANULACION.length)] ?? 'Error en el cobro');
      }

      // Arqueo: casi siempre cuadra; a veces falta o sobra algo de cambio.
      ahora = cierreDe(fecha, plantilla);
      const esperado = caja.resumenTurno().efectivoEsperado;
      const diferencia = elegirPonderado(azar, [[0, 70], [-bs(10), 12], [-bs(5), 10], [bs(2), 8]]);
      caja.cerrarTurno(Math.max(0, esperado + diferencia));
    }
  }

  return { inventario, caja };
}

/** Hora de cierre del turno; el turno de la noche cierra a las 23:59 del mismo día. */
function cierreDe(fecha: string, t: TurnoPlantilla): Date {
  return t.hasta >= 24 ? instanteLocal(fecha, 23, 59) : instanteLocal(fecha, t.hasta, 0);
}

/** Un pedido típico: 1 a 3 productos, con más cerveza y alguna caja cerrada. */
function armarPedido(azar: () => number, inventario: Inventario, ids: string[]): ItemVenta[] {
  const lineas = 1 + (azar() < 0.45 ? 1 : 0) + (azar() < 0.15 ? 1 : 0);
  const pedido = new Map<string, number>();
  const items: ItemVenta[] = [];
  for (let i = 0; i < lineas; i += 1) {
    const id = elegirPonderado(azar, ids.map((x) => [x, POPULARIDAD[x] ?? 1] as [string, number]));
    if (items.some((it) => it.productoId === id)) continue;
    const p = inventario.obtener(id);
    let presentacion: Presentacion = 'unidad';
    let cantidad = 1;
    if (p.unidadesPorCaja > 1 && p.categoria === 'cerveza' && azar() < 0.3) {
      presentacion = 'caja';
    } else if (p.categoria === 'cerveza' || p.categoria === 'gaseosa' || p.categoria === 'otros') {
      cantidad = 1 + Math.floor(azar() * (p.categoria === 'cerveza' ? 6 : 2));
    }
    const unidades = (presentacion === 'caja' ? p.unidadesPorCaja : 1) * cantidad;
    // Si no alcanza el stock, el cliente se lleva otra cosa (no se fuerza la venta).
    if (p.stockUnidades - (pedido.get(id) ?? 0) < unidades) continue;
    pedido.set(id, (pedido.get(id) ?? 0) + unidades);
    items.push({ productoId: id, presentacion, cantidad });
  }
  return items;
}
