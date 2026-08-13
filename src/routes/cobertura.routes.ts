/**
 * RUTAS: /coberturas
 * ==================
 *
 * Listado de obras sociales para el formulario de registro.
 */

import { Router } from "express";
import * as coberturaController from "../controllers/cobertura.controller";

export const rutasCobertura = Router();

/**
 * `GET /coberturas` — público.
 *
 * No lleva `verificarToken` a propósito: el formulario de registro necesita
 * mostrar las coberturas antes de que el usuario exista, así que exigir un
 * token acá haría imposible registrarse.
 */
rutasCobertura.get("/", coberturaController.listar);
