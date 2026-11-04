import { useState } from 'react';
import { formatearBs } from './domain/dinero.ts';
import { AperturaTurno } from './ui/AperturaTurno.tsx';
import { CierreTurno } from './ui/CierreTurno.tsx';
import { PantallaCobro } from './ui/PantallaCobro.tsx';
import { VistaInventario } from './ui/VistaInventario.tsx';
import { VentasTurno } from './ui/VentasTurno.tsx';
import { VistaReporte } from './ui/VistaReporte.tsx';
import { usePuntoDeVenta } from './ui/usePuntoDeVenta.ts';

type Vista = 'cobro' | 'ventas' | 'inventario' | 'cierre' | 'reporte';
const VISTAS: { id: Vista; nombre: string }[] = [
  { id: 'cobro', nombre: 'Cobro' },
  { id: 'ventas', nombre: 'Ventas del turno' },
  { id: 'inventario', nombre: 'Inventario' },
  { id: 'cierre', nombre: 'Cierre de caja' },
  { id: 'reporte', nombre: 'Reporte del día' },
];

export default function App() {
  const pos = usePuntoDeVenta();
  const [vista, setVista] = useState<Vista>('cobro');
  const turno = pos.caja.turnoActual();
  const resumen = turno ? pos.caja.resumenTurno() : undefined;

  return (
    <main className="contenedor">
      <header className="encabezado no-imprimir">
        <div>
          <h1>Licorería POS</h1>
          <p>
            {turno
              ? `Turno ${turno.id} · ${turno.cajero} · ${resumen?.cantidadVentas ?? 0} ventas · ${formatearBs(resumen?.total ?? 0)}`
              : 'Caja cerrada'}
          </p>
        </div>
        <nav aria-label="Secciones">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={vista === v.id ? 'pestana activa' : 'pestana'}
              aria-current={vista === v.id ? 'page' : undefined}
              onClick={() => setVista(v.id)}
            >
              {v.nombre}
            </button>
          ))}
        </nav>
      </header>

      {vista === 'inventario' && <VistaInventario pos={pos} />}
      {vista === 'cobro' && (turno ? <PantallaCobro pos={pos} /> : <AperturaTurno pos={pos} />)}
      {vista === 'ventas' && <VentasTurno pos={pos} />}
      {vista === 'reporte' && <VistaReporte pos={pos} />}
      {vista === 'cierre' && <CierreTurno pos={pos} onCerrado={() => setVista('cobro')} />}
    </main>
  );
}
