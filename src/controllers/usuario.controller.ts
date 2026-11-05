/**
 * CONTROLLER: gestión de usuarios (rol administrador)
 * ===================================================
 *
 * Listado paginado, alta y edición de usuarios.
 *
 * Flujo: `usuario.routes.ts` → este controller → `usuario.validators.ts` →
 * `gestion-usuario.service.ts` → `responder`.
 */

import { NextFunction, Request, Response } from "express";
import * as gestionUsuarioService from "../services/gestion-usuario.service";
import { responder } from "../utils/respuesta";
import { validarIdRuta } from "../validators/comunes";
import { validarFiltrosUsuarios, validarUsuarioAdmin } from "../validators/usuario.validators";

/**
 * `GET /usuarios?nombre=&apellido=&rol=&id_sede=&pagina=&limite=`
 *
 * Responde `{ items, total, pagina, limite }`.
 */
export async function listar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { filtros, paginacion } = validarFiltrosUsuarios(req.query);
    const pagina = await gestionUsuarioService.listarUsuarios(filtros, paginacion);
    responder(res, 200, "ok", pagina);
  } catch (error) {
    next(error);
  }
}

/** `POST /usuarios` — alta de un operador, médico o administrador. */
export async function crear(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const datos = validarUsuarioAdmin(req.body, true);
    const usuario = await gestionUsuarioService.crearUsuario(datos);
    responder(res, 201, "ok", usuario);
  } catch (error) {
    next(error);
  }
}

/** `PUT /usuarios/:id` — edición de cualquier usuario, incluidos pacientes. */
export async function actualizar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = validarIdRuta(req.params.id);
    const datos = validarUsuarioAdmin(req.body, false);
    const usuario = await gestionUsuarioService.actualizarUsuario(id, datos);
    responder(res, 200, "ok", usuario);
  } catch (error) {
    next(error);
  }
}
