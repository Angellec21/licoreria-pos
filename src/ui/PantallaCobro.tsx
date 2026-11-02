import { type FormEvent, useMemo, useRef, useState } from 'react';
import { METODOS_PAGO, type MetodoPago, type Venta } from '../domain/caja.ts';
import {
  CARRITO_VACIO,
  type Carrito,
  agregarAlCarrito,
  alternarPresentacion,
  cambiarCantidad,
  convertirACajas,
  escanear,
  quitarDelCarrito,
  resumirCarrito,
  sugerenciasDeCaja,
} from '../domain/carrito.ts';
import { formatearBs, parsearBs } from '../domain/dinero.ts';
import { Mensaje } from './Mensaje.tsx';
import { TicketVista } from './TicketVista.tsx';
import type { PuntoDeVenta } from './usePuntoDeVenta.ts';

const NOMBRE_METODO: Record<MetodoPago, string> = { efectivo: 'Efectivo', qr: 'QR', tarjeta: 'Tarjeta' };

export function PantallaCobro({ pos }: { pos: PuntoDeVenta }) {
  const { inventario, caja } = pos;
  const [carrito, setCarrito] = useState<Carrito>(CARRITO_VACIO);
  const [codigo, setCodigo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [recibido, setRecibido] = useState('');
  const [error, setError] = useState('');
  const [ultimaVenta, setUltimaVenta] = useState<Venta>();
  const campoCodigo = useRef<HTMLInputElement>(null);

  // pos.version cambia tras cada venta: el resumen se recalcula con el stock nuevo.
  const resumen = useMemo(() => resumirCarrito(carrito, inventario), [carrito, inventario, pos.version]);
  const sugerencias = useMemo(() => sugerenciasDeCaja(carrito, inventario), [carrito, inventario]);
  const resultados = busqueda.trim() ? inventario.buscar(busqueda).slice(0, 6) : [];

  let recibidoCentavos: number | undefined;
  try {
    recibidoCentavos = recibido.trim() ? parsearBs(recibido) : undefined;
  } catch {
    recibidoCentavos = undefined;
  }
  const cambio = recibidoCentavos !== undefined ? recibidoCentavos - resumen.total : undefined;

  function intentar(fn: () => Carrito) {
    try {
      setCarrito(fn());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onEscanear(e: FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    intentar(() => escanear(carrito, inventario, codigo).carrito);
    setCodigo('');
  }

  function cobrar() {
    if (metodo === 'efectivo' && recibido.trim() && recibidoCentavos === undefined) {
      setError(`Monto recibido inválido: ${recibido}`);
      return;
    }
    const r = pos.ejecutar(() =>
      caja.vender([...carrito], { metodo, ...(metodo === 'efectivo' && { recibido: recibidoCentavos }) }),
    );
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setUltimaVenta(r.valor);
    setCarrito(CARRITO_VACIO);
    setRecibido('');
    setMetodo('efectivo');
    setError('');
  }

  if (ultimaVenta) {
    return (
      <TicketVista
        venta={ultimaVenta}
        onCerrar={() => {
          setUltimaVenta(undefined);
          setTimeout(() => campoCodigo.current?.focus());
        }}
      />
    );
  }

  return (
    <div className="cobro">
      <section className="panel" aria-labelledby="titulo-carrito">
        <h2 id="titulo-carrito">Venta</h2>

        <form onSubmit={onEscanear} className="escaner">
          <label>
            <span>Código de barras</span>
            <input
              ref={campoCodigo}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Escanee o escriba · 3*código · c*código = caja"
              autoFocus
              autoComplete="off"
            />
          </label>
          <button type="submit">Agregar</button>
        </form>

        <label className="buscador">
          <span>Buscar por nombre</span>
          <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej.: Paceña, singani…" />
        </label>
        {resultados.length > 0 && (
          <ul className="resultados">
            {resultados.map((p) => (
              <li key={p.id}>
                <span>
                  {p.nombre} <small>({p.stockUnidades} u.)</small>
                </span>
                <span className="acciones">
                  <button type="button" onClick={() => intentar(() => agregarAlCarrito(carrito, p.id, 'unidad'))}>
                    + Unidad {formatearBs(p.precioUnidad)}
                  </button>
                  {p.unidadesPorCaja > 1 && (
                    <button type="button" onClick={() => intentar(() => agregarAlCarrito(carrito, p.id, 'caja'))}>
                      + Caja ×{p.unidadesPorCaja} {formatearBs(p.precioCaja)}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {error && <Mensaje tipo="error">{error}</Mensaje>}

        {resumen.lineas.length === 0 ? (
          <p className="vacio">El carrito está vacío. Escanee un producto para empezar.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Cant.</th>
                <th scope="col">Precio</th>
                <th scope="col">Subtotal</th>
                <th scope="col">
                  <span className="solo-lector">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {resumen.lineas.map((l) => (
                <tr key={`${l.productoId}-${l.presentacion}`}>
                  <td>
                    {l.nombre}
                    <br />
                    <small>{l.presentacion === 'caja' ? `Caja ×${l.unidadesPorCaja}` : 'Unidad'}</small>
                  </td>
                  <td>
                    <input
                      className="cantidad"
                      type="number"
                      min={0}
                      value={l.cantidad}
                      aria-label={`Cantidad de ${l.nombre}`}
                      onChange={(e) =>
                        intentar(() => cambiarCantidad(carrito, l.productoId, l.presentacion, Number(e.target.value)))
                      }
                    />
                  </td>
                  <td>{formatearBs(l.precioUnitario)}</td>
                  <td>{formatearBs(l.subtotal)}</td>
                  <td className="acciones">
                    {l.unidadesPorCaja > 1 && (
                      <button
                        type="button"
                        onClick={() => intentar(() => alternarPresentacion(carrito, l.productoId, l.presentacion))}
                      >
                        {l.presentacion === 'unidad' ? 'Pasar a caja' : 'Pasar a unidad'}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Quitar ${l.nombre}`}
                      onClick={() => intentar(() => quitarDelCarrito(carrito, l.productoId, l.presentacion))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sugerencias.map((s) => (
          <Mensaje tipo="aviso" key={s.productoId}>
            {s.nombre}: el cliente ahorra {formatearBs(s.ahorro)} si lleva {s.cajas} caja(s) cerrada(s).{' '}
            <button type="button" onClick={() => intentar(() => convertirACajas(carrito, inventario, s.productoId))}>
              Aplicar
            </button>
          </Mensaje>
        ))}
        {resumen.sinStock.map((s) => (
          <Mensaje tipo="error" key={s.productoId}>
            Sin stock suficiente de {s.nombre}: se piden {s.pedido} u., hay {s.disponible} u.
          </Mensaje>
        ))}
      </section>

      <aside className="panel pago" aria-labelledby="titulo-pago">
        <h2 id="titulo-pago">Cobro</h2>
        <p className="total">
          <span>Total</span> <strong>{formatearBs(resumen.total)}</strong>
        </p>
        <fieldset>
          <legend>Método de pago</legend>
          {METODOS_PAGO.map((m) => (
            <label key={m} className="opcion">
              <input type="radio" name="metodo" value={m} checked={metodo === m} onChange={() => setMetodo(m)} />
              {NOMBRE_METODO[m]}
            </label>
          ))}
        </fieldset>
        {metodo === 'efectivo' && (
          <label>
            <span>Recibido (Bs)</span>
            <input
              value={recibido}
              onChange={(e) => setRecibido(e.target.value)}
              inputMode="decimal"
              placeholder={formatearBs(resumen.total)}
            />
          </label>
        )}
        {metodo === 'efectivo' && cambio !== undefined && (
          <p className={cambio < 0 ? 'cambio falta' : 'cambio'}>
            {cambio < 0 ? `Faltan ${formatearBs(-cambio)}` : `Cambio: ${formatearBs(cambio)}`}
          </p>
        )}
        <button
          type="button"
          className="boton-primario boton-grande"
          onClick={cobrar}
          disabled={resumen.lineas.length === 0 || resumen.sinStock.length > 0}
        >
          Cobrar {formatearBs(resumen.total)}
        </button>
        {resumen.lineas.length > 0 && (
          <button type="button" onClick={() => setCarrito(CARRITO_VACIO)}>
            Vaciar carrito
          </button>
        )}
      </aside>
    </div>
  );
}
