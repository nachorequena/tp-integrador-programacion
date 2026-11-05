/**
 * CONTROLLER: pacientes
 * =====================
 *
 * Búsqueda de pacientes, alta por el operador y edición de "mis datos".
 *
 * Flujo: `paciente.routes.ts` → este controller → validators
 * (`paciente.validators.ts`, `auth.validators.ts`) → `paciente.service.ts` /
 * `auth.service.ts` → `responder`.
 */

import { NextFunction, Request, Response } from "express";
import * as authService from "../services/auth.service";
import * as pacienteService from "../services/paciente.service";
import { ErrorHttp } from "../utils/errorHttp";
import { responder } from "../utils/respuesta";
import { validarRegistro } from "../validators/auth.validators";
import { validarBusquedaPacientes, validarMisDatos } from "../validators/paciente.validators";

/**
 * `GET /pacientes?busqueda=` — busca pacientes por DNI o apellido.
 *
 * Lo usan el operador (para asignar turnos) y el médico (para consultar
 * historiales).
 */
export async function buscar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const busqueda = validarBusquedaPacientes(req.query);
    const pacientes = await pacienteService.buscarPacientes(busqueda);
    responder(res, 200, "ok", pacientes);
  } catch (error) {
    next(error);
  }
}

/**
 * `POST /pacientes` — el operador da de alta un paciente.
 *
 * Mismo validador y mismo service que el registro público
 * (`POST /auth/registro`): la consigna pide "los mismos datos y validaciones
 * que el registro de la semana 1". La diferencia es que acá hay token, así que
 * la auditoría registra al operador como quien hizo el alta.
 */
export async function crear(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const datos = validarRegistro(req.body);
    const paciente = await authService.registrarPaciente(datos);
    responder(res, 201, "ok", paciente);
  } catch (error) {
    next(error);
  }
}

/**
 * `PUT /pacientes/mis-datos` — el paciente modifica sus propios datos.
 *
 * El id sale del token: un paciente no puede editar los datos de otro.
 */
export async function actualizarMisDatos(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.usuario) {
      throw new ErrorHttp(401, "Falta el token de autenticación");
    }
    const datos = validarMisDatos(req.body);
    const usuario = await pacienteService.actualizarMisDatos(req.usuario.id, datos);
    responder(res, 200, "ok", usuario);
  } catch (error) {
    next(error);
  }
}
