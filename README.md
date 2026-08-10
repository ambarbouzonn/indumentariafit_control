# Indumentaria Fit · Control interno

Base mobile-first para administrar ventas, stock, reservas, ingresos de
mercadería, productos y movimientos de Indumentaria Fit.

## Estado actual

La aplicación usa Supabase para guardar la información, autenticar usuarios y
sincronizar el stock en tiempo real. Permite:

- registrar una venta y reservar temporalmente sus unidades;
- descontar stock al confirmar la venta;
- consultar disponibilidad por ubicación;
- generar mensajes para clientes;
- ingresar mercadería por variante;
- cancelar reservas;
- revisar productos y movimientos;
- ver el espacio reservado para pedidos por encargo.

Las operaciones sensibles se ejecutan dentro de funciones de base de datos para
evitar que dos vendedoras reserven o vendan las mismas unidades.

## Configuración de Supabase

1. Copiar `.env.example` como `.env.local` y completar la URL y la clave
   publicable del proyecto.
2. En Supabase, abrir **SQL Editor**, crear una consulta nueva y ejecutar todo el
   contenido de `supabase/setup.sql`.
3. Iniciar la aplicación y crear la primera cuenta. Esa cuenta recibe el rol de
   administradora; las siguientes se crean como vendedoras.

## Desarrollo local

Requiere Node.js 22.13 o superior.

```bash
npm install
npm run dev
```

Verificación:

```bash
npm run build
npm test
```
