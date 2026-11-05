import { type ChangeEvent, useRef, useState } from 'react';
import { fechaBolivia } from '../domain/ticket.ts';
import { Mensaje } from './Mensaje.tsx';
import type { EstadoGuardadoUI, PuntoDeVenta } from './usePuntoDeVenta.ts';

/** Texto corto del estado de guardado para el encabezado. */
export function textoGuardado(g: EstadoGuardadoUI): string {
  if (g.tipo === 'memoria') return 'Sin guardado: este navegador no permite guardar datos';
  if (g.tipo === 'error') return 'No se pudo guardar el último cambio';
  return g.hora ? `Guardado ${fechaBolivia(g.hora)}` : 'Guardado en este navegador';
}

function nombreArchivo(): string {
  const hoy = fechaBolivia(new Date().toISOString()).slice(0, 10).split('/').reverse().join('-');
  return `licoreria-respaldo-${hoy}.json`;
}

/**
 * Respaldo de datos: descargar todo en un archivo, restaurarlo (por ejemplo en
 * otra computadora) o volver a los datos de ejemplo.
 */
export function RespaldoDatos({ pos }: { pos: PuntoDeVenta }) {
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string }>();
  const archivo = useRef<HTMLInputElement>(null);

  function descargar() {
    const blob = new Blob([pos.exportarRespaldo()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo();
    a.click();
    URL.revokeObjectURL(url);
    setMensaje({ tipo: 'ok', texto: `Respaldo descargado (${a.download}). Guárdelo en una memoria USB o en la nube.` });
  }

  async function restaurar(ev: ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    if (!window.confirm('Se reemplazarán el inventario, los turnos y las ventas actuales por los del respaldo. ¿Continuar?')) {
      return;
    }
    try {
      pos.importarRespaldo(await f.text());
      setMensaje({ tipo: 'ok', texto: `Datos restaurados desde ${f.name}.` });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se restauró nada: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  function restablecer() {
    const turno = pos.caja.turnoActual();
    const aviso = turno
      ? `Hay un turno abierto (${turno.cajero}). Se perderán sus ventas y todo lo guardado. ¿Volver a los datos de ejemplo?`
      : 'Se borrarán el inventario, los turnos y las ventas guardados en este navegador. ¿Volver a los datos de ejemplo?';
    if (!window.confirm(aviso)) return;
    pos.restablecer();
    setMensaje({ tipo: 'ok', texto: 'Se cargaron los datos de ejemplo.' });
  }

  return (
    <section className="panel respaldo no-imprimir" aria-labelledby="titulo-respaldo">
      <h2 id="titulo-respaldo">Datos y respaldo</h2>
      <p>
        Todo se guarda solo en este navegador después de cada venta, anulación, ingreso o cierre: si se corta la luz
        o se recarga la página, el turno sigue donde quedó. {textoGuardado(pos.guardado)}.
      </p>
      {pos.guardado.tipo === 'error' && <Mensaje tipo="error">{pos.guardado.mensaje}</Mensaje>}
      {pos.guardado.tipo === 'memoria' && (
        <Mensaje tipo="aviso">
          El navegador está en modo privado o bloquea el guardado: los datos se pierden al cerrar la pestaña.
          Descargue un respaldo antes de salir.
        </Mensaje>
      )}
      <div className="acciones-respaldo">
        <button type="button" className="boton-primario" onClick={descargar}>
          Descargar respaldo
        </button>
        <button type="button" onClick={() => archivo.current?.click()}>
          Restaurar desde archivo…
        </button>
        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          className="solo-lector"
          tabIndex={-1}
          aria-hidden="true"
          onChange={restaurar}
        />
        <button type="button" className="boton-peligro" onClick={restablecer}>
          Volver a datos de ejemplo
        </button>
      </div>
      {mensaje && <Mensaje tipo={mensaje.tipo}>{mensaje.texto}</Mensaje>}
    </section>
  );
}
