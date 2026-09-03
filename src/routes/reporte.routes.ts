/**
 * RUTAS: /reportes
 * ================
 *
 * Los cuatro indicadores de la semana 4. Todos de lectura y todos solo para
 * `admin`, como pide la consigna.
 *
 * Las rutas se nombran por lo que devuelven y no con un parámetro
 * (`/reportes/:tipo`): así cada una queda documentada por separado en Swagger,
 * y una ruta mal escrita da 404 en vez de un reporte vacío.
 */

import { Router } from "express";
import * as reporteController from "../controllers/reporte.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasReporte = Router();

// Protección para todo el router: sin token → 401, otro rol → 403.
rutasReporte.use(verificarToken, verificarRol("admin"));

rutasReporte.get("/turnos-por-especialidad", reporteController.turnosPorEspecialidad);
rutasReporte.get("/turnos-por-sede", reporteController.turnosPorSede);
rutasReporte.get("/ranking-medicos", reporteController.rankingMedicos);
rutasReporte.get("/tasa-cancelacion", reporteController.tasaCancelacion);
