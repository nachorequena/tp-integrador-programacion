/**
 * MIDDLEWARE: verificarToken
 * ==========================
 *
 * Protege una ruta exigiendo un JWT válido. Es el middleware de AUTENTICACIÓN:
 * responde a la pregunta "¿quién sos?". La pregunta "¿podés hacer esto?" la
 * responde `verificarRol` (autorización), que se monta después de este.
 *
 * ¿Qué es un middleware? Una función que se ejecuta ANTES del controller y
 * decide si la petición sigue avanzando o se corta:
 *
 *   - Llama a `next()` sin argumentos → todo bien, que siga al controller.
 *   - Llama a `next(error)`           → cortar acá y saltar al manejador de
 *                                       errores (se saltea el controller).
 *
 * El cliente manda el token en el header HTTP:
 *
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * "Bearer" ("portador") es el esquema estándar para tokens: significa que quien
 * lo presenta tiene el permiso, sin más pruebas.
 */

import { NextFunction, Request, Response } from "express";
import { TokenExpiredError } from "jsonwebtoken";
import { ErrorHttp } from "../utils/errorHttp";
import { verificarFirmaToken } from "../utils/jwt";

/**
 * Valida el JWT del header `Authorization` y deja el payload en `req.usuario`.
 *
 * Todos los rechazos son **401 (Unauthorized)**, que es el código para "no sé
 * quién sos". No confundir con 403 (Forbidden), que es "sé quién sos, pero no
 * tenés permiso" y lo devuelve `verificarRol`.
 *
 * El parámetro `_res` no se usa (este middleware nunca responde por su cuenta,
 * delega en el manejador de errores). El guión bajo es la convención para
 * marcar un parámetro que existe solo porque Express exige esa firma.
 *
 * @param req Petición entrante. Se le agrega `usuario` si el token es válido.
 * @param _res Sin uso.
 * @param next Continuación de la cadena de Express.
 */
export function verificarToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  // Caso 1: no mandaron el header.
  if (!header) {
    next(new ErrorHttp(401, "Falta el token de autenticación"));
    return;
  }

  // Caso 2: el header vino, pero mal armado. Se separa por el espacio de
  // "Bearer <token>" y se controla que las dos partes existan y que el esquema
  // sea el correcto.
  const [esquema, token] = header.split(" ");
  if (esquema !== "Bearer" || !token) {
    next(
      new ErrorHttp(
        401,
        "Formato de autorización inválido. Se espera: Bearer <token>",
      ),
    );
    return;
  }

  try {
    // Caso 3: el token es válido. Se guarda el payload en la petición para que
    // el controller sepa quién la hizo sin volver a decodificar nada.
    req.usuario = verificarFirmaToken(token);
    next();
  } catch (error) {
    // Caso 4: la verificación falló. Se distinguen los dos motivos porque para
    // el usuario no es lo mismo: si venció, alcanza con volver a loguearse.
    if (error instanceof TokenExpiredError) {
      next(new ErrorHttp(401, "El token expiró"));
      return;
    }
    // Firma que no coincide, token manipulado o texto que ni siquiera es un JWT.
    next(new ErrorHttp(401, "Token inválido"));
  }
}
