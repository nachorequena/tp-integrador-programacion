/**
 * CONTROLLER: cobertura
 * =====================
 *
 * CRUD de obras sociales (solo `admin`) más un listado público.
 *
 * `listar` y `listarDisponibles` devuelven exactamente lo mismo y llaman al
 * mismo service. Existen por separado porque se montan en rutas con
 * protecciones distintas:
 *
 *   GET /coberturas              → solo admin (el listado del CRUD)
 *   GET /coberturas/disponibles  → público   (lo consume el registro)
 *
 * Tenerlos separados hace que la diferencia se lea en el archivo de rutas, que
 * es donde uno va a buscar qué está protegido y qué no.
 */

import { NextFunction, Request, Response } from "express";
import * as coberturaService from "../services/cobertura.service";
import { validarIdRuta } from "../validators/comunes";
import { validarCobertura } from "../validators/entidades.validators";
import { responder } from "../utils/respuesta";

/** `GET /coberturas` — listado del CRUD. Solo `admin`. */
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

/**
 * `GET /coberturas/disponibles` — listado público de solo lectura.
 *
 * Es el servicio que pide la consigna para reutilizar desde el registro de
 * pacientes. No lleva token: quien se está por registrar todavía no tiene uno,
 * así que protegerlo haría imposible completar el formulario.
 */
export async function listarDisponibles(
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

/** `POST /coberturas` — alta. */
export async function crear(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const datos = validarCobertura(req.body);
    const cobertura = await coberturaService.crearCobertura(datos);
    responder(res, 201, "ok", cobertura);
  } catch (error) {
    next(error);
  }
}

/** `PUT /coberturas/:id` — modificación. */
export async function actualizar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = validarIdRuta(req.params.id);
    const datos = validarCobertura(req.body);
    const cobertura = await coberturaService.actualizarCobertura(id, datos);
    responder(res, 200, "ok", cobertura);
  } catch (error) {
    next(error);
  }
}

/**
 * `DELETE /coberturas/:id` — baja.
 *
 * El service rechaza con 409 si algún usuario la tiene asignada o si aparece en
 * algún turno.
 */
export async function eliminar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = validarIdRuta(req.params.id);
    await coberturaService.eliminarCobertura(id);
    responder(res, 200, "ok", null);
  } catch (error) {
    next(error);
  }
}
