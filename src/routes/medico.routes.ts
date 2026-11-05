/**
 * RUTAS: /medicos
 * ===============
 *
 * Listado de médicos con sus especialidades. Es nuevo en la etapa del
 * frontend (lo sugiere la consigna final).
 *
 * Flujo: esta ruta → `medico.controller.ts` → `medico.service.ts`.
 *
 * Protección: cualquier usuario con sesión. Lo usan el paciente (solicitar
 * turno), el operador (cargar agenda y asignar turnos) y el médico (ver sus
 * propias especialidades). Por eso el service no devuelve datos personales
 * más allá del nombre.
 */

import { Router } from "express";
import * as medicoController from "../controllers/medico.controller";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasMedico = Router();

rutasMedico.use(verificarToken); // sin token → 401

rutasMedico.get("/", medicoController.listar); // GET /medicos?id_especialidad=&id_sede=
