/**
 * CONTROLLER: notificacion
 * ========================
 */

import { NextFunction, Request, Response } from "express";
import * as notificacionService from "../services/notificacion.service";
import { responder } from "../utils/respuesta";

/**
 * GET /notificaciones
 */
export async function listar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;

    const notificaciones =
      await notificacionService.listarPorUsuario(usuario.id);

    responder(res, 200, "ok", notificaciones);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /notificaciones/:id/leida
 */
export async function marcarLeida(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;
    const id = Number(req.params.id);

    await notificacionService.marcarComoLeida(id, usuario.id);

    responder(res, 200, "ok", {
      mensaje: "Notificación marcada como leída",
    });
  } catch (error) {
    next(error);
  }
}