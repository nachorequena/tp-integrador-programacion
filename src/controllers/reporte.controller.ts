/**
 * CONTROLLER: reportes y estadísticas
 * ===================================
 *
 * Los cuatro indicadores de la semana 4. Todos comparten la misma forma: se
 * valida el rango de fechas, se delega en el service y se responde con el
 * helper uniforme.
 *
 * El rango se valida con la misma función en los cuatro para que no haya un
 * reporte que acepte una fecha que otro rechaza.
 */

import { NextFunction, Request, Response } from "express";
import * as reporteService from "../services/reporte.service";
import { responder } from "../utils/respuesta";
import { validarRangoFechas } from "../validators/reporte.validators";

/** `GET /reportes/turnos-por-especialidad?desde=&hasta=` */
export async function turnosPorEspecialidad(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rango = validarRangoFechas(req.query);
    responder(res, 200, "ok", await reporteService.turnosPorEspecialidad(rango));
  } catch (error) {
    next(error);
  }
}

/** `GET /reportes/turnos-por-sede?desde=&hasta=` */
export async function turnosPorSede(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rango = validarRangoFechas(req.query);
    responder(res, 200, "ok", await reporteService.turnosPorSede(rango));
  } catch (error) {
    next(error);
  }
}

/** `GET /reportes/ranking-medicos?desde=&hasta=` — la lista completa, ordenada. */
export async function rankingMedicos(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rango = validarRangoFechas(req.query);
    responder(res, 200, "ok", await reporteService.rankingMedicos(rango));
  } catch (error) {
    next(error);
  }
}

/** `GET /reportes/tasa-cancelacion?desde=&hasta=` */
export async function tasaCancelacion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rango = validarRangoFechas(req.query);
    responder(res, 200, "ok", await reporteService.tasaCancelacion(rango));
  } catch (error) {
    next(error);
  }
}
