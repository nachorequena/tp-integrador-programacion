/**
 * RUTAS: /historial
 * =================
 *
 * Alta y consulta del historial clínico.
 *
 *   POST /:idTurno            medico — registra el resultado de la consulta
 *   GET  /mio                 paciente — la totalidad de su historial
 *   GET  /paciente/:idPaciente medico — solo lo que él mismo registró
 *
 * Hay dos endpoints de lectura y no uno con filtros porque la consigna define
 * dos vistas distintas del mismo dato. Separarlas permite que el destinatario
 * salga siempre del token: ni el paciente ni el médico pueden pedir el
 * historial de otro cambiando un número en la URL.
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
