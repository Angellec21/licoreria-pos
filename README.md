# 🍾 Licorería POS

[![CI](https://github.com/Angellec21/licoreria-pos/actions/workflows/ci.yml/badge.svg)](https://github.com/Angellec21/licoreria-pos/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-84_pruebas-6E9F18?logo=vitest&logoColor=white)
![Versión](https://img.shields.io/badge/versión-1.0.0-7B1E2E)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)

Punto de venta para **licorerías de barrio** en Santa Cruz de la Sierra (Bolivia): caja por turnos con apertura y cierre, venta **por unidad y por caja**, control de stock y reporte diario para el dueño. Todos los montos en **bolivianos (Bs)**.

> ✅ **Versión 1.0.0.** Se atiende el mostrador de punta a punta —abrir la caja, cobrar con lector de código de barras, imprimir el ticket, anular con motivo, cargar mercadería y cerrar el turno con arqueo— y el dueño revisa el reporte del día. Los datos se guardan solos en el navegador. Cambios en el [CHANGELOG](CHANGELOG.md).

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
- **Stock desglosado** (p. ej. *8 cajas + 0 u.*).
- **Ingreso de mercadería** desde la pantalla de Inventario:
  - Compra en cajas y/o sueltas, con proveedor y N.º de factura o nota de remisión.
  - Costo nuevo por caja (tal como viene en la factura) o por unidad; el costo del producto se recalcula con **promedio ponderado** para que el margen no se distorsione cuando sube el precio del distribuidor.
  - **Pedido sugerido** en cajas cerradas para los productos bajo el mínimo, con el costo estimado.
  - Historial de las últimas compras.
- **Alertas de reposición** cuando un producto llega a su stock mínimo.
- **Turnos de caja**: apertura con cajero y monto inicial; no se puede vender con la caja cerrada ni abrir dos turnos a la vez.
- **Ventas todo o nada** con efectivo (calcula el cambio), QR o tarjeta: si falta stock de un producto, no se descuenta ninguno.
- **Anulaciones con motivo**, solo dentro del turno abierto, devolviendo el stock y registrando la hora de anulación.
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
- **Ventas del turno**: lista de las ventas del turno con hora, método y detalle; **copia del ticket** para reimprimir y **anulación con motivo** (con sugerencias frecuentes y confirmación). El ticket de una venta anulada muestra el motivo.
- **Cierre de caja desde la interfaz**: resumen del turno por método de pago, margen, efectivo esperado y faltante o sobrante del cajero.
- **Reporte del día para el dueño** (suma todos los turnos del día):
  - Total vendido, **margen bruto en Bs y %**, cantidad de ventas y **ticket promedio**.
  - **Ventas por hora** con la **hora pico**, para decidir horarios y personal.
  - **Más vendidos** (unidades, ingresos y margen) y **margen por categoría** (¿deja más la cerveza o el singani?).
  - Cobros por método de pago y **ventas por cajero**.
  - Aviso de **anulaciones** (cantidad y monto) y de productos bajo stock mínimo.
  - Día comercial en hora de Bolivia: una venta a las 00:20 cuenta para el día siguiente.
  - **Exportación a CSV** lista para Excel en español (`;` y coma decimal) e impresión.
- **Guardado automático en el navegador**: después de cada venta, anulación, ingreso o cierre se guarda todo (inventario, turnos y ventas). Si se corta la luz o se recarga la página, el turno sigue donde quedó.
  - El encabezado muestra la hora del último guardado y avisa si el navegador no permite guardar (modo privado).
  - **Respaldo descargable** (`licoreria-respaldo-AAAA-MM-DD.json`) y **restauración desde archivo**, por ejemplo para pasar los datos a otra computadora.
  - Los datos se validan al cargarlos: un archivo dañado o alterado (stock negativo, ventas sin turno, dos turnos abiertos) se rechaza sin tocar lo que hay; si el guardado del navegador está dañado se aparta una copia en vez de borrarlo.
  - Dos pestañas abiertas en la misma computadora se mantienen sincronizadas.
- **Datos de ejemplo listos para probar**: al abrir la app por primera vez hay una licorería de Santa Cruz con 13 productos y **una semana de ventas** (dos turnos por día, viernes y sábado más movidos, compras al distribuidor, anulaciones y arqueos con algún faltante). El reporte abre directamente en el último día con ventas.

### Roadmap

- [x] Catálogo, stock por unidad/caja y alertas de mínimo
- [x] Caja por turnos, ventas, anulaciones y arqueo
- [x] Pantalla de cobro: carrito, lector de código de barras y ticket
- [x] Apertura y cierre de turno desde la interfaz
- [x] Reporte diario del dueño: ventas por hora, más vendidos, margen por categoría y CSV
- [x] Ingreso de mercadería con costo promedio ponderado y pedido sugerido
- [x] Ventas del turno: anulación con motivo y copia del ticket
- [x] Guardado en el navegador, respaldo descargable y restauración
- [x] Datos de ejemplo con una semana de ventas para probar los reportes
- [x] Versión 1.0.0

Próximas ideas:

- [ ] Backend con base de datos (PostgreSQL) para varias cajas y sucursales
- [ ] Facturación electrónica en línea con el SIN
- [ ] Reporte semanal y mensual con comparación contra la semana anterior
- [ ] Instalación como app (PWA) para trabajar sin internet en el mostrador
- [ ] Usuarios con PIN y permisos (cajero / dueño) para anular y ver costos

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
│   ├── inventario.ts    # Productos, unidad/caja, stock, alertas e ingresos de mercadería
│   ├── caja.ts          # Turnos, ventas, anulaciones y arqueo
│   ├── carrito.ts       # Carrito inmutable, escaneo y sugerencias de caja
│   ├── reporte.ts       # Reporte diario del dueño y exportación a CSV
│   ├── persistencia.ts  # Guardado/restauración con esquema versionado
│   └── ticket.ts        # Ticket de texto para impresora térmica
├── data/
│   ├── catalogo.ts         # Catálogo de ejemplo de una licorería de Santa Cruz
│   └── historialEjemplo.ts # Una semana de ventas, compras y arqueos de ejemplo
├── ui/
│   ├── usePuntoDeVenta.ts  # Hook que conecta el dominio con React
│   ├── AperturaTurno.tsx   # Abrir caja
│   ├── PantallaCobro.tsx   # Escaneo, carrito y cobro
│   ├── TicketVista.tsx     # Vista previa e impresión del ticket
│   ├── VentasTurno.tsx     # Ventas del turno, copia del ticket y anulación
│   ├── CierreTurno.tsx     # Arqueo y cierre
│   ├── VistaInventario.tsx # Stock y alertas
│   ├── IngresoMercaderia.tsx # Compras al distribuidor y pedido sugerido
│   ├── RespaldoDatos.tsx   # Estado del guardado, respaldo y restauración
│   └── VistaReporte.tsx    # Reporte del día del dueño
├── App.tsx              # Navegación entre secciones
└── main.tsx
```

Decisiones de diseño:

- **Montos en centavos (enteros)**: `0,1 + 0,2` nunca da `0,30000000000000004` en un cierre de caja.
- **Stock siempre en unidades**: la caja es solo una forma de vender; así el stock nunca se "parte".
- **Ventas todo o nada**: primero se valida todo el pedido (sumando líneas del mismo producto) y recién después se descuenta.
- **Reloj inyectable** en `Caja` e `Inventario`: las pruebas controlan la fecha y hora de apertura, ventas, anulaciones, ingresos y cierre.
- **Costo promedio ponderado**: `(stock × costo actual + ingreso × costo nuevo) / stock total`; es el método que usan la mayoría de las pymes para valorar inventario.
- **Día comercial con desfase fijo UTC−4**: Bolivia no tiene horario de verano, así que el reporte agrupa por día y hora igual en el navegador del dueño que en el servidor de CI.
- **Encapsulamiento**: el inventario devuelve copias; nadie puede modificar el stock sin pasar por las reglas.
- **Carrito inmutable y sin precios guardados**: cada cambio crea un carrito nuevo (React lo detecta solo) y los precios se leen del inventario al cobrar, así nunca se cobra un precio viejo.
- **Guardado con esquema versionado**: el JSON lleva `esquema: 1`; si el formato cambia en una versión futura se migra en vez de perder datos. La restauración vuelve a pasar cada producto por las validaciones de alta y revisa que las ventas sean correlativas y apunten a turnos y productos existentes.
- **Almacén inyectable**: la persistencia trabaja con una interfaz tipo `localStorage`, así las pruebas usan uno en memoria y más adelante se puede cambiar por una API sin tocar el dominio.
- **Datos de ejemplo generados con las reglas reales**: el historial se arma con las mismas operaciones de la caja (`ingresar`, `vender`, `anularVenta`, `cerrarTurno`) y un generador pseudoaleatorio con semilla, así el stock cuadra, es siempre el mismo para una fecha y pasa por las validaciones del guardado.
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
5. **Ventas del turno**: si el cliente desiste o hubo un error, busque la venta, toque *Anular* y escriba el motivo; los productos vuelven al stock. Desde aquí también se reimprime un ticket.
6. **Inventario → Ingreso de mercadería**: cuando llega el camión del distribuidor, cargue las cajas recibidas, el proveedor, la factura y, si cambió, el costo por caja.
7. **Cierre de caja**: cuente el efectivo del cajón; el sistema indica si la caja cuadra o si hay faltante/sobrante.
8. **Reporte del día** (dueño): elija la fecha, revise margen, hora pico y más vendidos, y descárguelo en CSV o imprímalo.

> Todo se guarda solo en el navegador. Para empezar con la tienda real, en **Inventario → Datos y respaldo** use *Restaurar desde archivo* con un respaldo propio, o ajuste el catálogo en `src/data/catalogo.ts`. *Volver a datos de ejemplo* recarga la semana de prueba.

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

import { reporteDiario, reporteACsv } from './src/domain/reporte';

const reporte = reporteDiario(caja.todasLasVentas(), inventario, '2026-11-03');
reporte.margenPorcentaje;     // margen bruto del día en %
reporte.horaPico;             // { hora: 21, cantidad: 14, total: … }
reporte.porCategoria[0];      // la categoría que más margen dejó
reporteACsv(reporte);         // texto CSV para Excel

// Llegó el camión: 5 cajas de Paceña a Bs 148,80 la caja
inventario.registrarIngreso('pacena-620', {
  cajas: 5,
  costoCaja: bs(148.8),
  proveedor: 'Distribuidora Norte',
  documento: 'F-001245',
});
inventario.sugerenciaDePedido(); // [{ nombre: 'Vodka Smirnoff 750 ml', cajas: 1, costoEstimado: … }]
```

## Pruebas

```bash
npm test
```

84 pruebas cubren montos (incluida la lectura de lo que escribe el cajero), inventario (cajas y sueltas, alertas, validaciones), ingresos de mercadería (costo promedio ponderado, costo por caja o unidad, historial, pedido sugerido), caja (turnos, ventas todo o nada, cambio, anulaciones con hora y motivo, arqueo con faltante), carrito (escaneo con cantidad y caja, faltantes de stock, sugerencias de ahorro), ticket (ancho de 58/80 mm, hora de Bolivia, ventas anuladas con motivo), reporte diario (margen por categoría, hora pico, cajeros, anuladas aparte, ventas de madrugada y CSV) guardado (restauración exacta, numeración que continúa, archivos dañados o alterados y navegador sin espacio) y datos de ejemplo (el stock cuadra con compras y ventas, ritmo de fin de semana y de noche, determinismo y validez para cualquier fecha).

## Licencia

[MIT](LICENSE) © 2026 Angel Emanuel Lecaro Quispe
