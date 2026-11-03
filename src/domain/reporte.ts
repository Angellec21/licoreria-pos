import type { MetodoPago, Venta } from './caja.ts';
import type { Centavos } from './dinero.ts';
import type { Categoria, Inventario } from './inventario.ts';

/**
 * Bolivia usa UTC−4 todo el año (sin horario de verano), así que el día
 * comercial se calcula con un desfase fijo y no depende de la zona horaria
 * del navegador o del servidor de CI.
 */
export const DESFASE_BOLIVIA_MIN = -4 * 60;

/** Fecha local (AAAA-MM-DD) y hora (0–23) de un instante en hora de Bolivia. */
export function fechaHoraLocal(iso: string, desfaseMin = DESFASE_BOLIVIA_MIN): { fecha: string; hora: number } {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Fecha inválida: ${iso}`);
  const local = new Date(ms + desfaseMin * 60_000);
  return { fecha: local.toISOString().slice(0, 10), hora: local.getUTCHours() };
}

export interface VentasPorHora {
  hora: number;
  cantidad: number;
  total: Centavos;
}

export interface ProductoVendido {
  productoId: string;
  nombre: string;
  unidades: number;
  ingresos: Centavos;
  margen: Centavos;
}

export interface ResumenCategoria {
  categoria: Categoria;
  unidades: number;
  ingresos: Centavos;
  costo: Centavos;
  margen: Centavos;
  /** Margen sobre la venta, en porcentaje con un decimal. */
  margenPorcentaje: number;
}

export interface ResumenCajero {
  cajero: string;
  cantidadVentas: number;
  total: Centavos;
}

export interface ReporteDiario {
  fecha: string;
  cantidadVentas: number;
  cantidadAnuladas: number;
  montoAnulado: Centavos;
  total: Centavos;
  costo: Centavos;
  margen: Centavos;
  margenPorcentaje: number;
  ticketPromedio: Centavos;
  porMetodo: Record<MetodoPago, Centavos>;
  /** Solo las horas con ventas, ordenadas de la más temprana a la más tardía. */
  porHora: VentasPorHora[];
  horaPico?: VentasPorHora;
  masVendidos: ProductoVendido[];
  porCategoria: ResumenCategoria[];
  porCajero: ResumenCajero[];
  /** Productos en o bajo su stock mínimo al momento del reporte. */
  porReponer: number;
}

export interface OpcionesReporte {
  /** Cuántos productos mostrar en el ranking de más vendidos. */
  limiteMasVendidos?: number;
  desfaseMin?: number;
}

function porcentaje(parte: Centavos, total: Centavos): number {
  return total === 0 ? 0 : Math.round((parte / total) * 1000) / 10;
}

/** Fechas (AAAA-MM-DD, hora de Bolivia) en las que hubo ventas, de la más reciente a la más antigua. */
export function fechasConVentas(ventas: Venta[], desfaseMin = DESFASE_BOLIVIA_MIN): string[] {
  const fechas = new Set(ventas.map((v) => fechaHoraLocal(v.fecha, desfaseMin).fecha));
  return [...fechas].sort().reverse();
}

/**
 * Reporte del día para el dueño: cuánto se vendió, cuánto se ganó,
 * a qué hora se mueve más la tienda, qué productos y categorías dejan
 * más margen y cuánto vendió cada cajero. Las ventas anuladas no suman,
 * pero se informan aparte para controlar anulaciones sospechosas.
 */
export function reporteDiario(
  ventas: Venta[],
  inventario: Inventario,
  fecha: string,
  opciones: OpcionesReporte = {},
): ReporteDiario {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('La fecha debe tener el formato AAAA-MM-DD');
  const desfase = opciones.desfaseMin ?? DESFASE_BOLIVIA_MIN;
  const limite = opciones.limiteMasVendidos ?? 5;

  const delDia = ventas
    .map((v) => ({ v, ...fechaHoraLocal(v.fecha, desfase) }))
    .filter((x) => x.fecha === fecha);
  const validas = delDia.filter((x) => !x.v.anulada);
  const anuladas = delDia.filter((x) => x.v.anulada);

  const porMetodo: Record<MetodoPago, Centavos> = { efectivo: 0, qr: 0, tarjeta: 0 };
  const horas = new Map<number, VentasPorHora>();
  const productos = new Map<string, ProductoVendido>();
  const categorias = new Map<Categoria, ResumenCategoria>();
  const cajeros = new Map<string, ResumenCajero>();
  let total = 0;
  let costo = 0;

  for (const { v, hora } of validas) {
    total += v.total;
    porMetodo[v.metodoPago] += v.total;

    const h = horas.get(hora) ?? { hora, cantidad: 0, total: 0 };
    h.cantidad += 1;
    h.total += v.total;
    horas.set(hora, h);

    const c = cajeros.get(v.cajero) ?? { cajero: v.cajero, cantidadVentas: 0, total: 0 };
    c.cantidadVentas += 1;
    c.total += v.total;
    cajeros.set(v.cajero, c);

    for (const l of v.lineas) {
      costo += l.costo;
      const p = productos.get(l.productoId) ?? {
        productoId: l.productoId,
        nombre: l.nombre,
        unidades: 0,
        ingresos: 0,
        margen: 0,
      };
      p.unidades += l.unidades;
      p.ingresos += l.subtotal;
      p.margen += l.subtotal - l.costo;
      productos.set(l.productoId, p);

      const categoria = inventario.obtener(l.productoId).categoria;
      const cat = categorias.get(categoria) ?? {
        categoria,
        unidades: 0,
        ingresos: 0,
        costo: 0,
        margen: 0,
        margenPorcentaje: 0,
      };
      cat.unidades += l.unidades;
      cat.ingresos += l.subtotal;
      cat.costo += l.costo;
      categorias.set(categoria, cat);
    }
  }

  const porHora = [...horas.values()].sort((a, b) => a.hora - b.hora);
  const horaPico = porHora.reduce<VentasPorHora | undefined>(
    (max, h) => (!max || h.total > max.total ? h : max),
    undefined,
  );

  return {
    fecha,
    cantidadVentas: validas.length,
    cantidadAnuladas: anuladas.length,
    montoAnulado: anuladas.reduce((t, x) => t + x.v.total, 0),
    total,
    costo,
    margen: total - costo,
    margenPorcentaje: porcentaje(total - costo, total),
    ticketPromedio: validas.length === 0 ? 0 : Math.round(total / validas.length),
    porMetodo,
    porHora,
    ...(horaPico && { horaPico }),
    masVendidos: [...productos.values()]
      .sort((a, b) => b.unidades - a.unidades || b.ingresos - a.ingresos)
      .slice(0, limite),
    porCategoria: [...categorias.values()]
      .map((c) => ({ ...c, margen: c.ingresos - c.costo, margenPorcentaje: porcentaje(c.ingresos - c.costo, c.ingresos) }))
      .sort((a, b) => b.margen - a.margen),
    porCajero: [...cajeros.values()].sort((a, b) => b.total - a.total),
    porReponer: inventario.alertasStockMinimo().length,
  };
}

/** Exporta el reporte en CSV (separador ";" para que Excel en español lo abra bien). */
export function reporteACsv(r: ReporteDiario): string {
  const bs = (c: Centavos) => (c / 100).toFixed(2).replace('.', ',');
  const filas: string[][] = [
    ['Reporte diario', r.fecha],
    ['Ventas', String(r.cantidadVentas)],
    ['Total (Bs)', bs(r.total)],
    ['Margen (Bs)', bs(r.margen)],
    ['Margen (%)', String(r.margenPorcentaje).replace('.', ',')],
    ['Ticket promedio (Bs)', bs(r.ticketPromedio)],
    ['Anuladas', String(r.cantidadAnuladas), bs(r.montoAnulado)],
    [],
    ['Producto', 'Unidades', 'Ingresos (Bs)', 'Margen (Bs)'],
    ...r.masVendidos.map((p) => [p.nombre, String(p.unidades), bs(p.ingresos), bs(p.margen)]),
    [],
    ['Categoría', 'Unidades', 'Ingresos (Bs)', 'Margen (Bs)', 'Margen (%)'],
    ...r.porCategoria.map((c) => [
      c.categoria,
      String(c.unidades),
      bs(c.ingresos),
      bs(c.margen),
      String(c.margenPorcentaje).replace('.', ','),
    ]),
    [],
    ['Hora', 'Ventas', 'Total (Bs)'],
    ...r.porHora.map((h) => [`${String(h.hora).padStart(2, '0')}:00`, String(h.cantidad), bs(h.total)]),
  ];
  const celda = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return filas.map((f) => f.map(celda).join(';')).join('\n') + '\n';
}
