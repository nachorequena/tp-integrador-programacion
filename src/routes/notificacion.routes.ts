/**
 * RUTAS: /notificaciones
 * ======================
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