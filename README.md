# 🍾 Licorería POS

[![CI](https://github.com/Angellec21/licoreria-pos/actions/workflows/ci.yml/badge.svg)](https://github.com/Angellec21/licoreria-pos/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-pruebas-6E9F18?logo=vitest&logoColor=white)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)

Punto de venta para **licorerías de barrio** en Santa Cruz de la Sierra (Bolivia): caja por turnos con apertura y cierre, venta **por unidad y por caja**, control de stock y reporte diario para el dueño. Todos los montos en **bolivianos (Bs)**.

> 🚧 **En desarrollo.** Ya se puede atender el mostrador de punta a punta: abrir la caja, cobrar con lector de código de barras, imprimir el ticket y cerrar el turno con arqueo. El reporte diario del dueño y el guardado de datos llegan en las próximas versiones.

## El problema

Una licorería vende lo mismo de dos formas: la botella suelta de Paceña a Bs 15 y la caja de 12 a Bs 160. Cuando eso se anota en un cuaderno o en una planilla aparecen los problemas de siempre:

- El stock no cuadra porque se mezclan cajas y unidades sueltas.
- Al cierre de la noche nadie sabe cuánto efectivo *debería* haber en el cajón, ni de quién es el faltante.
- No se sabe qué productos dejan más margen ni cuándo hay que pedir al distribuidor.
- Las anulaciones "de palabra" no dejan rastro.

**Licorería POS** guarda el stock siempre en unidades, cobra cada presentación con su propio precio y obliga a abrir y cerrar la caja por turno, con arqueo.

## Funcionalidades

### Disponibles

- **Catálogo** con código de barras, categoría (cerveza, singani, vino, fernet, ron…), precio por unidad, precio por caja y costo.
- **Venta por unidad o por caja**: la caja se descuenta como *N* unidades del stock; se valida que el precio de la caja no supere al de sus unidades sueltas.
- **Stock desglosado** (p. ej. *8 cajas + 0 u.*) e **ingresos de mercadería** en cajas y sueltas.
- **Alertas de reposición** cuando un producto llega a su stock mínimo.
- **Turnos de caja**: apertura con cajero y monto inicial; no se puede vender con la caja cerrada ni abrir dos turnos a la vez.
- **Ventas todo o nada** con efectivo (calcula el cambio), QR o tarjeta: si falta stock de un producto, no se descuenta ninguno.
- **Anulaciones con motivo**, solo dentro del turno abierto, devolviendo el stock.
- **Arqueo de cierre**: total por método de pago, costo, margen, efectivo esperado y **faltante o sobrante**.
- **Valor del inventario** a costo de compra.
- **Pantalla de cobro** pensada para el mostrador:
  - **Lector de código de barras** (funciona con cualquier lector USB que "teclea" el código y Enter). Atajos: `3*código` vende 3 unidades, `c*código` una caja y `2c*código` dos cajas.
  - Búsqueda por nombre (sin importar tildes) con botones *+ Unidad* y *+ Caja*.
  - Carrito editable: cambiar cantidad, quitar líneas y pasar de unidad a caja.
  - **Sugerencia de ahorro**: si el cliente lleva 13 latas sueltas, avisa que con 2 packs + 1 lata paga Bs 12 menos y lo aplica con un clic.
  - Aviso y bloqueo del cobro si el pedido supera el stock.
  - Cobro en efectivo con **cálculo de cambio** en vivo, QR o tarjeta.
- **Ticket imprimible** para impresora térmica de 58 mm (o 80 mm) con NIT, cajero, detalle por unidad/caja, cambio, hora de Bolivia y la leyenda de venta prohibida a menores.
- **Cierre de caja desde la interfaz**: resumen del turno por método de pago, margen, efectivo esperado y faltante o sobrante del cajero.

### Roadmap

- [x] Catálogo, stock por unidad/caja y alertas de mínimo
- [x] Caja por turnos, ventas, anulaciones y arqueo
- [x] Pantalla de cobro: carrito, lector de código de barras y ticket
- [x] Apertura y cierre de turno desde la interfaz
- [ ] Reporte diario del dueño: ventas por hora, más vendidos, margen por categoría
- [ ] Ingreso de mercadería desde la interfaz
- [ ] Guardado en el navegador (los datos sobreviven a recargar la página)
- [ ] Versión 1.0.0

## Tecnologías

| Capa | Herramienta |
|---|---|
| Lenguaje | TypeScript 5.9 en modo estricto |
| Interfaz | React 19 |
| Build y servidor de desarrollo | Vite 7 |
| Pruebas | Vitest |
| Integración continua | GitHub Actions (Node 20, 22 y 24) |

## Arquitectura

La lógica del negocio vive en `src/domain`, en TypeScript puro y sin depender de React. Así se prueba de forma aislada y la interfaz solo la consume.

```
src/
├── domain/
│   ├── dinero.ts        # Montos en centavos y formato "Bs 1.234,50"
│   ├── inventario.ts    # Productos, presentaciones (unidad/caja), stock y alertas
│   ├── caja.ts          # Turnos, ventas, anulaciones y arqueo
│   ├── carrito.ts       # Carrito inmutable, escaneo y sugerencias de caja
│   └── ticket.ts        # Ticket de texto para impresora térmica
├── data/
│   └── catalogo.ts      # Catálogo de ejemplo de una licorería de Santa Cruz
├── ui/
│   ├── usePuntoDeVenta.ts  # Hook que conecta el dominio con React
│   ├── AperturaTurno.tsx   # Abrir caja
│   ├── PantallaCobro.tsx   # Escaneo, carrito y cobro
│   ├── TicketVista.tsx     # Vista previa e impresión del ticket
│   ├── CierreTurno.tsx     # Arqueo y cierre
│   └── VistaInventario.tsx # Stock y alertas
├── App.tsx              # Navegación entre secciones
└── main.tsx
```

Decisiones de diseño:

- **Montos en centavos (enteros)**: `0,1 + 0,2` nunca da `0,30000000000000004` en un cierre de caja.
- **Stock siempre en unidades**: la caja es solo una forma de vender; así el stock nunca se "parte".
- **Ventas todo o nada**: primero se valida todo el pedido (sumando líneas del mismo producto) y recién después se descuenta.
- **Reloj inyectable** en `Caja`: las pruebas controlan la fecha y hora de apertura, ventas y cierre.
- **Encapsulamiento**: el inventario devuelve copias; nadie puede modificar el stock sin pasar por las reglas.
- **Carrito inmutable y sin precios guardados**: cada cambio crea un carrito nuevo (React lo detecta solo) y los precios se leen del inventario al cobrar, así nunca se cobra un precio viejo.
- **La interfaz no tiene reglas de negocio**: `usePuntoDeVenta` ejecuta las operaciones del dominio y muestra el mensaje de error que estas lanzan.

## Instalación

Requisitos: Node.js 20.19 o superior.

```bash
git clone https://github.com/Angellec21/licoreria-pos.git
cd licoreria-pos
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm test` | Ejecuta las pruebas (Vitest) |
| `npm run build` | Verifica tipos y genera la versión de producción en `dist/` |
| `npm run preview` | Sirve la versión de producción |

## Uso en el mostrador

1. **Abrir caja**: nombre del cajero y efectivo inicial (p. ej. Bs 200 de cambio).
2. **Cobro**: escanee los productos o búsquelos por nombre. Con el lector, `c*` antes del código vende la caja cerrada.
3. Elija el método de pago; en efectivo escriba lo recibido y la pantalla muestra el cambio.
4. **Cobrar** → aparece el ticket listo para imprimir.
5. **Cierre de caja**: cuente el efectivo del cajón; el sistema indica si la caja cuadra o si hay faltante/sobrante.

> Por ahora los datos viven en memoria y se reinician al recargar la página; el guardado en el navegador está en el roadmap.

## Uso de la lógica de negocio

```ts
import { crearInventarioDeEjemplo } from './src/data/catalogo';
import { Caja } from './src/domain/caja';
import { bs, formatearBs } from './src/domain/dinero';

const inventario = crearInventarioDeEjemplo();
const caja = new Caja(inventario);

caja.abrirTurno('Rosa Vaca', bs(200));

const venta = caja.vender(
  [
    { productoId: 'pacena-620', presentacion: 'caja', cantidad: 1 },   // Bs 160
    { productoId: 'hielo-3kg', presentacion: 'unidad', cantidad: 1 },  // Bs 10
  ],
  { metodo: 'efectivo', recibido: bs(200) },
);
formatearBs(venta.cambio); // "Bs 30,00"

const cierre = caja.cerrarTurno(bs(370));
cierre.efectivoEsperado; // 200 + 170 = Bs 370
cierre.diferencia;       // 0 → la caja cuadra
```

## Pruebas

```bash
npm test
```

48 pruebas cubren montos (incluida la lectura de lo que escribe el cajero), inventario (ingresos, cajas y sueltas, alertas, validaciones), caja (turnos, ventas todo o nada, cambio, anulaciones, arqueo con faltante), carrito (escaneo con cantidad y caja, faltantes de stock, sugerencias de ahorro) y ticket (ancho de 58/80 mm, hora de Bolivia, ventas anuladas).

## Licencia

[MIT](LICENSE) © 2026 Angel Emanuel Lecaro Quispe
