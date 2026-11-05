import { beforeEach, describe, expect, it } from 'vitest';
import { crearInventarioDeEjemplo } from '../data/catalogo.ts';
import { Caja } from './caja.ts';
import { bs } from './dinero.ts';
import { Inventario } from './inventario.ts';
import {
  CLAVE_ESTADO,
  CLAVE_RESPALDO_DANADO,
  almacenEnMemoria,
  borrarEstado,
  cargarEstado,
  deserializar,
  guardarEstado,
  serializar,
} from './persistencia.ts';

describe('Guardado y restauración del punto de venta', () => {
  let inv: Inventario;
  let caja: Caja;
  const reloj = () => new Date('2026-11-05T21:30:00-04:00');

  beforeEach(() => {
    inv = crearInventarioDeEjemplo();
    caja = new Caja(inv, reloj);
    // Turno cerrado con una venta y otro abierto con una venta y una anulación.
    caja.abrirTurno('Rosa Vaca', bs(200));
    caja.vender([{ productoId: 'pacena-620', presentacion: 'caja', cantidad: 1 }], { metodo: 'qr' });
    caja.cerrarTurno(bs(200));
    caja.abrirTurno('Luis Añez', bs(150));
    caja.vender([{ productoId: 'casareal-negra', presentacion: 'unidad', cantidad: 2 }], {
      metodo: 'efectivo',
      recibido: bs(200),
    });
    const v = caja.vender([{ productoId: 'hielo-3kg', presentacion: 'unidad', cantidad: 1 }], { metodo: 'qr' });
    caja.anularVenta(v.id, 'Cliente se arrepintió');
    inv.ingresar('smirnoff-750', { cajas: 1, costoCaja: bs(864), proveedor: 'Distribuidora Oriente', documento: 'F-1020' });
    inv.desactivar('havana-3');
  });

  it('restaura stock, costos, ingresos, turnos y ventas exactamente como estaban', () => {
    const r = deserializar(serializar(inv, caja, reloj()), reloj);
    expect(r.guardado).toBe('2026-11-06T01:30:00.000Z');
    expect(r.inventario.exportar()).toEqual(inv.exportar());
    expect(r.caja.exportar()).toEqual(caja.exportar());
    expect(r.inventario.listar().some((p) => p.id === 'havana-3')).toBe(false);
    expect(r.caja.resumenTurno()).toEqual(caja.resumenTurno());
    expect(r.caja.resumenTurno('T-0001')).toEqual(caja.resumenTurno('T-0001'));
  });

  it('después de restaurar se sigue trabajando con la numeración correcta', () => {
    const r = deserializar(serializar(inv, caja), reloj);
    const venta = r.caja.vender([{ productoId: 'coca-2l', presentacion: 'unidad', cantidad: 1 }], { metodo: 'qr' });
    expect(venta.id).toBe('V-000004');
    expect(r.inventario.obtener('coca-2l').stockUnidades).toBe(29);
    r.caja.cerrarTurno(bs(450));
    expect(r.caja.abrirTurno('Rosa Vaca', bs(100)).id).toBe('T-0003');
    expect(r.inventario.historialIngresos()[0]).toMatchObject({ id: 'I-00001', proveedor: 'Distribuidora Oriente' });
  });

  it('guarda una caja cerrada sin turno abierto', () => {
    caja.cerrarTurno(bs(310));
    const r = deserializar(serializar(inv, caja), reloj);
    expect(r.caja.turnoActual()).toBeUndefined();
    expect(r.caja.historialTurnos().every((t) => t.estado === 'cerrado')).toBe(true);
  });

  it('rechaza archivos que no son del sistema o de otra versión', () => {
    expect(() => deserializar('no es json')).toThrow(/JSON válido/);
    expect(() => deserializar('null')).toThrow(/vacío/);
    expect(() => deserializar(JSON.stringify({ esquema: 99 }))).toThrow(/no compatible/);
    expect(() => deserializar(JSON.stringify({ esquema: 1, inventario: {}, caja: {} }))).toThrow(/formato esperado/);
  });

  it('no acepta datos alterados: stock negativo, ventas sueltas o dos turnos abiertos', () => {
    const base = JSON.parse(serializar(inv, caja));

    const stockNegativo = structuredClone(base);
    stockNegativo.inventario.productos[0].stockUnidades = -3;
    expect(() => deserializar(JSON.stringify(stockNegativo))).toThrow(/stock inicial/);

    const ventaHuerfana = structuredClone(base);
    ventaHuerfana.caja.ventas[0].turnoId = 'T-9999';
    expect(() => deserializar(JSON.stringify(ventaHuerfana))).toThrow(/turno que no existe/);

    const dosAbiertos = structuredClone(base);
    dosAbiertos.caja.turnos[0].estado = 'abierto';
    expect(() => deserializar(JSON.stringify(dosAbiertos))).toThrow(/no coincide/);

    const saltoNumeracion = structuredClone(base);
    saltoNumeracion.caja.ventas.splice(1, 1);
    expect(() => deserializar(JSON.stringify(saltoNumeracion))).toThrow(/correlativas/);

    const productoIncompleto = structuredClone(base);
    productoIncompleto.inventario.productos[2] = { id: 'x' };
    expect(() => deserializar(JSON.stringify(productoIncompleto))).toThrow(/sin id, nombre o código/);

    const ventaSinLineas = structuredClone(base);
    delete ventaSinLineas.caja.ventas[0].lineas;
    expect(() => deserializar(JSON.stringify(ventaSinLineas))).toThrow(/incompleta/);

    const productoInexistente = structuredClone(base);
    productoInexistente.caja.ventas[0].lineas[0].productoId = 'no-existe';
    expect(() => deserializar(JSON.stringify(productoInexistente))).toThrow(/no encontrado/);
  });

  describe('almacén del navegador', () => {
    it('guarda, carga y borra', () => {
      const almacen = almacenEnMemoria();
      expect(cargarEstado(almacen)).toEqual({ tipo: 'vacio' });
      expect(guardarEstado(almacen, inv, caja)).toBeUndefined();
      const r = cargarEstado(almacen, reloj);
      expect(r.tipo).toBe('ok');
      if (r.tipo === 'ok') expect(r.estado.inventario.valorACosto()).toBe(inv.valorACosto());
      borrarEstado(almacen);
      expect(almacen.getItem(CLAVE_ESTADO)).toBeNull();
    });

    it('si el guardado está dañado lo conserva en una copia y avisa', () => {
      const almacen = almacenEnMemoria({ [CLAVE_ESTADO]: '{"esquema":1,' });
      const r = cargarEstado(almacen);
      expect(r).toMatchObject({ tipo: 'danado', error: expect.stringMatching(/JSON/) });
      expect(almacen.getItem(CLAVE_RESPALDO_DANADO)).toBe('{"esquema":1,');
    });

    it('devuelve un mensaje en vez de romperse si el navegador no deja guardar', () => {
      const lleno = {
        ...almacenEnMemoria(),
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      };
      expect(guardarEstado(lleno, inv, caja)).toMatch(/No se pudo guardar.*QuotaExceeded/);
    });
  });
});
