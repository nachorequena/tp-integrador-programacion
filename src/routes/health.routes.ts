import { Router } from "express";
import * as healthController from "../controllers/health.controller";

export const rutasHealth = Router();

rutasHealth.get("/", healthController.verificarEstado);
