/**
 * RUTAS: /pacientes
 * =================
 *
 * Endpoints sobre pacientes que pide la consigna final. Son nuevos en la etapa
 * del frontend.
 *
 * Flujo: esta ruta → `paciente.controller.ts` → `paciente.service.ts` (o
 * `auth.service.ts` para el alta).
 *
 * | Método | Ruta                    | Roles                    |
 * | ------ | ----------------------- | ------------------------ |
 * | GET    | /pacientes?busqueda=    | operador, medico, admin  |
 * | POST   | /pacientes              | operador                 |
 * | PUT    | /pacientes/mis-datos    | paciente                 |
 */

import { Router } from "express";
import * as pacienteController from "../controllers/paciente.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasPaciente = Router();

// Sin token → 401, para todo el router. El rol se controla en cada ruta,
// porque cambia de una a otra.
rutasPaciente.use(verificarToken);

rutasPaciente.get("/", verificarRol("operador", "medico", "admin"), pacienteController.buscar);
rutasPaciente.post("/", verificarRol("operador"), pacienteController.crear);
rutasPaciente.put("/mis-datos", verificarRol("paciente"), pacienteController.actualizarMisDatos);
