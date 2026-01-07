# hostinger-env-next

Aplicacion minima en Next.js para exponer la variable de entorno `envar1` en una app de JavaScript dentro de Hostinger.

## Requisitos

- Node.js 18+.

## Configuracion

1. Instala dependencias:

   ```bash
   npm install
   ```

2. En Hostinger, define la variable `envar1` en el panel de variables de entorno.

   Para desarrollo local, copia `.env.example` a `.env.local` y ajusta el valor:

   ```bash
   cp .env.example .env.local
   ```

## Ejecucion

- Desarrollo:

  ```bash
  npm run dev
  ```

- Produccion:

  ```bash
  npm run build
  npm start
  ```

## Endpoints

- `GET /api/envar1` devuelve `{ "envar1": "..." }`.
- `GET /api/health` devuelve `ok`.
- `GET /` muestra el valor de `envar1` en la pagina.
