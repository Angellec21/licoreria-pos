import { useState } from 'react';
import { formatearBs } from '../domain/dinero.ts';
import { fechaHoraLocal, fechaInicialReporte, fechasConVentas, reporteACsv, reporteDiario } from '../domain/reporte.ts';
import { Mensaje } from './Mensaje.tsx';
import type { PuntoDeVenta } from './usePuntoDeVenta.ts';

const NOMBRE_METODO = { efectivo: 'Efectivo', qr: 'QR', tarjeta: 'Tarjeta' } as const;

function descargarCsv(nombre: string, contenido: string) {
  // BOM para que Excel reconozca las tildes (UTF-8).
  const blob = new Blob(['﻿', contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Reporte del día para el dueño: ventas, margen, hora pico, ranking y cajeros. */
export function VistaReporte({ pos }: { pos: PuntoDeVenta }) {
  const ventas = pos.caja.todasLasVentas();
  const hoy = fechaHoraLocal(new Date().toISOString()).fecha;
  const fechas = [...new Set([hoy, ...fechasConVentas(ventas)])].sort().reverse();
  const [fecha, setFecha] = useState(() => fechaInicialReporte(ventas, hoy));
  const r = reporteDiario(ventas, pos.inventario, fecha);
  const maxHora = Math.max(1, ...r.porHora.map((h) => h.total));

  const tarjetas: [string, string][] = [
    ['Total vendido', formatearBs(r.total)],
    ['Margen bruto', `${formatearBs(r.margen)} (${r.margenPorcentaje.toLocaleString('es-BO')} %)`],
    ['Ventas', String(r.cantidadVentas)],
    ['Ticket promedio', formatearBs(r.ticketPromedio)],
  ];

  return (
    <section className="panel reporte" aria-labelledby="titulo-reporte">
      <div className="reporte-cabecera">
        <h2 id="titulo-reporte">Reporte del día</h2>
        <div className="reporte-acciones no-imprimir">
          <label>
            <span className="solo-lector">Fecha del reporte</span>
            <select value={fecha} onChange={(e) => setFecha(e.target.value)}>
              {fechas.map((f) => (
                <option key={f} value={f}>
                  {f === hoy ? `Hoy (${f})` : f}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => descargarCsv(`reporte-${fecha}.csv`, reporteACsv(r))} disabled={r.cantidadVentas === 0}>
            Descargar CSV
          </button>
          <button type="button" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </div>

      {r.cantidadVentas === 0 ? (
        <Mensaje tipo="aviso">Todavía no hay ventas registradas el {fecha}.</Mensaje>
      ) : (
        <>
          <dl className="kpis">
            {tarjetas.map(([k, v]) => (
              <div key={k} className="kpi">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          {(r.cantidadAnuladas > 0 || r.porReponer > 0) && (
            <div className="alerta" aria-live="polite">
              {r.cantidadAnuladas > 0 && (
                <p>
                  <strong>{r.cantidadAnuladas} venta(s) anulada(s)</strong> por {formatearBs(r.montoAnulado)}: revise los motivos.
                </p>
              )}
              {r.porReponer > 0 && (
                <p>
                  <strong>{r.porReponer} producto(s)</strong> en o bajo el stock mínimo: ver Inventario.
                </p>
              )}
            </div>
          )}

          <h3>Ventas por hora</h3>
          {r.horaPico && (
            <p>
              Hora pico: <strong>{String(r.horaPico.hora).padStart(2, '0')}:00</strong> con {formatearBs(r.horaPico.total)}.
            </p>
          )}
          <ul className="barras" aria-label="Ventas por hora">
            {r.porHora.map((h) => (
              <li key={h.hora}>
                <span className="barra-etiqueta">{String(h.hora).padStart(2, '0')}:00</span>
                <span className="barra-pista">
                  <span className="barra" style={{ width: `${(h.total / maxHora) * 100}%` }} />
                </span>
                <span className="barra-valor">
                  {formatearBs(h.total)} <small>({h.cantidad})</small>
                </span>
              </li>
            ))}
          </ul>

          <div className="reporte-columnas">
            <div>
              <h3>Más vendidos</h3>
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col">Unid.</th>
                    <th scope="col">Ingresos</th>
                    <th scope="col">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {r.masVendidos.map((p) => (
                    <tr key={p.productoId}>
                      <td>{p.nombre}</td>
                      <td>{p.unidades}</td>
                      <td>{formatearBs(p.ingresos)}</td>
                      <td>{formatearBs(p.margen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3>Margen por categoría</h3>
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">Categoría</th>
                    <th scope="col">Ingresos</th>
                    <th scope="col">Margen</th>
                    <th scope="col">%</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porCategoria.map((c) => (
                    <tr key={c.categoria}>
                      <td className="capitalizar">{c.categoria}</td>
                      <td>{formatearBs(c.ingresos)}</td>
                      <td>{formatearBs(c.margen)}</td>
                      <td>{c.margenPorcentaje.toLocaleString('es-BO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3>Cobros por método</h3>
              <table className="tabla">
                <tbody>
                  {(Object.keys(NOMBRE_METODO) as (keyof typeof NOMBRE_METODO)[]).map((m) => (
                    <tr key={m}>
                      <th scope="row">{NOMBRE_METODO[m]}</th>
                      <td>{formatearBs(r.porMetodo[m])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3>Por cajero</h3>
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">Cajero</th>
                    <th scope="col">Ventas</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porCajero.map((c) => (
                    <tr key={c.cajero}>
                      <td>{c.cajero}</td>
                      <td>{c.cantidadVentas}</td>
                      <td>{formatearBs(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
