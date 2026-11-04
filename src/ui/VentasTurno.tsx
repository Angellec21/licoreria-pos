import { type FormEvent, useState } from 'react';
import type { MetodoPago, Venta } from '../domain/caja.ts';
import { formatearBs } from '../domain/dinero.ts';
import { fechaBolivia } from '../domain/ticket.ts';
import { Mensaje } from './Mensaje.tsx';
import { TicketVista } from './TicketVista.tsx';
import type { PuntoDeVenta } from './usePuntoDeVenta.ts';

const NOMBRE_METODO: Record<MetodoPago, string> = { efectivo: 'Efectivo', qr: 'QR', tarjeta: 'Tarjeta' };
const MOTIVOS = ['Error de digitación', 'Cliente desistió', 'Cobro duplicado', 'Producto en mal estado'];

function hora(iso: string): string {
  return fechaBolivia(iso).slice(-5);
}

function articulos(v: Venta): string {
  return v.lineas.map((l) => `${l.cantidad}${l.presentacion === 'caja' ? ' cj' : ''} ${l.nombre}`).join(', ');
}

/** Ventas del turno abierto: reimprimir ticket y anular con motivo. */
export function VentasTurno({ pos }: { pos: PuntoDeVenta }) {
  const turno = pos.caja.turnoActual();
  const [ticket, setTicket] = useState<Venta>();
  const [anulando, setAnulando] = useState<string>();
  const [motivo, setMotivo] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string }>();

  if (!turno) return <Mensaje tipo="aviso">No hay turno abierto: abra la caja en la pestaña Cobro.</Mensaje>;
  if (ticket) {
    return (
      <TicketVista
        venta={ticket}
        titulo={`Copia del ticket ${ticket.id}`}
        textoCerrar="Volver a las ventas"
        onCerrar={() => setTicket(undefined)}
      />
    );
  }

  const ventas = pos.caja.ventasDelTurno(turno.id).reverse();
  const resumen = pos.caja.resumenTurno();

  function anular(e: FormEvent, venta: Venta) {
    e.preventDefault();
    const r = pos.ejecutar(() => pos.caja.anularVenta(venta.id, motivo));
    if (r.ok) {
      setMensaje({ tipo: 'ok', texto: `Venta ${venta.id} anulada; los productos volvieron al stock.` });
      setAnulando(undefined);
      setMotivo('');
    } else {
      setMensaje({ tipo: 'error', texto: r.error });
    }
  }

  return (
    <section className="panel" aria-labelledby="titulo-ventas">
      <h2 id="titulo-ventas">
        Ventas del turno {turno.id} · {turno.cajero}
      </h2>
      <p>
        {resumen.cantidadVentas} {resumen.cantidadVentas === 1 ? 'venta válida' : 'ventas válidas'} por{' '}
        <strong>{formatearBs(resumen.total)}</strong>
        {resumen.cantidadAnuladas > 0 &&
          ` · ${resumen.cantidadAnuladas} ${resumen.cantidadAnuladas === 1 ? 'anulada' : 'anuladas'}`}
      </p>
      {mensaje && <Mensaje tipo={mensaje.tipo}>{mensaje.texto}</Mensaje>}
      {ventas.length === 0 ? (
        <p className="vacio">Todavía no hay ventas en este turno.</p>
      ) : (
        <ul className="lista-ventas">
          {ventas.map((v) => (
            <li key={v.id} className={v.anulada ? 'anulada' : undefined}>
              <div className="venta-cabecera">
                <strong>{v.id}</strong>
                <span>{hora(v.fecha)}</span>
                <span>{NOMBRE_METODO[v.metodoPago]}</span>
                <strong className="venta-total">{formatearBs(v.total)}</strong>
              </div>
              <p className="venta-detalle">{articulos(v)}</p>
              {v.anulada ? (
                <p className="venta-detalle">
                  <strong>Anulada</strong>
                  {v.fechaAnulacion && ` a las ${hora(v.fechaAnulacion)}`}: {v.motivoAnulacion}
                </p>
              ) : anulando === v.id ? (
                <form className="form-anular" onSubmit={(e) => anular(e, v)}>
                  <label>
                    <span>Motivo de la anulación</span>
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      list="motivos-anulacion"
                      required
                      autoFocus
                    />
                  </label>
                  <div className="acciones">
                    <button type="button" onClick={() => setAnulando(undefined)}>
                      Cancelar
                    </button>
                    <button type="submit" className="boton-peligro">
                      Confirmar anulación
                    </button>
                  </div>
                </form>
              ) : null}
              <div className="acciones">
                <button type="button" onClick={() => setTicket(v)}>
                  Ver ticket
                </button>
                {!v.anulada && anulando !== v.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setAnulando(v.id);
                      setMotivo('');
                      setMensaje(undefined);
                    }}
                  >
                    Anular
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <datalist id="motivos-anulacion">
        {MOTIVOS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </section>
  );
}
