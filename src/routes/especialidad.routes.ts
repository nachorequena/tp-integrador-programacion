/**
 * RUTAS: /especialidades
 * ======================
 *
 * CRUD de especialidades médicas, solo para el rol `admin`.
 */

import { Router } from "express";
import * as especialidadController from "../controllers/especialidad.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasEspecialidad = Router();

// Protección para todo el router: sin token → 401, otro rol → 403.
rutasEspecialidad.use(verificarToken, verificarRol("admin"));

rutasEspecialidad.get("/", especialidadController.listar);
rutasEspecialidad.post("/", especialidadController.crear);
rutasEspecialidad.put("/:id", especialidadController.actualizar);
rutasEspecialidad.delete("/:id", especialidadController.eliminar);
