/**
 * CONTROLLER: sede
 * ================
 *
 * CRUD de sucursales. Todas las rutas están restringidas al rol `admin`
 * (ver src/routes/sede.routes.ts), así que acá no hay lógica de permisos.
 *
 * SOBRE EL CÓDIGO DE LAS RESPUESTAS: el DELETE responde **200 con `datos:
 * null`** y no 204. El 204 (No Content) es lo habitual en una API REST, pero
 * obliga a devolver el cuerpo vacío, y el enunciado exige que TODAS las
 * respuestas lleven la estructura uniforme. Entre el purismo REST y el
 * requisito del TP, gana el requisito.
 */

import { NextFunction, Request, Response } from "express";
import * as sedeService from "../services/sede.service";
import { validarIdRuta } from "../validators/comunes";
import { validarSede } from "../validators/entidades.validators";
import { responder } from "../utils/respuesta";

/**
 * `GET /sedes` — listado de sedes. Solo para el rol `admin`.
 *
 * Es también el endpoint que demuestra que `verificarRol` funciona, según pidió
 * la consigna de la semana 1.
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

/** `POST /sedes` — alta. Responde 201 porque crea un recurso nuevo. */
export async function crear(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const datos = validarSede(req.body);
    const sede = await sedeService.crearSede(datos);
    responder(res, 201, "ok", sede);
  } catch (error) {
    next(error);
  }
}

/** `PUT /sedes/:id` — modificación. Devuelve la sede ya actualizada. */
export async function actualizar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = validarIdRuta(req.params.id);
    const datos = validarSede(req.body);
    const sede = await sedeService.actualizarSede(id, datos);
    responder(res, 200, "ok", sede);
  } catch (error) {
    next(error);
  }
}

/**
 * `DELETE /sedes/:id` — baja.
 *
 * El service rechaza con 409 si la sede tiene usuarios o agendas asociadas.
 */
export async function eliminar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = validarIdRuta(req.params.id);
    await sedeService.eliminarSede(id);
    responder(res, 200, "ok", null);
  } catch (error) {
    next(error);
  }
}
