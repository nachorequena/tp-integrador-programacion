/**
 * FORMATO DE RESPUESTA UNIFORME
 * =============================
 *
 * Único punto de salida de la API. El enunciado exige que TODAS las respuestas
 * —éxito y error, desde la primera semana— tengan la misma estructura de tres
 * campos, y que eso se mantenga consistente en todas las entregas.
 *
 * Centralizarlo en una función tiene una ventaja concreta: es imposible que a
 * un endpoint se le escape un formato distinto por descuido, y si algún día el
 * formato cambia, se toca un solo archivo en lugar de veinte.
 *
 * REGLA: nunca llamar a `res.json()` o `res.send()` directamente en un
 * controller. Siempre a través de `responder`.
 */

import { Response } from "express";

/**
 * Envía una respuesta HTTP con el formato uniforme del proyecto.
 *
 * @param res Objeto `Response` de Express de la petición en curso.
 * @param codigo Código HTTP. Va en dos lugares a propósito: como estado real de
 *   la respuesta (`res.status`) y dentro del JSON, porque el enunciado pide que
 *   el cuerpo incluya un código numérico.
 * @param estado `"ok"` si la operación salió bien; si falló, un mensaje
 *   descriptivo del error, pensado para que se pueda mostrar al usuario.
 * @param datos Los datos solicitados. `null` cuando la operación no devuelve
 *   nada (por ejemplo, en cualquier respuesta de error).
 * @returns El mismo `Response`, para poder escribir `return responder(...)`.
 *
 * @example
 * responder(res, 200, "ok", { token: "eyJ..." });
 * // { "codigo": 200, "estado": "ok", "datos": { "token": "eyJ..." } }
 *
 * @example
 * responder(res, 409, "El DNI ya está registrado");
 * // { "codigo": 409, "estado": "El DNI ya está registrado", "datos": null }
 */
export function responder(
  res: Response,
  codigo: number,
  estado: string,
  datos: unknown = null,
): Response {
  return res.status(codigo).json({ codigo, estado, datos });
}
