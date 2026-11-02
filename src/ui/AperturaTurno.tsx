import { type FormEvent, useState } from 'react';
import { parsearBs } from '../domain/dinero.ts';
import { Mensaje } from './Mensaje.tsx';
import type { PuntoDeVenta } from './usePuntoDeVenta.ts';

export function AperturaTurno({ pos }: { pos: PuntoDeVenta }) {
  const [cajero, setCajero] = useState('');
  const [monto, setMonto] = useState('200');
  const [error, setError] = useState('');

  function abrir(e: FormEvent) {
    e.preventDefault();
    const r = pos.ejecutar(() => pos.caja.abrirTurno(cajero, parsearBs(monto)));
    setError(r.ok ? '' : r.error);
  }

  return (
    <form className="panel apertura" onSubmit={abrir} aria-labelledby="titulo-apertura">
      <h2 id="titulo-apertura">Abrir caja</h2>
      <p>Registre quién atiende y con cuánto efectivo empieza el cajón (cambio).</p>
      <label>
        <span>Cajero</span>
        <input value={cajero} onChange={(e) => setCajero(e.target.value)} placeholder="Ej.: Rosa Vaca" required autoFocus />
      </label>
      <label>
        <span>Monto inicial (Bs)</span>
        <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" required />
      </label>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <button type="submit" className="boton-primario">
        Abrir turno
      </button>
    </form>
  );
}
