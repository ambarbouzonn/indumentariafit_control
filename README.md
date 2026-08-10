# Indumentaria Fit · Control interno

Base mobile-first para administrar ventas, stock, reservas, ingresos de
mercadería, productos y movimientos de Indumentaria Fit.

## Estado actual

La primera versión funciona con datos de demostración guardados en memoria.
Permite probar los recorridos principales antes de conectar la base de datos:

- registrar una venta y reservar temporalmente sus unidades;
- descontar stock al confirmar la venta;
- consultar disponibilidad por ubicación;
- generar mensajes para clientes;
- ingresar mercadería por variante;
- cancelar reservas;
- revisar productos y movimientos;
- ver el espacio reservado para pedidos por encargo.

Los cambios se reinician al recargar la página. La persistencia, los usuarios y
la sincronización en tiempo real se incorporarán en la siguiente etapa.

## Desarrollo local

Requiere Node.js 22.13 o superior y pnpm.

```bash
pnpm install
pnpm dev
```

Verificación:

```bash
pnpm build
pnpm test
```
