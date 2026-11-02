import { type FormEvent, useState } from 'react';
import type { ResumenTurno } from '../domain/caja.ts';
import { formatearBs, parsearBs } from '../domain/dinero.ts';
import { Mensaje } from './Mensaje.tsx';
import type { PuntoDeVenta } from './usePuntoDeVenta.ts';

function TablaResumen({ r }: { r: ResumenTurno }) {
  const filas: [string, string][] = [
    ['Ventas', String(r.cantidadVentas)],
    ['Anuladas', String(r.cantidadAnuladas)],
    ['Efectivo', formatearBs(r.porMetodo.efectivo)],
    ['QR', formatearBs(r.porMetodo.qr)],
    ['Tarjeta', formatearBs(r.porMetodo.tarjeta)],
    ['Total vendido', formatearBs(r.total)],
    ['Margen bruto', formatearBs(r.margen)],
    ['Efectivo esperado en cajón', formatearBs(r.efectivoEsperado)],
  ];
  if (r.montoContado !== undefined) filas.push(['Efectivo contado', formatearBs(r.montoContado)]);
  return (
    <table className="tabla resumen">
      <tbody>
        {filas.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CierreTurno({ pos, onCerrado }: { pos: PuntoDeVenta; onCerrado: () => void }) {
  const [contado, setContado] = useState('');
  const [error, setError] = useState('');
  const [cierre, setCierre] = useState<ResumenTurno>();
  const turno = pos.caja.turnoActual();

  if (cierre) {
    const d = cierre.diferencia ?? 0;
    return (
      <section className="panel" aria-labelledby="titulo-cierre">
        <h2 id="titulo-cierre">Turno {cierre.turnoId} cerrado</h2>
        <TablaResumen r={cierre} />
        {d === 0 ? (
          <Mensaje tipo="ok">La caja cuadra.</Mensaje>
        ) : (
          <Mensaje tipo={d < 0 ? 'error' : 'aviso'}>
            {d < 0 ? `Faltante de ${formatearBs(-d)}` : `Sobrante de ${formatearBs(d)}`} a cargo de {cierre.cajero}.
          </Mensaje>
        )}
        <button type="button" className="boton-primario" onClick={onCerrado}>
          Abrir un nuevo turno
        </button>
      </section>
    );
  }

  if (!turno) return <Mensaje tipo="aviso">No hay turno abierto.</Mensaje>;
  const resumen = pos.caja.resumenTurno();

  function cerrar(e: FormEvent) {
    e.preventDefault();
    const r = pos.ejecutar(() => pos.caja.cerrarTurno(parsearBs(contado)));
    if (r.ok) setCierre(r.valor);
    else setError(r.error);
  }

  return (
    <section className="panel" aria-labelledby="titulo-arqueo">
      <h2 id="titulo-arqueo">
        Arqueo del turno {turno.id} · {turno.cajero}
      </h2>
      <TablaResumen r={resumen} />
      <form onSubmit={cerrar} className="cierre">
        <label>
          <span>Efectivo contado en el cajón (Bs)</span>
          <input value={contado} onChange={(e) => setContado(e.target.value)} inputMode="decimal" required />
        </label>
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <button type="submit" className="boton-primario">
          Cerrar turno
        </button>
      </form>
    </section>
  );
}
