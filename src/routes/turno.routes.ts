/**
 * RUTAS: /turnos
 * ===============
 */

import { Router } from "express";
import * as turnoController from "../controllers/turno.controller";
import { verificarToken } from "../middlewares/verificarToken";
import { verificarRol } from "../middlewares/verificarRol";

export const rutasTurno = Router();

rutasTurno.post(
  "/",
  verificarToken,
  verificarRol("paciente", "operador"),
  turnoController.crear,
);

rutasTurno.get(
  "/mios",
  verificarToken,
  verificarRol("paciente"),
  turnoController.misTurnos,
);

rutasTurno.get(
  "/medico",
  verificarToken,
  verificarRol("medico"),
  turnoController.turnosMedico,
);

rutasTurno.get(
  "/sede",
  verificarToken,
  verificarRol("operador"),
  turnoController.turnosSede,
);

rutasTurno.patch(
  "/:id/cancelar",
  verificarToken,
  verificarRol("paciente", "operador", "medico"),
  turnoController.cancelar,
);

rutasTurno.patch(
  "/:id/atender",
  verificarToken,
  verificarRol("medico"),
  turnoController.atender,
);