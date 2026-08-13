import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasAuth = Router();

rutasAuth.post("/registro", authController.registro);
rutasAuth.post("/login", authController.login);

// Endpoint de prueba de `verificarToken`.
rutasAuth.get("/perfil", verificarToken, authController.perfil);
