/**
 * MIDDLEWARE: verificarRol
 * ========================
 *
 * Middleware de AUTORIZACIÓN: dado un usuario ya identificado, decide si tiene
 * permiso para acceder al recurso. Siempre se monta DESPUÉS de
 * `verificarToken`, que es quien completa `req.usuario`.
 *
 *   rutasSede.get("/", verificarToken, verificarRol("admin"), controlador);
 *                      └─ ¿quién sos?  └─ ¿podés?             └─ hacelo
 *
 * Este archivo tiene una particularidad respecto de los otros middlewares:
 * `verificarRol` NO es el middleware, es una función que FABRICA middlewares.
 * Hace falta porque Express llama a los middlewares con `(req, res, next)` y no
 * hay forma de pasarle un parámetro extra con los roles permitidos. La solución
 * es una *función que devuelve una función*: al escribir `verificarRol("admin")`
 * se ejecuta la de afuera, que devuelve la de adentro —ya "sabiendo" qué roles
 * acepta— y esa es la que recibe Express.
 *
 * Ese recuerdo de los parámetros externos se llama CLOSURE: la función interna
 * sigue teniendo acceso a `rolesPermitidos` cada vez que llega una petición,
 * aunque `verificarRol` ya haya terminado de ejecutarse hace rato.
 */

import { NextFunction, Request, RequestHandler, Response } from "express";
import { ErrorHttp } from "../utils/errorHttp";

/**
 * Construye un middleware que solo deja pasar a los roles indicados.
 *
 * `...rolesPermitidos` es un parámetro *rest*: junta todos los argumentos en un
 * array, así se puede llamar con uno o con varios, tal como pide la consigna:
 *
 *   verificarRol("admin")
 *   verificarRol("admin", "operador")
 *
 * @param rolesPermitidos Roles habilitados para la ruta (ver `ROLES` en
 *   src/types/index.ts).
 * @returns Un middleware de Express listo para montar en una ruta.
 */
export function verificarRol(...rolesPermitidos: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const usuario = req.usuario;

    // Red de seguridad ante un error de programación: si esta ruta se montó sin
    // `verificarToken` delante, `req.usuario` está vacío. Se responde 401 (no
    // 403) porque en ese estado no sabemos quién es el que pide.
    if (!usuario) {
      next(new ErrorHttp(401, "Falta el token de autenticación"));
      return;
    }

    // El rol viaja dentro del token, que está firmado: no se puede falsificar
    // sin el secreto del servidor. Por eso alcanza con leerlo del payload y no
    // hace falta volver a consultarlo en la base.
    if (!rolesPermitidos.includes(usuario.rol)) {
      // 403 (Forbidden) = "sabemos quién sos, pero esto no es para vos".
      // Repetir el login no lo soluciona; por eso no es 401.
      next(new ErrorHttp(403, "No tenés permisos para acceder a este recurso"));
      return;
    }

    next();
  };
}
