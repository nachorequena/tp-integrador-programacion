/**
 * CONTROLLER: auditoría
 * =====================
 *
 * Solo lectura. Las entradas del log no se crean por acá: las escribe el
 * middleware `auditoria.ts` cuando una operación sensible termina bien. Un
 * endpoint de alta permitiría fabricar registros de auditoría, que es
 * exactamente lo contrario de lo que un log sirve.
 *
 * Tampoco hay modificación ni baja, por el mismo motivo: un log que se puede
 * editar no prueba nada.
 */

import { NextFunction, Request, Response } from "express";
import * as auditoriaService from "../services/auditoria.service";
import { responder } from "../utils/respuesta";
import { validarFiltrosAuditoria } from "../validators/auditoria.validators";

/**
 * `GET /auditoria` — listado filtrable por usuario, entidad y rango de fechas.
 *
 * Los cuatro filtros son opcionales y se combinan entre sí.
 */
export async function listar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filtros = validarFiltrosAuditoria(req.query);
    const logs = await auditoriaService.listarLogs(filtros);
    responder(res, 200, "ok", logs);
  } catch (error) {
    next(error);
  }
}
