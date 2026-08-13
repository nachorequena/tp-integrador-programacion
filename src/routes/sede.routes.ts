import { Router } from "express";
import * as sedeController from "../controllers/sede.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasSede = Router();

// Endpoint de prueba de `verificarRol`: solo admin.
rutasSede.get("/", verificarToken, verificarRol("admin"), sedeController.listar);
