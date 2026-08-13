import { Router } from "express";
import { rutasAuth } from "./auth.routes";
import { rutasCobertura } from "./cobertura.routes";
import { rutasHealth } from "./health.routes";
import { rutasSede } from "./sede.routes";

export const rutas = Router();

rutas.use("/health", rutasHealth);
rutas.use("/coberturas", rutasCobertura);
rutas.use("/auth", rutasAuth);
rutas.use("/sedes", rutasSede);
