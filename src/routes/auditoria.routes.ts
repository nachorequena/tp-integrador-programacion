/**
 * RUTAS: /auditoria
 * =================
 *
 * Consulta del log de acciones sensibles. Solo el rol `admin`.
 *
 * Un único endpoint, de lectura. No hay POST, PUT ni DELETE a propósito: un log
 * que se puede escribir o editar desde afuera no sirve como evidencia de nada.
 * Las entradas las genera el middleware `auditoria.ts`.
 */

import { Router } from "express";
import * as auditoriaController from "../controllers/auditoria.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasAuditoria = Router();

// Sin token → 401; con token de otro rol → 403.
rutasAuditoria.use(verificarToken, verificarRol("admin"));

// GET /auditoria?id_usuario=&entidad=&desde=&hasta=
rutasAuditoria.get("/", auditoriaController.listar);
