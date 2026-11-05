/**
 * RUTAS: /disponibilidad
 * ======================
 *
 * Consulta de fechas y horarios libres para pedir un turno. Es nuevo en la
 * etapa del frontend (lo sugiere la consigna final).
 *
 * Flujo: esta ruta → `disponibilidad.controller.ts` →
 * `disponibilidad.service.ts`.
 *
 * Protección: `paciente` y `operador`, los dos roles que sacan turnos (los
 * mismos que `POST /turnos`). Las respuestas solo traen fechas y horas, nunca
 * datos de los pacientes que ocupan los otros horarios.
 */

import { Router } from "express";
import * as disponibilidadController from "../controllers/disponibilidad.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasDisponibilidad = Router();

// Sin token → 401; con token de otro rol → 403.
rutasDisponibilidad.use(verificarToken, verificarRol("paciente", "operador"));

rutasDisponibilidad.get("/fechas", disponibilidadController.fechas);
rutasDisponibilidad.get("/horarios", disponibilidadController.horarios);
