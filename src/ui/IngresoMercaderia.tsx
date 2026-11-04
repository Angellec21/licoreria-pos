import { type FormEvent, useState } from 'react';
import { formatearBs, parsearBs } from '../domain/dinero.ts';
import type { DatosIngreso } from '../domain/inventario.ts';
import { fechaBolivia } from '../domain/ticket.ts';
import { Mensaje } from './Mensaje.tsx';
import type { PuntoDeVenta } from './usePuntoDeVenta.ts';

type TipoCosto = 'actual' | 'caja' | 'unidad';

function entero(texto: string, campo: string): number {
  const t = texto.trim();
  if (!t) return 0;
  if (!/^\d+$/.test(t)) throw new Error(`${campo}: escriba un número entero`);
  return Number(t);
}

/** Formulario para cargar una compra al distribuidor y ver las últimas compras. */
export function IngresoMercaderia({ pos }: { pos: PuntoDeVenta }) {
  const { inventario } = pos;
  const productos = inventario.listar();
  const [productoId, setProductoId] = useState(productos[0]?.id ?? '');
  const [cajas, setCajas] = useState('');
  const [unidades, setUnidades] = useState('');
  const [tipoCosto, setTipoCosto] = useState<TipoCosto>('actual');
  const [costo, setCosto] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [documento, setDocumento] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string }>();

  const producto = productos.find((p) => p.id === productoId);
  const historial = inventario.historialIngresos().slice(0, 8);
  const sugerencias = inventario.sugerenciaDePedido();

  function registrar(e: FormEvent) {
    e.preventDefault();
    const r = pos.ejecutar(() => {
      const datos: DatosIngreso = {
        cajas: entero(cajas, 'Cajas'),
        unidades: entero(unidades, 'Unidades sueltas'),
        proveedor,
        documento,
      };
      if (tipoCosto === 'caja') datos.costoCaja = parsearBs(costo);
      if (tipoCosto === 'unidad') datos.costoUnidad = parsearBs(costo);
      return inventario.ingresar(productoId, datos);
    });
    if (!r.ok) {
      setMensaje({ tipo: 'error', texto: r.error });
      return;
    }
    const { ingreso, producto: p } = r.valor;
    setMensaje({
      tipo: 'ok',
      texto: `Ingresaron ${ingreso.totalUnidades} u. de ${p.nombre} (${formatearBs(ingreso.totalCosto)}). Stock: ${p.stockUnidades} u.`,
    });
    setCajas('');
    setUnidades('');
    setCosto('');
    setDocumento('');
  }

  return (
    <section className="panel" aria-labelledby="titulo-ingreso">
      <h2 id="titulo-ingreso">Ingreso de mercadería</h2>
      {sugerencias.length > 0 && (
        <div className="alerta">
          <strong>Pedido sugerido al distribuidor:</strong>{' '}
          {sugerencias.map((s) => `${s.nombre}: ${s.cajas} cj`).join(' · ')} — aprox.{' '}
          {formatearBs(sugerencias.reduce((t, s) => t + s.costoEstimado, 0))}
        </div>
      )}
      <form className="ingreso" onSubmit={registrar}>
        <label className="ancho-completo">
          <span>Producto</span>
          <select value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} (caja ×{p.unidadesPorCaja})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Cajas</span>
          <input value={cajas} onChange={(e) => setCajas(e.target.value)} inputMode="numeric" placeholder="0" />
        </label>
        <label>
          <span>Unidades sueltas</span>
          <input value={unidades} onChange={(e) => setUnidades(e.target.value)} inputMode="numeric" placeholder="0" />
        </label>
        <label>
          <span>Costo de la compra</span>
          <select value={tipoCosto} onChange={(e) => setTipoCosto(e.target.value as TipoCosto)}>
            <option value="actual">Igual al actual ({producto ? formatearBs(producto.costoUnidad) : '—'} c/u)</option>
            <option value="caja">Nuevo costo por caja</option>
            <option value="unidad">Nuevo costo por unidad</option>
          </select>
        </label>
        {tipoCosto !== 'actual' && (
          <label>
            <span>Costo por {tipoCosto} (Bs)</span>
            <input value={costo} onChange={(e) => setCosto(e.target.value)} inputMode="decimal" required />
          </label>
        )}
        <label>
          <span>Proveedor</span>
          <input
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Ej.: Distribuidora Norte"
          />
        </label>
        <label>
          <span>Factura / nota N.º</span>
          <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Opcional" />
        </label>
        <div className="ancho-completo">
          {mensaje && <Mensaje tipo={mensaje.tipo}>{mensaje.texto}</Mensaje>}
          <button type="submit" className="boton-primario">
            Registrar ingreso
          </button>
        </div>
      </form>

      {historial.length > 0 && (
        <>
          <h3>Últimas compras</h3>
          <div className="desplazable">
            <table className="tabla compras">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Producto</th>
                  <th scope="col">Cantidad</th>
                  <th scope="col">Total</th>
                  <th scope="col">Proveedor</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((i) => (
                  <tr key={i.id}>
                    <td>{fechaBolivia(i.fecha)}</td>
                    <td>{i.nombre}</td>
                    <td>
                      {i.cajas > 0 && `${i.cajas} cj `}
                      {i.unidades > 0 && `${i.unidades} u.`}
                    </td>
                    <td>{formatearBs(i.totalCosto)}</td>
                    <td>
                      {i.proveedor ?? '—'}
                      {i.documento && <small> · {i.documento}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
