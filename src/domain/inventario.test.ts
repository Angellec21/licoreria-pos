import { beforeEach, describe, expect, it } from 'vitest';
import { bs } from './dinero.ts';
import { Inventario, aUnidades, precioDe, type NuevoProducto } from './inventario.ts';
import { catalogoEjemplo, crearInventarioDeEjemplo } from '../data/catalogo.ts';

const pacena: NuevoProducto = {
  id: 'pacena-620',
  codigoBarras: '7771609000124',
  nombre: 'Cerveza Paceña botella 620 ml',
  categoria: 'cerveza',
  unidadesPorCaja: 12,
  precioUnidad: bs(15),
  precioCaja: bs(160),
  costoUnidad: bs(11.5),
  stockUnidades: 30,
  stockMinimo: 24,
};

describe('Inventario', () => {
  let inv: Inventario;
  beforeEach(() => {
    inv = new Inventario();
    inv.agregar(pacena);
  });

  it('registra productos y los busca por código de barras o nombre sin tildes', () => {
    expect(inv.buscarPorCodigo('7771609000124')?.nombre).toContain('Paceña');
    expect(inv.buscar('pacena')).toHaveLength(1);
    expect(inv.buscar('7771609')).toHaveLength(1);
    expect(inv.buscar('whisky')).toHaveLength(0);
  });

  it('no permite ids ni códigos de barras duplicados', () => {
    expect(() => inv.agregar(pacena)).toThrow(/Ya existe/);
    expect(() => inv.agregar({ ...pacena, id: 'otro' })).toThrow(/código de barras/);
  });

  it('valida precios: la caja no puede costar más que sus unidades sueltas', () => {
    expect(() =>
      inv.agregar({ ...pacena, id: 'x', codigoBarras: '1', precioCaja: bs(181) }),
    ).toThrow(/precio por caja/);
    expect(() =>
      inv.agregar({ ...pacena, id: 'y', codigoBarras: '2', unidadesPorCaja: 0 }),
    ).toThrow(/Unidades por caja/);
    expect(() =>
      inv.agregar({ ...pacena, id: 'z', codigoBarras: '3', precioUnidad: -100 }),
    ).toThrow(/precio por unidad/);
  });

  it('convierte cajas a unidades y elige el precio según la presentación', () => {
    const p = inv.obtener('pacena-620');
    expect(aUnidades(p, 2, 'caja')).toBe(24);
    expect(aUnidades(p, 5, 'unidad')).toBe(5);
    expect(precioDe(p, 'caja')).toBe(bs(160));
    expect(precioDe(p, 'unidad')).toBe(bs(15));
    expect(() => aUnidades(p, 0, 'unidad')).toThrow(/cantidad/);
  });

  it('registra ingresos de mercadería en cajas y unidades sueltas', () => {
    const p = inv.registrarIngreso('pacena-620', { cajas: 3, unidades: 4 });
    expect(p.stockUnidades).toBe(30 + 36 + 4);
    expect(() => inv.registrarIngreso('pacena-620', {})).toThrow(/al menos una unidad/);
  });

  it('descuenta stock por unidad y por caja, sin permitir stock negativo', () => {
    inv.descontar('pacena-620', 1, 'caja');
    expect(inv.obtener('pacena-620').stockUnidades).toBe(18);
    inv.descontar('pacena-620', 3, 'unidad');
    expect(inv.obtener('pacena-620').stockUnidades).toBe(15);
    expect(inv.hayStock('pacena-620', 2, 'caja')).toBe(false);
    expect(() => inv.descontar('pacena-620', 2, 'caja')).toThrow(/Stock insuficiente/);
    expect(inv.obtener('pacena-620').stockUnidades).toBe(15);
  });

  it('muestra el stock desglosado en cajas y sueltas', () => {
    expect(inv.stockDesglosado('pacena-620')).toEqual({ cajas: 2, sueltas: 6, totalUnidades: 30 });
  });

  it('no expone el estado interno: modificar la copia no cambia el stock', () => {
    const copia = inv.obtener('pacena-620');
    copia.stockUnidades = 999;
    expect(inv.obtener('pacena-620').stockUnidades).toBe(30);
  });

  it('actualiza precios validando la regla de la caja', () => {
    expect(inv.actualizarPrecios('pacena-620', { precioUnidad: bs(16) }).precioUnidad).toBe(bs(16));
    expect(() => inv.actualizarPrecios('pacena-620', { precioCaja: bs(500) })).toThrow();
  });

  it('genera alertas cuando el stock llega al mínimo y oculta productos desactivados', () => {
    expect(inv.alertasStockMinimo()).toHaveLength(0);
    inv.descontar('pacena-620', 6, 'unidad');
    const [alerta] = inv.alertasStockMinimo();
    expect(alerta).toMatchObject({ productoId: 'pacena-620', stockUnidades: 24, faltan: 0 });
    inv.desactivar('pacena-620');
    expect(inv.listar()).toHaveLength(0);
    expect(inv.alertasStockMinimo()).toHaveLength(0);
  });

  it('calcula el valor del inventario a costo', () => {
    expect(inv.valorACosto()).toBe(30 * bs(11.5));
  });
});

describe('Catálogo de ejemplo', () => {
  it('carga una licorería de Santa Cruz con productos válidos', () => {
    const inv = crearInventarioDeEjemplo();
    expect(inv.listar()).toHaveLength(catalogoEjemplo.length);
    expect(inv.alertasStockMinimo().map((a) => a.productoId)).toContain('smirnoff-750');
  });
});
