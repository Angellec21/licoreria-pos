import { type Centavos, validarMonto } from './dinero.ts';
import { type Inventario, type Presentacion, aUnidades, precioDe } from './inventario.ts';

export type MetodoPago = 'efectivo' | 'qr' | 'tarjeta';
export const METODOS_PAGO: readonly MetodoPago[] = ['efectivo', 'qr', 'tarjeta'];

export interface ItemVenta {
  productoId: string;
  presentacion: Presentacion;
  cantidad: number;
}

export interface LineaVenta extends ItemVenta {
  nombre: string;
  /** Unidades que salen del stock (cajas × unidades por caja). */
  unidades: number;
  precioUnitario: Centavos;
  subtotal: Centavos;
  /** Costo de lo vendido, para calcular el margen. */
  costo: Centavos;
}

export interface Venta {
  id: string;
  numero: number;
  turnoId: string;
  cajero: string;
  fecha: string;
  lineas: LineaVenta[];
  total: Centavos;
  metodoPago: MetodoPago;
  recibido: Centavos;
  cambio: Centavos;
  anulada: boolean;
  motivoAnulacion?: string;
}

export interface Turno {
  id: string;
  cajero: string;
  apertura: string;
  montoInicial: Centavos;
  estado: 'abierto' | 'cerrado';
  cierre?: string;
  montoContado?: Centavos;
}

export interface ResumenTurno {
  turnoId: string;
  cajero: string;
  cantidadVentas: number;
  cantidadAnuladas: number;
  total: Centavos;
  porMetodo: Record<MetodoPago, Centavos>;
  costo: Centavos;
  margen: Centavos;
  /** Monto inicial + ventas en efectivo: lo que debería haber en el cajón. */
  efectivoEsperado: Centavos;
  montoContado?: Centavos;
  /** Contado − esperado: negativo es faltante, positivo es sobrante. */
  diferencia?: Centavos;
}

export type Reloj = () => Date;

/**
 * Caja registradora por turnos: un cajero abre el turno con un monto inicial,
 * registra ventas (por unidad o por caja) y al final hace el arqueo.
 */
export class Caja {
  private readonly turnos = new Map<string, Turno>();
  private readonly ventas: Venta[] = [];
  private abierto: Turno | undefined;
  private secuenciaTurnos = 0;

  constructor(
    private readonly inventario: Inventario,
    private readonly reloj: Reloj = () => new Date(),
  ) {}

  turnoActual(): Turno | undefined {
    return this.abierto ? { ...this.abierto } : undefined;
  }

  abrirTurno(cajero: string, montoInicial: Centavos): Turno {
    if (this.abierto) {
      throw new Error(`Ya hay un turno abierto por ${this.abierto.cajero}; ciérrelo primero`);
    }
    const nombre = cajero.trim();
    if (!nombre) throw new Error('Indique el nombre del cajero');
    validarMonto(montoInicial, 'El monto inicial');

    this.secuenciaTurnos += 1;
    const turno: Turno = {
      id: `T-${String(this.secuenciaTurnos).padStart(4, '0')}`,
      cajero: nombre,
      apertura: this.reloj().toISOString(),
      montoInicial,
      estado: 'abierto',
    };
    this.turnos.set(turno.id, turno);
    this.abierto = turno;
    return { ...turno };
  }

  /**
   * Registra una venta todo o nada: si algún producto no tiene stock
   * suficiente no se descuenta nada.
   */
  vender(items: ItemVenta[], pago: { metodo: MetodoPago; recibido?: Centavos }): Venta {
    const turno = this.exigirTurnoAbierto();
    if (items.length === 0) throw new Error('La venta no tiene productos');
    if (!METODOS_PAGO.includes(pago.metodo)) throw new Error('Método de pago no válido');

    // 1) Armar las líneas y validar el stock sumando por producto.
    const pedidoPorProducto = new Map<string, number>();
    const lineas: LineaVenta[] = items.map((item) => {
      const producto = this.inventario.obtener(item.productoId);
      if (!producto.activo) throw new Error(`${producto.nombre} no está a la venta`);
      const unidades = aUnidades(producto, item.cantidad, item.presentacion);
      pedidoPorProducto.set(producto.id, (pedidoPorProducto.get(producto.id) ?? 0) + unidades);
      const precioUnitario = precioDe(producto, item.presentacion);
      return {
        ...item,
        nombre: producto.nombre,
        unidades,
        precioUnitario,
        subtotal: precioUnitario * item.cantidad,
        costo: producto.costoUnidad * unidades,
      };
    });
    for (const [id, unidades] of pedidoPorProducto) {
      const producto = this.inventario.obtener(id);
      if (producto.stockUnidades < unidades) {
        throw new Error(
          `Stock insuficiente de ${producto.nombre}: hay ${producto.stockUnidades} u., se piden ${unidades} u.`,
        );
      }
    }

    // 2) Cobro.
    const total = lineas.reduce((t, l) => t + l.subtotal, 0);
    let recibido = total;
    if (pago.metodo === 'efectivo') {
      recibido = pago.recibido ?? total;
      validarMonto(recibido, 'El monto recibido');
      if (recibido < total) throw new Error('El monto recibido no cubre el total');
    }

    // 3) Recién ahora se descuenta el stock.
    for (const l of lineas) this.inventario.descontar(l.productoId, l.cantidad, l.presentacion);

    const numero = this.ventas.length + 1;
    const venta: Venta = {
      id: `V-${String(numero).padStart(6, '0')}`,
      numero,
      turnoId: turno.id,
      cajero: turno.cajero,
      fecha: this.reloj().toISOString(),
      lineas,
      total,
      metodoPago: pago.metodo,
      recibido,
      cambio: recibido - total,
      anulada: false,
    };
    this.ventas.push(venta);
    return clonarVenta(venta);
  }

  /** Anula una venta del turno abierto y devuelve los productos al stock. */
  anularVenta(ventaId: string, motivo: string): Venta {
    const turno = this.exigirTurnoAbierto();
    const venta = this.ventas.find((v) => v.id === ventaId);
    if (!venta) throw new Error(`Venta ${ventaId} no encontrada`);
    if (venta.turnoId !== turno.id) {
      throw new Error('Solo se pueden anular ventas del turno abierto');
    }
    if (venta.anulada) throw new Error('La venta ya está anulada');
    if (!motivo.trim()) throw new Error('Indique el motivo de la anulación');

    for (const l of venta.lineas) this.inventario.reponer(l.productoId, l.unidades);
    venta.anulada = true;
    venta.motivoAnulacion = motivo.trim();
    return clonarVenta(venta);
  }

  ventasDelTurno(turnoId: string): Venta[] {
    return this.ventas.filter((v) => v.turnoId === turnoId).map(clonarVenta);
  }

  resumenTurno(turnoId?: string): ResumenTurno {
    const turno = turnoId ? this.turnos.get(turnoId) : this.abierto;
    if (!turno) throw new Error(turnoId ? `Turno ${turnoId} no encontrado` : 'No hay turno abierto');

    const delTurno = this.ventas.filter((v) => v.turnoId === turno.id);
    const validas = delTurno.filter((v) => !v.anulada);
    const porMetodo: Record<MetodoPago, Centavos> = { efectivo: 0, qr: 0, tarjeta: 0 };
    let costo = 0;
    for (const v of validas) {
      porMetodo[v.metodoPago] += v.total;
      costo += v.lineas.reduce((t, l) => t + l.costo, 0);
    }
    const total = validas.reduce((t, v) => t + v.total, 0);
    const efectivoEsperado = turno.montoInicial + porMetodo.efectivo;

    return {
      turnoId: turno.id,
      cajero: turno.cajero,
      cantidadVentas: validas.length,
      cantidadAnuladas: delTurno.length - validas.length,
      total,
      porMetodo,
      costo,
      margen: total - costo,
      efectivoEsperado,
      ...(turno.montoContado !== undefined && {
        montoContado: turno.montoContado,
        diferencia: turno.montoContado - efectivoEsperado,
      }),
    };
  }

  /** Cierra el turno con el efectivo contado en el cajón (arqueo). */
  cerrarTurno(montoContado: Centavos): ResumenTurno {
    const turno = this.exigirTurnoAbierto();
    validarMonto(montoContado, 'El monto contado');
    turno.estado = 'cerrado';
    turno.cierre = this.reloj().toISOString();
    turno.montoContado = montoContado;
    this.abierto = undefined;
    return this.resumenTurno(turno.id);
  }

  historialTurnos(): Turno[] {
    return [...this.turnos.values()].map((t) => ({ ...t }));
  }

  private exigirTurnoAbierto(): Turno {
    if (!this.abierto) throw new Error('No hay turno abierto: abra la caja para vender');
    return this.abierto;
  }
}

function clonarVenta(v: Venta): Venta {
  return { ...v, lineas: v.lineas.map((l) => ({ ...l })) };
}
