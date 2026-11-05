/**
 * CONTROLLER: disponibilidad de turnos
 * ====================================
 *
 * Fechas con agenda y horarios libres de un médico, para la solicitud de
 * turno paso a paso del frontend.
 *
 * Flujo: `disponibilidad.routes.ts` → este controller →
 * `disponibilidad.validators.ts` → `disponibilidad.service.ts` → `responder`.
 */

import { NextFunction, Request, Response } from "express";
import * as disponibilidadService from "../services/disponibilidad.service";
import { responder } from "../utils/respuesta";
import {
  validarConsultaDisponibilidad,
  validarConsultaHorarios,
} from "../validators/disponibilidad.validators";

/**
 * `GET /disponibilidad/fechas?id_medico=&id_especialidad=&id_sede=`
 *
 * Responde un array de fechas "YYYY-MM-DD" (desde hoy) con algún horario
 * libre. Alimenta el paso "fecha" del frontend.
 */
export async function fechas(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const consulta = validarConsultaDisponibilidad(req.query);
    const fechasLibres = await disponibilidadService.listarFechasDisponibles(consulta);
    responder(res, 200, "ok", fechasLibres);
  } catch (error) {
    next(error);
  }
}

/**
 * `GET /disponibilidad/horarios?id_medico=&id_especialidad=&id_sede=&fecha=`
 *
 * Responde los horarios libres de esa fecha (`[{ hora, id_agenda }]`).
 * Alimenta el paso "horario" del frontend.
 */
export async function horarios(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { consulta, fecha } = validarConsultaHorarios(req.query);
    const libres = await disponibilidadService.listarHorariosDisponibles(consulta, fecha);
    responder(res, 200, "ok", libres);
  } catch (error) {
    next(error);
  }
}
