import { beforeEach, describe, expect, it } from 'vitest';
import { crearInventarioDeEjemplo } from '../data/catalogo.ts';
import { Caja } from './caja.ts';
import { bs } from './dinero.ts';
import type { Inventario } from './inventario.ts';
import { fechaHoraLocal, fechasConVentas, reporteACsv, reporteDiario } from './reporte.ts';

describe('fechaHoraLocal', () => {
  it('convierte a la hora de Bolivia (UTC−4) aunque cambie el día en UTC', () => {
    expect(fechaHoraLocal('2026-11-03T02:30:00Z')).toEqual({ fecha: '2026-11-02', hora: 22 });
    expect(fechaHoraLocal('2026-11-03T13:05:00Z')).toEqual({ fecha: '2026-11-03', hora: 9 });
  });

  it('rechaza fechas inválidas', () => {
    expect(() => fechaHoraLocal('ayer')).toThrow(/Fecha inválida/);
  });
});

describe('Reporte diario del dueño', () => {
  let inv: Inventario;
  let caja: Caja;
  let ahora: Date;
  const a = (isoLocal: string) => {
    ahora = new Date(`${isoLocal}-04:00`);
  };

  beforeEach(() => {
    inv = crearInventarioDeEjemplo();
    ahora = new Date('2026-11-03T10:00:00-04:00');
    caja = new Caja(inv, () => ahora);

    // Turno de la mañana
    caja.abrirTurno('Rosa Vaca', bs(200));
    a('2026-11-03T10:15:00');
    caja.vender([{ productoId: 'pacena-620', presentacion: 'caja', cantidad: 1 }], { metodo: 'efectivo', recibido: bs(200) });
    a('2026-11-03T11:40:00');
    caja.vender([{ productoId: 'coca-2l', presentacion: 'unidad', cantidad: 2 }], { metodo: 'qr' });
    caja.cerrarTurno(bs(360));

    // Turno de la noche, con la hora pico
    a('2026-11-03T19:00:00');
    caja.abrirTurno('Luis Suárez', bs(300));
    a('2026-11-03T21:10:00');
    caja.vender(
      [
        { productoId: 'casareal-negra', presentacion: 'unidad', cantidad: 2 },
        { productoId: 'coca-2l', presentacion: 'unidad', cantidad: 3 },
        { productoId: 'hielo-3kg', presentacion: 'unidad', cantidad: 1 },
      ],
      { metodo: 'tarjeta' },
    );
    a('2026-11-03T21:45:00');
    const anulada = caja.vender([{ productoId: 'jw-red', presentacion: 'unidad', cantidad: 1 }], { metodo: 'efectivo' });
    caja.anularVenta(anulada.id, 'Cliente se arrepintió');
    a('2026-11-03T23:30:00');
    caja.vender([{ productoId: 'pacena-620', presentacion: 'unidad', cantidad: 4 }], { metodo: 'efectivo' });

    // Venta de madrugada: ya cuenta para el día siguiente
    a('2026-11-04T00:20:00');
    caja.vender([{ productoId: 'hielo-3kg', presentacion: 'unidad', cantidad: 2 }], { metodo: 'efectivo' });
  });

  it('totaliza ventas, margen y ticket promedio del día sin contar anuladas', () => {
    const r = reporteDiario(caja.todasLasVentas(), inv, '2026-11-03');
    // 160 + 26 + (160 + 39 + 10) + 60 = 455
    expect(r.cantidadVentas).toBe(4);
    expect(r.total).toBe(bs(455));
    // costo: 12×11,5 + 2×10 + (2×62 + 3×10 + 5) + 4×11,5 = 138 + 20 + 159 + 46 = 363
    expect(r.costo).toBe(bs(363));
    expect(r.margen).toBe(bs(92));
    expect(r.margenPorcentaje).toBe(20.2);
    expect(r.ticketPromedio).toBe(bs(113.75));
    expect(r.porMetodo).toEqual({ efectivo: bs(220), qr: bs(26), tarjeta: bs(209) });
  });

  it('informa las anulaciones aparte', () => {
    const r = reporteDiario(caja.todasLasVentas(), inv, '2026-11-03');
    expect(r.cantidadAnuladas).toBe(1);
    expect(r.montoAnulado).toBe(bs(185));
  });

  it('agrupa por hora y detecta la hora pico', () => {
    const r = reporteDiario(caja.todasLasVentas(), inv, '2026-11-03');
    expect(r.porHora.map((h) => h.hora)).toEqual([10, 11, 21, 23]);
    expect(r.horaPico).toMatchObject({ hora: 21, cantidad: 1, total: bs(209) });
  });

  it('ordena los más vendidos por unidades y respeta el límite', () => {
    const r = reporteDiario(caja.todasLasVentas(), inv, '2026-11-03', { limiteMasVendidos: 2 });
    expect(r.masVendidos).toHaveLength(2);
    expect(r.masVendidos[0]).toMatchObject({ productoId: 'pacena-620', unidades: 16, ingresos: bs(220) });
    expect(r.masVendidos[0]?.margen).toBe(bs(220 - 16 * 11.5));
    expect(r.masVendidos[1]).toMatchObject({ productoId: 'coca-2l', unidades: 5 });
  });

  it('calcula el margen por categoría, de la más rentable a la menos', () => {
    const r = reporteDiario(caja.todasLasVentas(), inv, '2026-11-03');
    expect(r.porCategoria.map((c) => c.categoria)).toEqual(['cerveza', 'singani', 'gaseosa', 'otros']);
    const singani = r.porCategoria.find((c) => c.categoria === 'singani');
    expect(singani).toMatchObject({ unidades: 2, ingresos: bs(160), costo: bs(124), margen: bs(36), margenPorcentaje: 22.5 });
  });

  it('suma lo vendido por cada cajero', () => {
    const r = reporteDiario(caja.todasLasVentas(), inv, '2026-11-03');
    expect(r.porCajero).toEqual([
      { cajero: 'Luis Suárez', cantidadVentas: 2, total: bs(269) },
      { cajero: 'Rosa Vaca', cantidadVentas: 2, total: bs(186) },
    ]);
  });

  it('la venta de madrugada pertenece al día siguiente', () => {
    const r = reporteDiario(caja.todasLasVentas(), inv, '2026-11-04');
    expect(r.cantidadVentas).toBe(1);
    expect(r.total).toBe(bs(20));
    expect(fechasConVentas(caja.todasLasVentas())).toEqual(['2026-11-04', '2026-11-03']);
  });

  it('un día sin ventas da un reporte en cero y sin hora pico', () => {
    const r = reporteDiario(caja.todasLasVentas(), inv, '2026-11-01');
    expect(r).toMatchObject({ cantidadVentas: 0, total: 0, margenPorcentaje: 0, ticketPromedio: 0, porHora: [] });
    expect(r.horaPico).toBeUndefined();
    expect(() => reporteDiario([], inv, '03/11/2026')).toThrow(/AAAA-MM-DD/);
  });

  it('exporta a CSV con punto y coma y coma decimal para Excel', () => {
    const csv = reporteACsv(reporteDiario(caja.todasLasVentas(), inv, '2026-11-03'));
    const lineas = csv.trim().split('\n');
    expect(lineas[0]).toBe('Reporte diario;2026-11-03');
    expect(csv).toContain('Total (Bs);455,00');
    expect(csv).toContain('Margen (%);20,2');
    expect(csv).toContain('Cerveza Paceña botella 620 ml;16;220,00;36,00');
    expect(csv).toContain('21:00;1;209,00');
  });
});
