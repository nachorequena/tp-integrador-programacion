/**
 * MIDDLEWARE: manejadorErrores
 * ============================
 *
 * Único lugar de la aplicación donde se traduce un error a una respuesta HTTP.
 * Es el último eslabón de la cadena de Express (ver src/index.ts).
 *
 * ¿Por qué centralizarlo? Sin esto, cada controller tendría que decidir qué
 * código devolver en cada catch, y tarde o temprano alguno respondería con un
 * formato distinto o se olvidaría de un caso. Así, los controllers solo tienen
 * que llamar a `next(error)` y olvidarse.
 *
 * DETALLE IMPORTANTE DE EXPRESS: este middleware se distingue de uno normal
 * porque tiene CUATRO parámetros en vez de tres. Express cuenta los parámetros
 * de la función para saber que es un manejador de errores. Si se borrara
 * `_next` por "no usarlo", Express lo trataría como middleware común y nunca lo
 * invocaría ante un error.
 */

import { NextFunction, Request, Response } from "express";
import { ErrorHttp } from "../utils/errorHttp";
import { responder } from "../utils/respuesta";

/**
 * Convierte cualquier error de la aplicación en una respuesta con el formato
 * uniforme.
 *
 * Los tres casos que contempla, en orden:
 *
 * 1. **`ErrorHttp`** — error previsto (DNI duplicado, credenciales inválidas,
 *    sin permisos...). Se responde con su código y su mensaje tal cual.
 *
 * 2. **`SyntaxError` con `body`** — lo lanza `express.json()` cuando el cliente
 *    manda un JSON mal escrito. Sin este caso caería en el 500 genérico, y un
 *    error de tipeo del cliente se vería como una falla del servidor. Es 400
 *    porque el problema está en la petición.
 *
 * 3. **Cualquier otra cosa** — un bug, la base caída, algo no previsto. Se
 *    responde 500 con un texto genérico y el detalle real queda SOLO en el log
 *    del servidor. Nunca se manda el stack trace al cliente: revela rutas de
 *    archivos, versiones de librerías y estructura interna, que es justo lo que
 *    busca un atacante.
 *
 * @param error Lo que llegó por `next(error)`. Tipado como `unknown` porque en
 *   JavaScript se puede lanzar cualquier cosa, no solo un `Error`.
 * @param _req Sin uso.
 * @param res Objeto con el que se responde.
 * @param _next Sin uso, pero OBLIGATORIO para que Express lo reconozca.
 */
export function manejadorErrores(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Caso 1: error previsto por nosotros.
  if (error instanceof ErrorHttp) {
    responder(res, error.codigo, error.message, null);
    return;
  }

  // Caso 2: JSON mal formado. Se comprueba también la propiedad `body` porque
  // es la marca que le pone express.json() y permite no confundirlo con
  // cualquier otro SyntaxError del código.
  if (error instanceof SyntaxError && "body" in error) {
    responder(res, 400, "El cuerpo de la petición no es un JSON válido", null);
    return;
  }

  // Caso 3: inesperado. Al log completo, al cliente solo lo genérico.
  console.error("[error inesperado]", error);
  responder(res, 500, "Error interno del servidor", null);
}
