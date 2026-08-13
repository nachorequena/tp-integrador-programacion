/**
 * CONTROLLER: cobertura
 * =====================
 *
 * Expone el listado de obras sociales que consume el formulario de registro.
 */

import { NextFunction, Request, Response } from "express";
import * as coberturaService from "../services/cobertura.service";
import { responder } from "../utils/respuesta";

/**
 * `GET /coberturas` — listado de coberturas disponibles.
 *
 * Es público a propósito: quien está por registrarse todavía no tiene token, y
 * necesita ver las coberturas para poder elegir una. Es información no
 * sensible (nombres de obras sociales), así que no hay nada que proteger.
 *
 * Si la tabla estuviera vacía, `datos` sería un array vacío `[]` y el código
 * seguiría siendo 200: que no haya resultados no es un error, es una respuesta
 * válida. Un 404 acá sería incorrecto.
 *
 * @param _req Sin uso: el endpoint no recibe parámetros.
 * @param res Respuesta de Express.
 * @param next Salida hacia el manejador de errores si falla la consulta.
 */
export async function listar(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const coberturas = await coberturaService.listarCoberturas();
    responder(res, 200, "ok", coberturas);
  } catch (error) {
    next(error);
  }
}
