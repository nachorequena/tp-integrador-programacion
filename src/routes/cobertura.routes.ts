import { Router } from "express";
import * as coberturaController from "../controllers/cobertura.controller";

export const rutasCobertura = Router();

// Pública: el formulario de registro necesita listar las coberturas
// antes de que exista un usuario.
rutasCobertura.get("/", coberturaController.listar);
