/**
 * RUTAS: /health
 * ==============
 *
 * Endpoint de diagnóstico del servidor y la base.
 */

import { Router } from "express";
import * as healthController from "../controllers/health.controller";

export const rutasHealth = Router();

/**
 * `GET /health` — público.
 *
 * Sin protección porque su función es poder consultarlo siempre, incluso
 * cuando la base está caída y no habría forma de emitir un token.
 */
rutasHealth.get("/", healthController.verificarEstado);
