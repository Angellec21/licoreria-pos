import { type Centavos, validarMonto } from './dinero.ts';

export type Categoria =
  | 'cerveza'
  | 'vino'
  | 'singani'
  | 'ron'
  | 'whisky'
  | 'vodka'
  | 'fernet'
  | 'gaseosa'
  | 'otros';

/** Forma de venta: una botella/lata suelta o la caja/pack cerrado. */
export type Presentacion = 'unidad' | 'caja';

export interface Producto {
  id: string;
  codigoBarras: string;
  nombre: string;
  categoria: Categoria;
  /** Unidades que trae una caja o pack (p. ej. 12 botellas, 6 latas). */
  unidadesPorCaja: number;
  /** Precio de venta de una unidad suelta. */
  precioUnidad: Centavos;
  /** Precio de venta de la caja cerrada (normalmente con descuento). */
  precioCaja: Centavos;
  /** Costo de compra por unidad (para margen y valor de inventario). */
  costoUnidad: Centavos;
  /** El stock siempre se guarda en unidades. */
  stockUnidades: number;
  /** Bajo este número de unidades se genera una alerta de reposición. */
  stockMinimo: number;
  activo: boolean;
}

export type NuevoProducto = Omit<Producto, 'stockUnidades' | 'activo'> & {
  stockUnidades?: number;
};

export interface StockDesglosado {
  cajas: number;
  sueltas: number;
  totalUnidades: number;
}

export interface AlertaStock {
  productoId: string;
  nombre: string;
  stockUnidades: number;
  stockMinimo: number;
  faltan: number;
}

function validarEntero(valor: number, campo: string, minimo = 0): void {
  if (!Number.isInteger(valor) || valor < minimo) {
    throw new Error(`${campo} debe ser un entero mayor o igual a ${minimo}`);
  }
}

/** Convierte una cantidad vendida o comprada a unidades. */
export function aUnidades(producto: Producto, cantidad: number, presentacion: Presentacion): number {
  validarEntero(cantidad, 'La cantidad', 1);
  return presentacion === 'caja' ? cantidad * producto.unidadesPorCaja : cantidad;
}

export function precioDe(producto: Producto, presentacion: Presentacion): Centavos {
  return presentacion === 'caja' ? producto.precioCaja : producto.precioUnidad;
}

export class Inventario {
  private readonly productos = new Map<string, Producto>();

  agregar(datos: NuevoProducto): Producto {
    const id = datos.id.trim();
    if (!id) throw new Error('El producto necesita un id');
    if (this.productos.has(id)) throw new Error(`Ya existe un producto con id ${id}`);
    if (!datos.nombre.trim()) throw new Error('El producto necesita un nombre');
    if (this.buscarPorCodigo(datos.codigoBarras)) {
      throw new Error(`El código de barras ${datos.codigoBarras} ya está registrado`);
    }
    validarEntero(datos.unidadesPorCaja, 'Unidades por caja', 1);
    validarMonto(datos.precioUnidad, 'El precio por unidad');
    validarMonto(datos.precioCaja, 'El precio por caja');
    validarMonto(datos.costoUnidad, 'El costo por unidad');
    validarEntero(datos.stockMinimo, 'El stock mínimo');
    const stock = datos.stockUnidades ?? 0;
    validarEntero(stock, 'El stock inicial');
    if (datos.precioCaja > datos.precioUnidad * datos.unidadesPorCaja) {
      throw new Error('El precio por caja no puede superar al de sus unidades sueltas');
    }

    const producto: Producto = { ...datos, id, stockUnidades: stock, activo: true };
    this.productos.set(id, producto);
    return { ...producto };
  }

  obtener(id: string): Producto {
    return { ...this.ref(id) };
  }

  buscarPorCodigo(codigoBarras: string): Producto | undefined {
    for (const p of this.productos.values()) {
      if (p.codigoBarras === codigoBarras) return { ...p };
    }
    return undefined;
  }

  /** Búsqueda por nombre o código para el mostrador (sin distinguir tildes). */
  buscar(texto: string): Producto[] {
    const q = normalizar(texto);
    return this.listar().filter(
      (p) => normalizar(p.nombre).includes(q) || p.codigoBarras.includes(texto.trim()),
    );
  }

  listar(): Producto[] {
    return [...this.productos.values()]
      .filter((p) => p.activo)
      .map((p) => ({ ...p }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  actualizarPrecios(id: string, precios: { precioUnidad?: Centavos; precioCaja?: Centavos }): Producto {
    const p = this.ref(id);
    const precioUnidad = precios.precioUnidad ?? p.precioUnidad;
    const precioCaja = precios.precioCaja ?? p.precioCaja;
    validarMonto(precioUnidad, 'El precio por unidad');
    validarMonto(precioCaja, 'El precio por caja');
    if (precioCaja > precioUnidad * p.unidadesPorCaja) {
      throw new Error('El precio por caja no puede superar al de sus unidades sueltas');
    }
    p.precioUnidad = precioUnidad;
    p.precioCaja = precioCaja;
    return { ...p };
  }

  /** Ingreso de mercadería (compra al distribuidor) en cajas y/o unidades sueltas. */
  registrarIngreso(id: string, ingreso: { cajas?: number; unidades?: number }): Producto {
    const p = this.ref(id);
    const cajas = ingreso.cajas ?? 0;
    const unidades = ingreso.unidades ?? 0;
    validarEntero(cajas, 'Las cajas');
    validarEntero(unidades, 'Las unidades');
    const total = cajas * p.unidadesPorCaja + unidades;
    if (total === 0) throw new Error('El ingreso debe tener al menos una unidad');
    p.stockUnidades += total;
    return { ...p };
  }

  /** ¿Alcanza el stock para vender esta cantidad? */
  hayStock(id: string, cantidad: number, presentacion: Presentacion): boolean {
    const p = this.ref(id);
    return p.stockUnidades >= aUnidades(p, cantidad, presentacion);
  }

  descontar(id: string, cantidad: number, presentacion: Presentacion): Producto {
    const p = this.ref(id);
    const unidades = aUnidades(p, cantidad, presentacion);
    if (p.stockUnidades < unidades) {
      throw new Error(
        `Stock insuficiente de ${p.nombre}: hay ${p.stockUnidades} u., se piden ${unidades} u.`,
      );
    }
    p.stockUnidades -= unidades;
    return { ...p };
  }

  /** Devuelve unidades al stock (anulación de una venta). */
  reponer(id: string, unidades: number): Producto {
    const p = this.ref(id);
    validarEntero(unidades, 'Las unidades', 1);
    p.stockUnidades += unidades;
    return { ...p };
  }

  stockDesglosado(id: string): StockDesglosado {
    const p = this.ref(id);
    return {
      cajas: Math.floor(p.stockUnidades / p.unidadesPorCaja),
      sueltas: p.stockUnidades % p.unidadesPorCaja,
      totalUnidades: p.stockUnidades,
    };
  }

  alertasStockMinimo(): AlertaStock[] {
    return this.listar()
      .filter((p) => p.stockUnidades <= p.stockMinimo)
      .map((p) => ({
        productoId: p.id,
        nombre: p.nombre,
        stockUnidades: p.stockUnidades,
        stockMinimo: p.stockMinimo,
        faltan: Math.max(p.stockMinimo - p.stockUnidades, 0),
      }))
      .sort((a, b) => a.stockUnidades - b.stockUnidades);
  }

  /** Valor del inventario a costo de compra. */
  valorACosto(): Centavos {
    return this.listar().reduce((t, p) => t + p.stockUnidades * p.costoUnidad, 0);
  }

  /** Referencia interna (mutable); nunca se expone fuera de la clase. */
  private ref(id: string): Producto {
    const producto = this.productos.get(id);
    if (!producto) throw new Error(`Producto ${id} no encontrado`);
    return producto;
  }

  desactivar(id: string): void {
    this.ref(id).activo = false;
  }
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
