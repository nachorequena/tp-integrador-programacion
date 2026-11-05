/**
 * CONTROLLER: notificaciones
 * ==========================
 *
 * Listado de las notificaciones propias y marcado como leída.
 *
 * Flujo: `notificacion.routes.ts` (solo `verificarToken`) → este controller →
 * `notificacion.service.ts` → tabla `notificacion` → `responder`.
 *
 * Quién lo usa: la campana del encabezado del frontend
 * (`NotificacionService` en `tp-integrador-frontend`), para todos los roles.
 *
 * El destinatario sale SIEMPRE del token (`req.usuario.id`): no hay forma de
 * pedir ni de marcar las notificaciones de otro usuario.
 */

import { NextFunction, Request, Response } from "express";
import * as notificacionService from "../services/notificacion.service";
import { PayloadJWT } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { responder } from "../utils/respuesta";
import { validarIdRuta } from "../validators/comunes";

/**
 * Devuelve el usuario autenticado o corta la petición.
 *
 * Las rutas van detrás de `verificarToken`, así que en la práctica nunca
 * falla; está para que TypeScript descarte el `undefined` y para que un
 * montaje sin el middleware falle con un 401 claro.
 *
 * @param req Petición en curso.
 * @returns El payload del token.
 * @throws `ErrorHttp` 401 si no hay usuario autenticado.
 */
function usuarioAutenticado(req: Request): PayloadJWT {
  if (!req.usuario) {
    throw new ErrorHttp(401, "Falta el token de autenticación");
  }
  return req.usuario;
}

/**
 * `GET /notificaciones` — notificaciones del usuario autenticado, de la más
 * reciente a la más antigua (el frontend cuenta las no leídas para el
 * contador de la campana).
 */
export async function listar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const notificaciones = await notificacionService.listarPorUsuario(usuario.id);
    responder(res, 200, "ok", notificaciones);
  } catch (error) {
    next(error);
  }
}

/**
 * `PATCH /notificaciones/:id/leida` — marca una notificación propia como
 * leída. Si no existe o es de otro usuario, el service responde 404.
 */
export async function marcarLeida(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const id = validarIdRuta(req.params.id);
    await notificacionService.marcarComoLeida(id, usuario.id);
    responder(res, 200, "ok", { mensaje: "Notificación marcada como leída" });
  } catch (error) {
    next(error);
  }
}
