/**
 * RUTAS: /notificaciones
 * ======================
 *
 *   GET   /          listado del usuario autenticado, de la más reciente
 *   PATCH /:id/leida marca una como leída
 *
 * Solo llevan `verificarToken`, sin `verificarRol`: cualquier rol tiene
 * notificaciones propias y cada uno ve únicamente las suyas. El filtro no es
 * por rol sino por id, y lo aplica el service sobre el id del token.
 *
 * No hay endpoint de alta a propósito: la consigna pide que las notificaciones
 * se generen internamente ante cada cambio de estado de un turno. Crearlas
 * desde afuera permitiría falsificarlas.
 */

import { Router } from "express";
import * as notificacionController from "../controllers/notificacion.controller";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasNotificacion = Router();

rutasNotificacion.get(
  "/",
  verificarToken,
  notificacionController.listar,
);

rutasNotificacion.patch(
  "/:id/leida",
  verificarToken,
  notificacionController.marcarLeida,
);
