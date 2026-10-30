import { beforeEach, describe, expect, it } from 'vitest';
import { crearInventarioDeEjemplo } from '../data/catalogo.ts';
import { Caja } from './caja.ts';
import { bs } from './dinero.ts';
import type { Inventario } from './inventario.ts';

describe('Caja por turnos', () => {
  let inv: Inventario;
  let caja: Caja;
  let ahora: Date;

  beforeEach(() => {
    inv = crearInventarioDeEjemplo();
    ahora = new Date('2026-10-30T18:00:00-04:00');
    caja = new Caja(inv, () => ahora);
  });

  describe('apertura', () => {
    it('abre un turno con el cajero y el monto inicial', () => {
      const t = caja.abrirTurno('Rosa Vaca', bs(200));
      expect(t).toMatchObject({ id: 'T-0001', cajero: 'Rosa Vaca', montoInicial: bs(200), estado: 'abierto' });
      expect(caja.turnoActual()?.id).toBe('T-0001');
    });

    it('no permite dos turnos abiertos ni datos inválidos', () => {
      expect(() => caja.abrirTurno('  ', bs(100))).toThrow(/cajero/);
      expect(() => caja.abrirTurno('Rosa', -5)).toThrow(/monto inicial/);
      caja.abrirTurno('Rosa', bs(100));
      expect(() => caja.abrirTurno('Luis', bs(100))).toThrow(/Ya hay un turno abierto/);
    });

    it('no permite vender sin turno abierto', () => {
      expect(() =>
        caja.vender([{ productoId: 'pacena-620', presentacion: 'unidad', cantidad: 1 }], { metodo: 'qr' }),
      ).toThrow(/No hay turno abierto/);
    });
  });

  describe('ventas', () => {
    beforeEach(() => {
      caja.abrirTurno('Rosa Vaca', bs(200));
    });

    it('vende por caja y por unidad, calcula total y cambio y descuenta stock', () => {
      const v = caja.vender(
        [
          { productoId: 'pacena-620', presentacion: 'caja', cantidad: 1 },
          { productoId: 'pacena-620', presentacion: 'unidad', cantidad: 2 },
          { productoId: 'hielo-3kg', presentacion: 'unidad', cantidad: 1 },
        ],
        { metodo: 'efectivo', recibido: bs(200) },
      );
      expect(v.total).toBe(bs(160 + 30 + 10));
      expect(v.cambio).toBe(0);
      expect(v.id).toBe('V-000001');
      expect(v.lineas[0]).toMatchObject({ unidades: 12, precioUnitario: bs(160), subtotal: bs(160) });
      expect(inv.obtener('pacena-620').stockUnidades).toBe(96 - 14);
      expect(inv.obtener('hielo-3kg').stockUnidades).toBe(19);
    });

    it('calcula el cambio en efectivo y rechaza pagos insuficientes', () => {
      const v = caja.vender([{ productoId: 'casareal-negra', presentacion: 'unidad', cantidad: 1 }], {
        metodo: 'efectivo',
        recibido: bs(100),
      });
      expect(v.cambio).toBe(bs(20));
      expect(() =>
        caja.vender([{ productoId: 'casareal-negra', presentacion: 'unidad', cantidad: 1 }], {
          metodo: 'efectivo',
          recibido: bs(50),
        }),
      ).toThrow(/no cubre/);
    });

    it('en pagos con QR o tarjeta no hay cambio', () => {
      const v = caja.vender([{ productoId: 'fernet-750', presentacion: 'unidad', cantidad: 1 }], { metodo: 'qr' });
      expect(v.recibido).toBe(v.total);
      expect(v.cambio).toBe(0);
    });

    it('es todo o nada: si falta stock de un producto no descuenta ninguno', () => {
      expect(() =>
        caja.vender(
          [
            { productoId: 'pacena-620', presentacion: 'unidad', cantidad: 6 },
            { productoId: 'smirnoff-750', presentacion: 'caja', cantidad: 1 },
          ],
          { metodo: 'tarjeta' },
        ),
      ).toThrow(/Stock insuficiente de Vodka Smirnoff/);
      expect(inv.obtener('pacena-620').stockUnidades).toBe(96);
    });

    it('suma unidades del mismo producto en varias líneas al validar stock', () => {
      // Johnnie Walker tiene 6 u.: 4 + 4 en dos líneas no alcanza.
      expect(() =>
        caja.vender(
          [
            { productoId: 'jw-red', presentacion: 'unidad', cantidad: 4 },
            { productoId: 'jw-red', presentacion: 'unidad', cantidad: 4 },
          ],
          { metodo: 'qr' },
        ),
      ).toThrow(/se piden 8 u/);
      expect(inv.obtener('jw-red').stockUnidades).toBe(6);
    });

    it('rechaza ventas vacías y productos inexistentes', () => {
      expect(() => caja.vender([], { metodo: 'qr' })).toThrow(/no tiene productos/);
      expect(() =>
        caja.vender([{ productoId: 'no-existe', presentacion: 'unidad', cantidad: 1 }], { metodo: 'qr' }),
      ).toThrow(/no encontrado/);
    });

    it('anula una venta del turno, repone el stock y exige motivo', () => {
      const v = caja.vender([{ productoId: 'pacena-620', presentacion: 'caja', cantidad: 2 }], { metodo: 'qr' });
      expect(inv.obtener('pacena-620').stockUnidades).toBe(72);
      expect(() => caja.anularVenta(v.id, ' ')).toThrow(/motivo/);
      const anulada = caja.anularVenta(v.id, 'Cliente se arrepintió');
      expect(anulada.anulada).toBe(true);
      expect(inv.obtener('pacena-620').stockUnidades).toBe(96);
      expect(() => caja.anularVenta(v.id, 'otra vez')).toThrow(/ya está anulada/);
    });
  });

  describe('cierre y arqueo', () => {
    it('resume ventas por método de pago, margen y detecta faltante', () => {
      caja.abrirTurno('Rosa Vaca', bs(200));
      caja.vender([{ productoId: 'pacena-620', presentacion: 'caja', cantidad: 1 }], {
        metodo: 'efectivo',
        recibido: bs(200),
      });
      caja.vender([{ productoId: 'kohlberg-tinto', presentacion: 'unidad', cantidad: 2 }], { metodo: 'qr' });
      const anulada = caja.vender([{ productoId: 'coca-2l', presentacion: 'unidad', cantidad: 1 }], {
        metodo: 'efectivo',
      });
      caja.anularVenta(anulada.id, 'Error de digitación');

      ahora = new Date('2026-10-31T02:00:00-04:00');
      const r = caja.cerrarTurno(bs(355));

      expect(r.cantidadVentas).toBe(2);
      expect(r.cantidadAnuladas).toBe(1);
      expect(r.total).toBe(bs(160 + 90));
      expect(r.porMetodo).toEqual({ efectivo: bs(160), qr: bs(90), tarjeta: 0 });
      expect(r.costo).toBe(12 * bs(11.5) + 2 * bs(33));
      expect(r.margen).toBe(r.total - r.costo);
      expect(r.efectivoEsperado).toBe(bs(360));
      expect(r.diferencia).toBe(bs(-5));
      expect(caja.turnoActual()).toBeUndefined();
      expect(caja.historialTurnos()[0]).toMatchObject({ estado: 'cerrado', cierre: '2026-10-31T06:00:00.000Z' });
    });

    it('no se pueden anular ventas de un turno ya cerrado', () => {
      caja.abrirTurno('Rosa', bs(100));
      const v = caja.vender([{ productoId: 'hielo-3kg', presentacion: 'unidad', cantidad: 1 }], { metodo: 'qr' });
      caja.cerrarTurno(bs(100));
      caja.abrirTurno('Luis', bs(100));
      expect(() => caja.anularVenta(v.id, 'tarde')).toThrow(/turno abierto/);
      expect(caja.resumenTurno().turnoId).toBe('T-0002');
      expect(caja.ventasDelTurno('T-0001')).toHaveLength(1);
    });

    it('no permite cerrar sin turno abierto', () => {
      expect(() => caja.cerrarTurno(0)).toThrow(/No hay turno abierto/);
    });
  });
});
