import { useMemo, useState } from 'react';
import { crearInventarioDeEjemplo } from './data/catalogo.ts';
import { formatearBs } from './domain/dinero.ts';

export default function App() {
  const inventario = useMemo(() => crearInventarioDeEjemplo(), []);
  const [busqueda, setBusqueda] = useState('');
  const productos = busqueda.trim() ? inventario.buscar(busqueda) : inventario.listar();
  const alertas = inventario.alertasStockMinimo();

  return (
    <main className="contenedor">
      <header className="encabezado">
        <h1>Licorería POS</h1>
        <p>Catálogo y stock · venta por unidad y por caja</p>
      </header>

      {alertas.length > 0 && (
        <section className="alerta" aria-live="polite">
          <strong>Reponer pronto:</strong>{' '}
          {alertas.map((a) => `${a.nombre} (${a.stockUnidades} u.)`).join(', ')}
        </section>
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

      <table className="tabla">
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col">Unidad</th>
            <th scope="col">Caja</th>
            <th scope="col">Stock</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => {
            const s = inventario.stockDesglosado(p.id);
            return (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{formatearBs(p.precioUnidad)}</td>
                <td>
                  {formatearBs(p.precioCaja)} <small>×{p.unidadesPorCaja}</small>
                </td>
                <td>
                  {s.cajas} cj + {s.sueltas} u.
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
