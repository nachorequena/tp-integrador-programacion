/**
 * RUTAS: /sedes
 * =============
 *
 * Endpoint de prueba de `verificarRol`, el segundo middleware que pide la
 * consigna.
 */

import { Router } from "express";
import * as sedeController from "../controllers/sede.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasSede = Router();

/**
 * `GET /sedes` — solo para el rol `admin`.
 *
 * Los dos middlewares van en este orden y no al revés: `verificarRol` lee
 * `req.usuario.rol`, y ese campo lo completa `verificarToken`. Invertirlos haría
 * que `verificarRol` no encuentre al usuario y responda 401 siempre.
 *
 * Resultado según quién llame:
 *   - Sin token          → 401 (lo corta verificarToken)
 *   - Token de paciente  → 403 (lo corta verificarRol)
 *   - Token de admin     → 200 con el listado
 */
rutasSede.get("/", verificarToken, verificarRol("admin"), sedeController.listar);
