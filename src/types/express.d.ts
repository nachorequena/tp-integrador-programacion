/**
 * EXTENSIÓN DE TIPOS DE EXPRESS
 * =============================
 *
 * El middleware `verificarToken` guarda el payload del JWT en `req.usuario`
 * para que los controllers puedan usarlo después. El problema es que el tipo
 * `Request` de Express no tiene esa propiedad, así que TypeScript rechazaría
 * tanto `req.usuario = ...` como cualquier lectura posterior.
 *
 * Este archivo resuelve eso con "declaration merging": TypeScript fusiona esta
 * declaración con la interfaz `Request` original y le agrega el campo. Es la
 * forma oficial de extender tipos de una librería sin tocar su código.
 *
 * Los archivos `.d.ts` solo declaran tipos: no generan JavaScript. No hace
 * falta importarlo en ningún lado, alcanza con que esté dentro de `src/` para
 * que el compilador lo tome (ver `include` en tsconfig.json).
 */

import { PayloadJWT } from "./index";

declare global {
  namespace Express {
    interface Request {
      /**
       * Datos del usuario autenticado, extraídos del JWT.
       *
       * Es OPCIONAL (`?`) a propósito: en una ruta pública nadie lo completó y
       * vale `undefined`. Al ser opcional, TypeScript obliga a comprobar que
       * exista antes de usarlo, y así no se puede leer `req.usuario.id` en un
       * endpoint donde el middleware no corrió.
       */
      usuario?: PayloadJWT;
    }
  }
}

// Un archivo con `import` o `export` es un módulo, y `declare global` solo
// funciona dentro de un módulo. Este export vacío garantiza esa condición.
export {};
