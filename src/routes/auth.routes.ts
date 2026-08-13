/**
 * RUTAS: /auth
 * ============
 *
 * Endpoints de autenticación. Acá se ve de un vistazo qué está protegido y qué
 * no: los middlewares se declaran entre la ruta y el controller, y se ejecutan
 * en ese mismo orden, de izquierda a derecha.
 */

import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasAuth = Router();

// Públicas: son justamente las que se usan para conseguir un token, así que no
// pueden exigir uno.
rutasAuth.post("/registro", authController.registro); // POST /auth/registro
rutasAuth.post("/login", authController.login); //       POST /auth/login

/**
 * Endpoint de prueba de `verificarToken`, como pide la consigna.
 *
 * La cadena es: verificarToken → perfil. Si el token falta, venció o es
 * inválido, el middleware corta con 401 y `perfil` nunca se ejecuta.
 */
rutasAuth.get("/perfil", verificarToken, authController.perfil); // GET /auth/perfil
