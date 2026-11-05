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
 * `GET /auditoria?usuario=&id_usuario=&entidad=&desde=&hasta=&pagina=&limite=`
 *
 * Listado paginado, de lo más reciente a lo más antiguo, filtrable por
 * usuario, entidad y rango de fechas. Los filtros son opcionales y se combinan
 * entre sí.
 *
 * Responde `{ items, total, pagina, limite }` (desde la etapa del frontend; en
 * la semana 4 era un array sin paginar). Flujo: este controller →
 * `auditoria.validators.ts` → `auditoria.service.ts`.
 */
export async function listar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { filtros, paginacion } = validarFiltrosAuditoria(req.query);
    const pagina = await auditoriaService.listarLogs(filtros, paginacion);
    responder(res, 200, "ok", pagina);
  } catch (error) {
    next(error);
  }
}
