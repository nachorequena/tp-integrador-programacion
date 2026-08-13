import { PayloadJWT } from "./index";

/**
 * Extiende el Request de Express para que `req.usuario` (inyectado por el
 * middleware `verificarToken`) esté tipado en toda la aplicación.
 */
declare global {
  namespace Express {
    interface Request {
      usuario?: PayloadJWT;
    }
  }
}

export {};
