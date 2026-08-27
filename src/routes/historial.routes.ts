/**
 * RUTAS: /historial
 * ==================
 */

import { Router } from "express";
import * as historialController from "../controllers/historial.controller";
import { verificarToken } from "../middlewares/verificarToken";
import { verificarRol } from "../middlewares/verificarRol";

export const rutasHistorial = Router();

rutasHistorial.post(
  "/:idTurno",
  verificarToken,
  verificarRol("medico"),
  historialController.registrar,
);

rutasHistorial.get(
  "/mio",
  verificarToken,
  verificarRol("paciente"),
  historialController.miHistorial,
);

rutasHistorial.get(
  "/paciente/:idPaciente",
  verificarToken,
  verificarRol("medico"),
  historialController.historialPacienteMedico,
);