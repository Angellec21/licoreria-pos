import { formatearBs } from './dinero.ts';
import type { MetodoPago, Venta } from './caja.ts';

export interface DatosNegocio {
  nombre: string;
  nit?: string;
  direccion?: string;
  telefono?: string;
}

/** Ancho típico de una impresora térmica de 58 mm con fuente estándar. */
export const ANCHO_58MM = 32;

const NOMBRE_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  qr: 'QR',
  tarjeta: 'Tarjeta',
};

/**
 * Fecha y hora en Bolivia (UTC−4 todo el año, sin horario de verano).
 * Se calcula a mano para que el ticket sea igual en cualquier navegador.
 */
export function fechaBolivia(iso: string): string {
  const d = new Date(Date.parse(iso) - 4 * 60 * 60 * 1000);
  if (Number.isNaN(d.getTime())) throw new Error('Fecha inválida');
  const dos = (n: number) => String(n).padStart(2, '0');
  return (
    `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
    `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`
  );
}

function centrar(texto: string, ancho: number): string {
  const t = texto.slice(0, ancho);
  return ' '.repeat(Math.floor((ancho - t.length) / 2)) + t;
}

function aLosLados(izq: string, der: string, ancho: number): string {
  const espacio = ancho - izq.length - der.length;
  if (espacio >= 1) return izq + ' '.repeat(espacio) + der;
  return izq.slice(0, Math.max(ancho - der.length - 1, 0)) + ' ' + der;
}

/** Corta el texto en renglones del ancho del papel, sin partir palabras si se puede. */
function envolver(texto: string, ancho: number): string[] {
  const renglones: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if (palabra.length > ancho) {
      if (actual) renglones.push(actual);
      for (let i = 0; i < palabra.length; i += ancho) renglones.push(palabra.slice(i, i + ancho));
      actual = '';
    } else if (!actual) {
      actual = palabra;
    } else if (actual.length + 1 + palabra.length <= ancho) {
      actual += ` ${palabra}`;
    } else {
      renglones.push(actual);
      actual = palabra;
    }
  }
  if (actual) renglones.push(actual);
  return renglones;
}

/** Genera el ticket de venta en texto plano listo para una impresora térmica. */
export function generarTicket(venta: Venta, negocio: DatosNegocio, ancho = ANCHO_58MM): string[] {
  if (ancho < 24) throw new Error('El ancho mínimo del ticket es 24 caracteres');
  const linea = '-'.repeat(ancho);
  const r: string[] = [];

  r.push(centrar(negocio.nombre.toUpperCase(), ancho));
  if (negocio.nit) r.push(centrar(`NIT ${negocio.nit}`, ancho));
  if (negocio.direccion) for (const t of envolver(negocio.direccion, ancho)) r.push(centrar(t, ancho));
  if (negocio.telefono) r.push(centrar(`Tel. ${negocio.telefono}`, ancho));
  r.push(linea);
  r.push(aLosLados(`Venta ${venta.id}`, fechaBolivia(venta.fecha), ancho));
  r.push(`Cajero: ${venta.cajero}`.slice(0, ancho));
  if (venta.anulada) r.push(centrar('*** VENTA ANULADA ***', ancho));
  r.push(linea);

  for (const l of venta.lineas) {
    for (const t of envolver(l.nombre, ancho)) r.push(t);
    const detalle =
      l.presentacion === 'caja'
        ? `  ${l.cantidad} cj (${l.unidades} u.) x ${formatearBs(l.precioUnitario)}`
        : `  ${l.cantidad} u. x ${formatearBs(l.precioUnitario)}`;
    const subtotal = formatearBs(l.subtotal);
    if (detalle.length + 1 + subtotal.length <= ancho) {
      r.push(aLosLados(detalle, subtotal, ancho));
    } else {
      // No entra en un renglón: el subtotal baja alineado a la derecha.
      r.push(detalle.slice(0, ancho));
      r.push(subtotal.padStart(ancho));
    }
  }

  r.push(linea);
  r.push(aLosLados('TOTAL', formatearBs(venta.total), ancho));
  r.push(aLosLados(`Pago: ${NOMBRE_METODO[venta.metodoPago]}`, formatearBs(venta.recibido), ancho));
  if (venta.metodoPago === 'efectivo') r.push(aLosLados('Cambio', formatearBs(venta.cambio), ancho));
  r.push(linea);
  r.push(centrar('¡Gracias por su compra!', ancho));
  for (const t of envolver('Prohibida la venta a menores de 18 años', ancho)) r.push(centrar(t, ancho));
  return r;
}
