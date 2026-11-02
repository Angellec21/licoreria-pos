import { beforeEach, describe, expect, it } from 'vitest';
import { crearInventarioDeEjemplo } from '../data/catalogo.ts';
import {
  CARRITO_VACIO,
  agregarAlCarrito,
  alternarPresentacion,
  cambiarCantidad,
  convertirACajas,
  escanear,
  interpretarEscaneo,
  quitarDelCarrito,
  resumirCarrito,
  sugerenciasDeCaja,
} from './carrito.ts';
import { bs } from './dinero.ts';
import type { Inventario } from './inventario.ts';

const PACENA = '7771609000124';

describe('Carrito del mostrador', () => {
  let inv: Inventario;

  beforeEach(() => {
    inv = crearInventarioDeEjemplo();
  });

  describe('operaciones', () => {
    it('agrega productos y junta la misma presentación en una sola línea', () => {
      let c = agregarAlCarrito(CARRITO_VACIO, 'pacena-620');
      c = agregarAlCarrito(c, 'pacena-620', 'unidad', 2);
      c = agregarAlCarrito(c, 'pacena-620', 'caja');
      expect(c).toEqual([
        { productoId: 'pacena-620', presentacion: 'unidad', cantidad: 3 },
        { productoId: 'pacena-620', presentacion: 'caja', cantidad: 1 },
      ]);
    });

    it('es inmutable: no modifica el carrito anterior', () => {
      const a = agregarAlCarrito(CARRITO_VACIO, 'hielo-3kg');
      const b = agregarAlCarrito(a, 'hielo-3kg');
      expect(a[0]?.cantidad).toBe(1);
      expect(b[0]?.cantidad).toBe(2);
      expect(CARRITO_VACIO).toHaveLength(0);
    });

    it('cambia la cantidad, quita con 0 y rechaza cantidades inválidas', () => {
      let c = agregarAlCarrito(CARRITO_VACIO, 'coca-2l', 'unidad', 2);
      c = cambiarCantidad(c, 'coca-2l', 'unidad', 5);
      expect(c[0]?.cantidad).toBe(5);
      expect(cambiarCantidad(c, 'coca-2l', 'unidad', 0)).toHaveLength(0);
      expect(() => cambiarCantidad(c, 'coca-2l', 'unidad', -1)).toThrow(/cantidad/);
      expect(() => cambiarCantidad(c, 'coca-2l', 'unidad', 1.5)).toThrow(/cantidad/);
      expect(() => cambiarCantidad(c, 'fernet-750', 'unidad', 2)).toThrow(/no está en el carrito/);
      expect(() => agregarAlCarrito(c, 'coca-2l', 'unidad', 0)).toThrow(/cantidad/);
    });

    it('quita solo la línea de esa presentación', () => {
      let c = agregarAlCarrito(CARRITO_VACIO, 'pacena-620');
      c = agregarAlCarrito(c, 'pacena-620', 'caja');
      c = quitarDelCarrito(c, 'pacena-620', 'unidad');
      expect(c).toEqual([{ productoId: 'pacena-620', presentacion: 'caja', cantidad: 1 }]);
    });

    it('alterna entre unidad y caja juntando cantidades si ya existía la otra', () => {
      let c = agregarAlCarrito(CARRITO_VACIO, 'huari-620', 'unidad', 2);
      c = agregarAlCarrito(c, 'huari-620', 'caja', 1);
      c = alternarPresentacion(c, 'huari-620', 'unidad');
      expect(c).toEqual([{ productoId: 'huari-620', presentacion: 'caja', cantidad: 3 }]);
      expect(() => alternarPresentacion(c, 'huari-620', 'unidad')).toThrow(/no está/);
    });
  });

  describe('lector de código de barras', () => {
    it('interpreta código solo, cantidad y caja', () => {
      expect(interpretarEscaneo(PACENA)).toEqual({ codigo: PACENA, cantidad: 1, presentacion: 'unidad' });
      expect(interpretarEscaneo(`3*${PACENA}`)).toEqual({ codigo: PACENA, cantidad: 3, presentacion: 'unidad' });
      expect(interpretarEscaneo(` 4x${PACENA} `)).toMatchObject({ cantidad: 4, presentacion: 'unidad' });
      expect(interpretarEscaneo(`c*${PACENA}`)).toEqual({ codigo: PACENA, cantidad: 1, presentacion: 'caja' });
      expect(interpretarEscaneo(`2C*${PACENA}`)).toMatchObject({ cantidad: 2, presentacion: 'caja' });
    });

    it('rechaza escaneos vacíos o con cantidad 0', () => {
      expect(() => interpretarEscaneo('   ')).toThrow(/inválido/);
      expect(() => interpretarEscaneo(`0*${PACENA}`)).toThrow(/cantidad/);
    });

    it('agrega al carrito el producto escaneado', () => {
      const r = escanear(CARRITO_VACIO, inv, `2*${PACENA}`);
      expect(r.producto.id).toBe('pacena-620');
      expect(r.carrito).toEqual([{ productoId: 'pacena-620', presentacion: 'unidad', cantidad: 2 }]);
    });

    it('avisa cuando el código no está registrado o el producto está dado de baja', () => {
      expect(() => escanear(CARRITO_VACIO, inv, '0000000000000')).toThrow(/no registrado/);
      inv.desactivar('pacena-620');
      expect(() => escanear(CARRITO_VACIO, inv, PACENA)).toThrow(/no registrado/);
    });
  });

  describe('resumen', () => {
    it('calcula subtotales y total con los precios vigentes', () => {
      let c = agregarAlCarrito(CARRITO_VACIO, 'pacena-620', 'caja');
      c = agregarAlCarrito(c, 'hielo-3kg', 'unidad', 2);
      const r = resumirCarrito(c, inv);
      expect(r.total).toBe(bs(160) + bs(20));
      expect(r.totalUnidades).toBe(14);
      expect(r.lineas[0]).toMatchObject({ nombre: 'Cerveza Paceña botella 620 ml', unidades: 12, subtotal: bs(160) });

      inv.actualizarPrecios('hielo-3kg', { precioUnidad: bs(12), precioCaja: bs(12) });
      expect(resumirCarrito(c, inv).total).toBe(bs(160) + bs(24));
    });

    it('detecta faltantes de stock sumando unidad y caja del mismo producto', () => {
      // Smirnoff: 5 u. en stock. 1 caja (12 u.) ya supera.
      let c = agregarAlCarrito(CARRITO_VACIO, 'smirnoff-750', 'unidad', 3);
      expect(resumirCarrito(c, inv).sinStock).toEqual([]);
      c = agregarAlCarrito(c, 'smirnoff-750', 'unidad', 3);
      expect(resumirCarrito(c, inv).sinStock).toEqual([
        { productoId: 'smirnoff-750', nombre: 'Vodka Smirnoff 750 ml', pedido: 6, disponible: 5 },
      ]);
    });

    it('sugiere vender como caja cuando el cliente lleva una caja completa suelta', () => {
      const c = agregarAlCarrito(CARRITO_VACIO, 'pacena-620', 'unidad', 13);
      // 12 × 15 = 180 sueltas vs. 160 la caja → ahorra Bs 20.
      expect(sugerenciasDeCaja(c, inv)).toEqual([
        { productoId: 'pacena-620', nombre: 'Cerveza Paceña botella 620 ml', cajas: 1, ahorro: bs(20) },
      ]);
      // El hielo no viene en caja: no hay sugerencia.
      expect(sugerenciasDeCaja(agregarAlCarrito(CARRITO_VACIO, 'hielo-3kg', 'unidad', 5), inv)).toEqual([]);
    });

    it('convierte las sueltas en cajas cerradas y deja el resto suelto', () => {
      let c = agregarAlCarrito(CARRITO_VACIO, 'pacena-lata', 'unidad', 13);
      c = convertirACajas(c, inv, 'pacena-lata');
      expect(c).toEqual([
        { productoId: 'pacena-lata', presentacion: 'caja', cantidad: 2 },
        { productoId: 'pacena-lata', presentacion: 'unidad', cantidad: 1 },
      ]);
      // 2 packs × 54 + 1 lata × 10 = 118 (antes 130).
      expect(resumirCarrito(c, inv).total).toBe(bs(118));
      expect(() => convertirACajas(c, inv, 'pacena-lata')).toThrow(/caja completa/);
      expect(() => convertirACajas(CARRITO_VACIO, inv, 'pacena-lata')).toThrow(/no está/);
    });
  });
});
