/**
 * CONTROLLER: sede
 * ================
 *
 * Expone el listado de sucursales de la clínica.
 */

import { NextFunction, Request, Response } from "express";
import * as sedeService from "../services/sede.service";
import { responder } from "../utils/respuesta";

/**
 * `GET /sedes` — listado de sedes. Solo para el rol `admin`.
 *
 * Es el endpoint que demuestra que `verificarRol` funciona, según pide la
 * consigna ("al menos un endpoint de prueba protegido por cada middleware").
 *
 * Notar que en este archivo no hay ni una línea sobre permisos: la protección
 * se declara al montar la ruta (ver src/routes/sede.routes.ts). Cuando el
 * controller se ejecuta, los middlewares ya dejaron pasar la petición, así que
 * acá se puede asumir que quien pide es un admin autenticado.
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
    const sedes = await sedeService.listarSedes();
    responder(res, 200, "ok", sedes);
  } catch (error) {
    next(error);
  }
}
