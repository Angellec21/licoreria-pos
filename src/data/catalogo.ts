import { bs } from '../domain/dinero.ts';
import { Inventario, type NuevoProducto } from '../domain/inventario.ts';

/**
 * Catálogo de ejemplo de una licorería de barrio en Santa Cruz de la Sierra.
 * Precios referenciales en Bs (venta suelta y por caja/pack cerrado).
 */
export const catalogoEjemplo: NuevoProducto[] = [
  { id: 'pacena-620', codigoBarras: '7771609000124', nombre: 'Cerveza Paceña botella 620 ml', categoria: 'cerveza', unidadesPorCaja: 12, precioUnidad: bs(15), precioCaja: bs(160), costoUnidad: bs(11.5), stockUnidades: 96, stockMinimo: 36 },
  { id: 'huari-620', codigoBarras: '7771609000216', nombre: 'Cerveza Huari botella 620 ml', categoria: 'cerveza', unidadesPorCaja: 12, precioUnidad: bs(17), precioCaja: bs(185), costoUnidad: bs(13.2), stockUnidades: 48, stockMinimo: 24 },
  { id: 'pacena-lata', codigoBarras: '7771609000308', nombre: 'Cerveza Paceña lata 355 ml', categoria: 'cerveza', unidadesPorCaja: 6, precioUnidad: bs(10), precioCaja: bs(54), costoUnidad: bs(7.4), stockUnidades: 60, stockMinimo: 24 },
  { id: 'casareal-negra', codigoBarras: '7772106000017', nombre: 'Singani Casa Real Etiqueta Negra 750 ml', categoria: 'singani', unidadesPorCaja: 12, precioUnidad: bs(80), precioCaja: bs(900), costoUnidad: bs(62), stockUnidades: 18, stockMinimo: 6 },
  { id: 'rujero-azul', codigoBarras: '7772203000025', nombre: 'Singani Rujero Etiqueta Azul 750 ml', categoria: 'singani', unidadesPorCaja: 12, precioUnidad: bs(65), precioCaja: bs(720), costoUnidad: bs(50), stockUnidades: 10, stockMinimo: 6 },
  { id: 'kohlberg-tinto', codigoBarras: '7773301000031', nombre: 'Vino Kohlberg Tinto 750 ml', categoria: 'vino', unidadesPorCaja: 6, precioUnidad: bs(45), precioCaja: bs(250), costoUnidad: bs(33), stockUnidades: 24, stockMinimo: 12 },
  { id: 'campos-cabernet', codigoBarras: '7773402000048', nombre: 'Vino Campos de Solana Cabernet 750 ml', categoria: 'vino', unidadesPorCaja: 6, precioUnidad: bs(75), precioCaja: bs(420), costoUnidad: bs(56), stockUnidades: 9, stockMinimo: 6 },
  { id: 'fernet-750', codigoBarras: '8000140001052', nombre: 'Fernet Branca 750 ml', categoria: 'fernet', unidadesPorCaja: 6, precioUnidad: bs(125), precioCaja: bs(720), costoUnidad: bs(98), stockUnidades: 12, stockMinimo: 6 },
  { id: 'havana-3', codigoBarras: '8501110080064', nombre: 'Ron Havana Club 3 Años 750 ml', categoria: 'ron', unidadesPorCaja: 12, precioUnidad: bs(110), precioCaja: bs(1250), costoUnidad: bs(85), stockUnidades: 8, stockMinimo: 4 },
  { id: 'smirnoff-750', codigoBarras: '5410316000070', nombre: 'Vodka Smirnoff 750 ml', categoria: 'vodka', unidadesPorCaja: 12, precioUnidad: bs(90), precioCaja: bs(1020), costoUnidad: bs(70), stockUnidades: 5, stockMinimo: 6 },
  { id: 'jw-red', codigoBarras: '5000267000087', nombre: 'Whisky Johnnie Walker Red Label 750 ml', categoria: 'whisky', unidadesPorCaja: 12, precioUnidad: bs(185), precioCaja: bs(2100), costoUnidad: bs(145), stockUnidades: 6, stockMinimo: 3 },
  { id: 'coca-2l', codigoBarras: '7771214000094', nombre: 'Coca-Cola 2 L', categoria: 'gaseosa', unidadesPorCaja: 6, precioUnidad: bs(13), precioCaja: bs(72), costoUnidad: bs(10), stockUnidades: 30, stockMinimo: 12 },
  { id: 'hielo-3kg', codigoBarras: '2000000000109', nombre: 'Bolsa de hielo 3 kg', categoria: 'otros', unidadesPorCaja: 1, precioUnidad: bs(10), precioCaja: bs(10), costoUnidad: bs(5), stockUnidades: 20, stockMinimo: 10 },
];

export function crearInventarioDeEjemplo(): Inventario {
  const inventario = new Inventario();
  for (const producto of catalogoEjemplo) inventario.agregar(producto);
  return inventario;
}
