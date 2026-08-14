/**
 * CONTROLLER: agenda médica
 * =========================
 *
 * CRUD de los rangos horarios de atención.
 *
 * A diferencia de los otros controllers, estos le pasan `req.usuario` al
 * service. Es necesario porque la agenda tiene reglas que dependen de QUIÉN
 * pide, no solo de su rol: un médico solo puede tocar la suya. `verificarRol`
 * ya filtró los roles habilitados (`medico`, `operador`, `admin`); la
 * pertenencia de cada fila la resuelve el service.
 */

import { NextFunction, Request, Response } from "express";
import * as agendaService from "../services/agenda.service";
import { PayloadJWT } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { responder } from "../utils/respuesta";
import {
  validarAgenda,
  validarFiltrosAgenda,
} from "../validators/agenda.validators";
import { validarIdRuta } from "../validators/comunes";

/**
 * Devuelve el usuario autenticado o corta la petición.
 *
 * En la práctica nunca falla, porque todas estas rutas van detrás de
 * `verificarToken`. Está por dos motivos: TypeScript necesita descartar el
 * `undefined` (el campo es opcional), y si alguien monta una ruta sin el
 * middleware, el error es explícito en vez de un "cannot read property id of
 * undefined".
 *
 * @param req Petición en curso.
 * @returns El payload del token.
 * @throws `ErrorHttp` 401 si no hay usuario autenticado.
 */
function usuarioAutenticado(req: Request): PayloadJWT {
  if (!req.usuario) {
    throw new ErrorHttp(401, "Falta el token de autenticación");
  }
  return req.usuario;
}

/**
 * `GET /agendas` — listado filtrable por `id_medico`, `id_sede` y `fecha`.
 *
 * Los filtros vienen por query string y se combinan entre sí. Si quien consulta
 * es `medico`, el service le fuerza el filtro a su propia agenda.
 */
export async function listar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const filtros = validarFiltrosAgenda(req.query);
    const agendas = await agendaService.listarAgendas(filtros, usuario);
    responder(res, 200, "ok", agendas);
  } catch (error) {
    next(error);
  }
}

/** `POST /agendas` — alta de un rango horario. */
export async function crear(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const datos = validarAgenda(req.body);
    const agenda = await agendaService.crearAgenda(datos, usuario);
    responder(res, 201, "ok", agenda);
  } catch (error) {
    next(error);
  }
}

/** `PUT /agendas/:id` — modificación. */
export async function actualizar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const id = validarIdRuta(req.params.id);
    const datos = validarAgenda(req.body);
    const agenda = await agendaService.actualizarAgenda(id, datos, usuario);
    responder(res, 200, "ok", agenda);
  } catch (error) {
    next(error);
  }
}

/**
 * `DELETE /agendas/:id` — baja.
 *
 * El service rechaza con 409 si la agenda tiene turnos asignados.
 */
export async function eliminar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const id = validarIdRuta(req.params.id);
    await agendaService.eliminarAgenda(id, usuario);
    responder(res, 200, "ok", null);
  } catch (error) {
    next(error);
  }
}
