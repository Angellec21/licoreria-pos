import { useState } from 'react';
import { formatearBs } from '../domain/dinero.ts';
import { IngresoMercaderia } from './IngresoMercaderia.tsx';
import type { PuntoDeVenta } from './usePuntoDeVenta.ts';

export function VistaInventario({ pos }: { pos: PuntoDeVenta }) {
  const { inventario } = pos;
  const [busqueda, setBusqueda] = useState('');
  const productos = busqueda.trim() ? inventario.buscar(busqueda) : inventario.listar();
  const alertas = inventario.alertasStockMinimo();

  return (
    <div className="pila">
      <section className="panel" aria-labelledby="titulo-inventario">
        <h2 id="titulo-inventario">Inventario</h2>
        <p>
          Valor a costo: <strong>{formatearBs(inventario.valorACosto())}</strong>
        </p>
        {alertas.length > 0 && (
          <div className="alerta" aria-live="polite">
            <strong>Reponer pronto:</strong> {alertas.map((a) => `${a.nombre} (${a.stockUnidades} u.)`).join(', ')}
          </div>
        )}
        <label className="buscador">
          <span>Buscar producto o código de barras</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej.: Paceña, singani, 7771609…"
          />
        </label>
        <div className="desplazable">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Unidad</th>
                <th scope="col">Caja</th>
                <th scope="col">Stock</th>
                <th scope="col">Costo</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const s = inventario.stockDesglosado(p.id);
                return (
                  <tr key={p.id} className={p.stockUnidades <= p.stockMinimo ? 'bajo' : undefined}>
                    <td>{p.nombre}</td>
                    <td>{formatearBs(p.precioUnidad)}</td>
                    <td>
                      {formatearBs(p.precioCaja)} <small>×{p.unidadesPorCaja}</small>
                    </td>
                    <td>
                      {s.cajas} cj + {s.sueltas} u.
                    </td>
                    <td>{formatearBs(p.costoUnidad)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <IngresoMercaderia pos={pos} />
    </div>
  );
}
