import { Response } from "express";

/**
 * Único punto de salida de la API. TODAS las respuestas —éxito y error—
 * se arman con este helper. Nunca llamar a `res.json()` a mano.
 *
 * - `codigo`: código HTTP numérico.
 * - `estado`: "ok" si salió bien; si falló, un mensaje descriptivo del error.
 * - `datos`: los datos solicitados, o null cuando no hay retorno.
 */
export function responder(
  res: Response,
  codigo: number,
  estado: string,
  datos: unknown = null,
): Response {
  return res.status(codigo).json({ codigo, estado, datos });
}
