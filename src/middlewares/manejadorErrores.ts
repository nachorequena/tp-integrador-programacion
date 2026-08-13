import { NextFunction, Request, Response } from "express";
import { ErrorHttp } from "../utils/errorHttp";
import { responder } from "../utils/respuesta";

/**
 * Middleware manejador de errores. Se monta al final de todo.
 *
 * - `ErrorHttp` → responde con su código y su mensaje (errores previstos).
 * - JSON mal formado en el body → 400.
 * - Cualquier otra cosa → 500 con mensaje genérico. El detalle se loguea en
 *   el servidor: nunca se filtra un stack trace al cliente.
 *
 * Express identifica este middleware por tener 4 parámetros, así que `next`
 * debe estar declarado aunque no se use.
 */
export function manejadorErrores(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ErrorHttp) {
    responder(res, error.codigo, error.message, null);
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    responder(res, 400, "El cuerpo de la petición no es un JSON válido", null);
    return;
  }

  console.error("[error inesperado]", error);
  responder(res, 500, "Error interno del servidor", null);
}
