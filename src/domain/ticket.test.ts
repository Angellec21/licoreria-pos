import { beforeEach, describe, expect, it } from 'vitest';
import { crearInventarioDeEjemplo } from '../data/catalogo.ts';
import { Caja, type Venta } from './caja.ts';
import { bs } from './dinero.ts';
import { ANCHO_58MM, fechaBolivia, generarTicket } from './ticket.ts';

const NEGOCIO = {
  nombre: 'Licorería El Turista',
  nit: '6234519013',
  direccion: 'Av. Busch esq. 3er anillo interno, Santa Cruz de la Sierra',
  telefono: '70012345',
};

describe('Ticket de venta', () => {
  let caja: Caja;
  let venta: Venta;

  beforeEach(() => {
    caja = new Caja(crearInventarioDeEjemplo(), () => new Date('2026-11-02T23:45:00-04:00'));
    caja.abrirTurno('Rosa Vaca', bs(200));
    venta = caja.vender(
      [
        { productoId: 'pacena-620', presentacion: 'caja', cantidad: 1 },
        { productoId: 'casareal-negra', presentacion: 'unidad', cantidad: 2 },
      ],
      { metodo: 'efectivo', recibido: bs(400) },
    );
  });

  it('muestra la hora de Bolivia (UTC−4) aunque el día UTC ya haya cambiado', () => {
    expect(fechaBolivia('2026-11-03T03:45:00.000Z')).toBe('02/11/2026 23:45');
    expect(() => fechaBolivia('no es fecha')).toThrow(/inválida/);
  });

  it('respeta el ancho del papel de 58 mm en todos los renglones', () => {
    const t = generarTicket(venta, NEGOCIO);
    for (const renglon of t) expect(renglon.length).toBeLessThanOrEqual(ANCHO_58MM);
  });

  it('incluye encabezado del negocio, detalle, total, pago y cambio', () => {
    const texto = generarTicket(venta, NEGOCIO).join('\n');
    expect(texto).toContain('LICORERÍA EL TURISTA');
    expect(texto).toContain('NIT 6234519013');
    expect(texto).toContain('V-000001');
    expect(texto).toContain('02/11/2026 23:45');
    expect(texto).toContain('Cajero: Rosa Vaca');
    expect(texto).toMatch(/1 cj \(12 u\.\) x Bs 160,00\s+Bs 160,00/);
    expect(texto).toMatch(/2 u\. x Bs 80,00\s+Bs 160,00/);
    expect(texto).toMatch(/TOTAL\s+Bs 320,00/);
    expect(texto).toMatch(/Pago: Efectivo\s+Bs 400,00/);
    expect(texto).toMatch(/Cambio\s+Bs 80,00/);
    expect(texto).toMatch(/menores de\s+18 años/);
  });

  it('no muestra cambio en pagos con QR y marca las ventas anuladas', () => {
    const qr = caja.vender([{ productoId: 'hielo-3kg', presentacion: 'unidad', cantidad: 1 }], { metodo: 'qr' });
    const anulada = caja.anularVenta(qr.id, 'Cliente desistió');
    const texto = generarTicket(anulada, NEGOCIO).join('\n');
    expect(texto).toContain('Pago: QR');
    expect(texto).not.toContain('Cambio');
    expect(texto).toContain('VENTA ANULADA');
  });

  it('acepta papel de 80 mm y rechaza anchos demasiado chicos', () => {
    const t = generarTicket(venta, NEGOCIO, 48);
    expect(Math.max(...t.map((r) => r.length))).toBeLessThanOrEqual(48);
    expect(() => generarTicket(venta, NEGOCIO, 10)).toThrow(/ancho mínimo/);
  });
});
