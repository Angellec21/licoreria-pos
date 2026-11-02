import type { Venta } from '../domain/caja.ts';
import { type DatosNegocio, generarTicket } from '../domain/ticket.ts';

export const NEGOCIO: DatosNegocio = {
  nombre: 'Licorería El Turista',
  nit: '6234519013',
  direccion: 'Av. Busch esq. 3er anillo interno, Santa Cruz de la Sierra',
  telefono: '70012345',
};

export function TicketVista({ venta, onCerrar }: { venta: Venta; onCerrar: () => void }) {
  return (
    <section className="panel ticket" aria-labelledby="titulo-ticket">
      <h2 id="titulo-ticket" className="no-imprimir">
        Venta {venta.id} registrada
      </h2>
      <pre className="ticket-papel">{generarTicket(venta, NEGOCIO).join('\n')}</pre>
      <div className="acciones no-imprimir">
        <button type="button" onClick={() => window.print()}>
          Imprimir ticket
        </button>
        <button type="button" className="boton-primario" onClick={onCerrar} autoFocus>
          Nueva venta
        </button>
      </div>
    </section>
  );
}
