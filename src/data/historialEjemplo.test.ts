import { describe, expect, it } from 'vitest';
import { deserializar, serializar } from '../domain/persistencia.ts';
import { fechaHoraLocal, fechasConVentas, reporteDiario } from '../domain/reporte.ts';
import { catalogoEjemplo } from './catalogo.ts';
import { crearEstadoDeEjemplo, crearHistorialDeEjemplo } from './historialEjemplo.ts';

// Viernes 6 de noviembre de 2026, 10:00 en Santa Cruz.
const HOY = new Date('2026-11-06T14:00:00Z');

describe('historial de ventas de ejemplo', () => {
  it('genera una semana cerrada que termina ayer, sin ventas de hoy', () => {
    const { caja } = crearHistorialDeEjemplo({ hoy: HOY });
    const fechas = fechasConVentas(caja.todasLasVentas());
    expect(fechas).toHaveLength(7);
    expect(fechas).toContain('2026-11-05');
    expect(fechas).toContain('2026-10-30');
    expect(fechas).not.toContain('2026-11-06');
  });

  it('deja todos los turnos cerrados, dos por día, para que el cajero abra el suyo', () => {
    const { caja } = crearHistorialDeEjemplo({ hoy: HOY });
    const turnos = caja.historialTurnos();
    expect(turnos).toHaveLength(14);
    expect(turnos.every((t) => t.estado === 'cerrado')).toBe(true);
    expect(caja.turnoActual()).toBeUndefined();
    expect(new Set(turnos.map((t) => t.cajero))).toEqual(new Set(['Carla Rojas', 'Jorge Suárez']));
  });

  it('es determinista: misma fecha y semilla, mismo historial', () => {
    const a = crearHistorialDeEjemplo({ hoy: HOY });
    const b = crearHistorialDeEjemplo({ hoy: HOY });
    expect(serializar(a.inventario, a.caja, HOY)).toBe(serializar(b.inventario, b.caja, HOY));
    const c = crearHistorialDeEjemplo({ hoy: HOY, semilla: 7 });
    expect(serializar(c.inventario, c.caja, HOY)).not.toBe(serializar(a.inventario, a.caja, HOY));
  });

  it('el stock final cuadra: inicial + compras − ventas no anuladas', () => {
    const { inventario, caja } = crearHistorialDeEjemplo({ hoy: HOY });
    for (const inicial of catalogoEjemplo) {
      const comprado = inventario
        .historialIngresos(inicial.id)
        .reduce((t, i) => t + i.totalUnidades, 0);
      const vendido = caja
        .todasLasVentas()
        .filter((v) => !v.anulada)
        .flatMap((v) => v.lineas)
        .filter((l) => l.productoId === inicial.id)
        .reduce((t, l) => t + l.unidades, 0);
      const actual = inventario.obtener(inicial.id).stockUnidades;
      expect(actual, inicial.nombre).toBe((inicial.stockUnidades ?? 0) + comprado - vendido);
      expect(actual, inicial.nombre).toBeGreaterThanOrEqual(0);
    }
  });

  it('registra compras al distribuidor con proveedor y factura', () => {
    const { inventario } = crearHistorialDeEjemplo({ hoy: HOY });
    const ingresos = inventario.historialIngresos();
    expect(ingresos.length).toBeGreaterThan(5);
    expect(ingresos.every((i) => i.proveedor && /^F-\d+$/.test(i.documento ?? ''))).toBe(true);
    expect(ingresos.every((i) => fechaHoraLocal(i.fecha).hora === 8)).toBe(true);
  });

  it('las ventas siguen el ritmo de una licorería: más el fin de semana y de noche', () => {
    const { inventario, caja } = crearHistorialDeEjemplo({ hoy: HOY });
    const ventas = caja.todasLasVentas();
    const sabado = reporteDiario(ventas, inventario, '2026-10-31');
    const martes = reporteDiario(ventas, inventario, '2026-11-03');
    expect(sabado.cantidadVentas).toBeGreaterThan(martes.cantidadVentas * 2);
    expect(sabado.horaPico!.hora).toBeGreaterThanOrEqual(18);
    expect(sabado.masVendidos[0]?.nombre).toMatch(/Paceña/);
    expect(sabado.margen).toBeGreaterThan(0);
    for (const v of ventas) {
      const { hora } = fechaHoraLocal(v.fecha);
      expect(hora).toBeGreaterThanOrEqual(9);
      expect(v.cambio).toBeGreaterThanOrEqual(0);
    }
  });

  it('incluye algunas anulaciones con motivo y arqueos con faltante', () => {
    const { caja } = crearHistorialDeEjemplo({ hoy: HOY });
    const anuladas = caja.todasLasVentas().filter((v) => v.anulada);
    expect(anuladas.length).toBeGreaterThan(0);
    expect(anuladas.every((v) => v.motivoAnulacion && v.fechaAnulacion)).toBe(true);
    const diferencias = caja.historialTurnos().map((t) => caja.resumenTurno(t.id).diferencia ?? 0);
    expect(diferencias.filter((d) => d === 0).length).toBeGreaterThan(diferencias.length / 2);
    expect(diferencias.some((d) => d < 0)).toBe(true);
  });

  it('se puede guardar y restaurar sin errores (pasa todas las validaciones)', () => {
    const { inventario, caja } = crearHistorialDeEjemplo({ hoy: HOY });
    const texto = serializar(inventario, caja, HOY);
    const r = deserializar(texto);
    expect(r.caja.todasLasVentas()).toHaveLength(caja.todasLasVentas().length);
    expect(r.inventario.valorACosto()).toBe(inventario.valorACosto());
  });

  it('funciona para cualquier fecha de inicio (la app lo genera con la fecha del día)', () => {
    for (let d = 0; d < 60; d += 1) {
      const hoy = new Date(Date.parse('2026-01-01T15:00:00Z') + d * 86_400_000);
      const { inventario, caja } = crearHistorialDeEjemplo({ hoy });
      expect(fechasConVentas(caja.todasLasVentas())).toHaveLength(7);
      expect(inventario.listar().every((p) => p.stockUnidades >= 0)).toBe(true);
    }
  });

  it('el estado para la app registra las ventas nuevas con el reloj real', () => {
    const ahora = new Date('2026-11-06T15:30:00Z');
    const { caja } = crearEstadoDeEjemplo({ hoy: HOY }, () => ahora);
    const previas = caja.todasLasVentas().length;
    caja.abrirTurno('Carla Rojas', 20000);
    const v = caja.vender([{ productoId: 'hielo-3kg', presentacion: 'unidad', cantidad: 1 }], { metodo: 'qr' });
    expect(v.fecha).toBe(ahora.toISOString());
    expect(v.numero).toBe(previas + 1);
    expect(caja.turnoActual()?.id).toBe('T-0015');
  });
});
