/**
 * RUTAS: /especialidades
 * ======================
 *
 * CRUD de especialidades médicas.
 *
 * Flujo: esta ruta → `especialidad.controller.ts` → `especialidad.service.ts`
 * → tabla `especialidad`.
 *
 * Protección (cambió para la etapa del frontend):
 *   - `GET /especialidades` → cualquier usuario con sesión. Lo usan el paciente
 *     al solicitar un turno y el administrador al asignarle especialidades a un
 *     médico.
 *   - Alta, modificación y baja → solo `admin`.
 *
 * Mismo mecanismo que en `sede.routes.ts`: el GET se registra antes de sumar
 * `verificarRol("admin")` al router.
 */

import { Router } from "express";
import * as especialidadController from "../controllers/especialidad.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasEspecialidad = Router();

// Sin token → 401, para todo el router.
rutasEspecialidad.use(verificarToken);

rutasEspecialidad.get("/", especialidadController.listar); // cualquier rol

// De acá para abajo, solo admin: con token de otro rol → 403.
rutasEspecialidad.use(verificarRol("admin"));

rutasEspecialidad.post("/", especialidadController.crear);
rutasEspecialidad.put("/:id", especialidadController.actualizar);
rutasEspecialidad.delete("/:id", especialidadController.eliminar);
