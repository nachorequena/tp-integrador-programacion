/**
 * CONTROLLER: especialidad
 * ========================
 *
 * CRUD de especialidades médicas. Todas las rutas son solo para el rol `admin`.
 */

import { NextFunction, Request, Response } from "express";
import * as especialidadService from "../services/especialidad.service";
import { validarIdRuta } from "../validators/comunes";
import { validarEspecialidad } from "../validators/entidades.validators";
import { responder } from "../utils/respuesta";

/** `GET /especialidades` — listado. */
export async function listar(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const especialidades = await especialidadService.listarEspecialidades();
    responder(res, 200, "ok", especialidades);
  } catch (error) {
    next(error);
  }
}

/** `POST /especialidades` — alta. */
export async function crear(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const datos = validarEspecialidad(req.body);
    const especialidad = await especialidadService.crearEspecialidad(datos);
    responder(res, 201, "ok", especialidad);
  } catch (error) {
    next(error);
  }
}

/** `PUT /especialidades/:id` — modificación. */
export async function actualizar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = validarIdRuta(req.params.id);
    const datos = validarEspecialidad(req.body);
    const especialidad = await especialidadService.actualizarEspecialidad(id, datos);
    responder(res, 200, "ok", especialidad);
  } catch (error) {
    next(error);
  }
}

/**
 * `DELETE /especialidades/:id` — baja.
 *
 * El service rechaza con 409 si algún médico la tiene asociada o si aparece en
 * alguna agenda.
 */
export async function eliminar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = validarIdRuta(req.params.id);
    await especialidadService.eliminarEspecialidad(id);
    responder(res, 200, "ok", null);
  } catch (error) {
    next(error);
  }
}
