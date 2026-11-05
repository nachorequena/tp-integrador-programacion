/**
 * RUTAS: /usuarios
 * ================
 *
 * Gestión de usuarios del administrador (nuevo en la etapa del frontend).
 *
 * Flujo: esta ruta → `usuario.controller.ts` → `gestion-usuario.service.ts`.
 *
 * Protección: solo `admin`. No hay DELETE: la consigna pide listar, crear y
 * editar, y borrar un usuario con turnos o historial rompería esas filas.
 *
 * Cada POST y PUT queda registrado en la auditoría (ver las reglas de
 * `middlewares/auditoria.ts`).
 */

import { Router } from "express";
import * as usuarioController from "../controllers/usuario.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasUsuario = Router();

// Sin token → 401; con token de otro rol → 403.
rutasUsuario.use(verificarToken, verificarRol("admin"));

rutasUsuario.get("/", usuarioController.listar); //        GET  /usuarios
rutasUsuario.post("/", usuarioController.crear); //        POST /usuarios
rutasUsuario.put("/:id", usuarioController.actualizar); // PUT  /usuarios/:id
