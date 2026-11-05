/**
 * CONTROLLER: médicos
 * ===================
 *
 * Expone el listado de médicos con sus especialidades.
 *
 * Flujo: `medico.routes.ts` → este controller → `validarFiltrosMedico`
 * (`medico.validators.ts`) → `medico.service.ts` → `responder`.
 */

import { NextFunction, Request, Response } from "express";
import * as medicoService from "../services/medico.service";
import { responder } from "../utils/respuesta";
import { validarFiltrosMedico } from "../validators/medico.validators";

/**
 * `GET /medicos?id_especialidad=&id_sede=` — médicos con sus especialidades.
 *
 * Los dos filtros son opcionales y se combinan con AND. Sin filtros devuelve
 * todos los médicos: lo usa el operador en "Nueva agenda", que tiene que poder
 * elegir un médico aunque todavía no tenga agenda cargada.
 */
export async function listar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filtros = validarFiltrosMedico(req.query);
    const medicos = await medicoService.listarMedicos(filtros);
    responder(res, 200, "ok", medicos);
  } catch (error) {
    next(error);
  }
}
