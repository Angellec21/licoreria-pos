# Changelog

Todos los cambios importantes de este proyecto se documentan en este archivo.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [1.0.0] - 2026-11-06

Primera versión estable del punto de venta para licorerías.

### Inventario
- Catálogo con código de barras, categoría, precio por unidad, precio por caja y costo, en Bs.
- Stock siempre en unidades, desglosado en cajas y sueltas; venta por unidad o por caja cerrada.
- Alertas de stock mínimo y valor del inventario a costo.
- Ingreso de mercadería en cajas o sueltas con proveedor y factura, costo promedio ponderado, historial y pedido sugerido en cajas.

### Caja
- Turnos con apertura (cajero y monto inicial) y cierre con arqueo: efectivo esperado, faltante o sobrante.
- Ventas todo o nada con efectivo (cálculo de cambio), QR o tarjeta.
- Anulaciones con motivo y hora, solo dentro del turno abierto, devolviendo el stock.
- Pantalla de cobro con lector de código de barras (`3*código`, `c*código`), búsqueda sin tildes y sugerencia de ahorro por caja.
- Ticket para impresora térmica de 58/80 mm y copia del ticket desde *Ventas del turno*.

### Reportes
- Reporte del día para el dueño: total, margen bruto en Bs y %, ticket promedio, ventas por hora con hora pico, más vendidos, margen por categoría, métodos de pago y ventas por cajero.
- Día comercial en hora de Bolivia (UTC−4) y exportación a CSV para Excel en español.
- El reporte abre en el último día con ventas si hoy todavía no se vendió nada.

### Datos
- Guardado automático en el navegador después de cada operación, con esquema versionado.
- Respaldo descargable en JSON y restauración validada; un guardado dañado se aparta en vez de borrarse.
- Sincronización entre pestañas del mismo navegador.
- Datos de ejemplo: licorería de Santa Cruz con 13 productos y una semana de ventas, compras y arqueos.

### Calidad
- 84 pruebas automáticas con Vitest sobre la lógica de negocio.
- TypeScript en modo estricto y CI en GitHub Actions con Node 20, 22 y 24 (pruebas y build).

[1.0.0]: https://github.com/Angellec21/licoreria-pos/releases/tag/v1.0.0
