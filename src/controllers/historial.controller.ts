/**
 * CONTROLLER: historial clínico
 * =============================
 *
 * Alta y consulta del historial clínico.
 *
 * La consigna define DOS vistas distintas del mismo dato, y por eso hay dos
 * endpoints de lectura en vez de uno con filtros:
 *
 *   - el paciente ve la totalidad de SU historial  → `GET /historial/mio`
 *   - el médico ve solo lo que él mismo registró   → `GET /historial/paciente/:id`
 *
 * Separarlos hace que el destinatario salga siempre del token y nunca de la
 * URL, así ninguno de los dos roles puede pedir el historial de otro cambiando
 * un número a mano.
 */

import { NextFunction, Request, Response } from "express";
import * as historialService from "../services/historial.service";
import { PayloadJWT } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { responder } from "../utils/respuesta";
import { validarIdRuta } from "../validators/comunes";
import { validarHistorial } from "../validators/historial.validators";

/**
 * Devuelve el usuario autenticado o corta la petición.
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
 * `POST /historial/:idTurno` — el médico registra el resultado de la consulta.
 *
 * El turno tiene que estar `atendido`: el service lo verifica. Se optó por
 * dejar la carga como un paso posterior a la atención (la consigna admite las
 * dos variantes); los dos registros quedan asociados por `historial_clinico.id_turno`.
 */
export async function registrar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const idTurno = validarIdRuta(req.params.idTurno);
    const datos = validarHistorial(req.body);

    const idHistorial = await historialService.registrarHistorial(
      idTurno,
      usuario.id,
      usuario.id_sede,
      datos,
    );

    responder(res, 201, "ok", {
      id: idHistorial,
      mensaje: "Historial clínico registrado correctamente",
    });
  } catch (error) {
    next(error);
  }
}

/** `GET /historial/mio` — el paciente consulta la totalidad de su historial. */
export async function miHistorial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const historial = await historialService.listarHistorialPaciente(usuario.id);
    responder(res, 200, "ok", historial);
  } catch (error) {
    next(error);
  }
}

/**
 * `GET /historial/paciente/:idPaciente` — vista del médico.
 *
 * Devuelve únicamente los registros que cargó ESTE médico sobre ese paciente.
 * El filtro por `id_medico` lo aplica el service sobre el id del token, así que
 * pedir el id de otro paciente no expone lo que registró un colega.
 */
export async function historialPacienteMedico(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const idPaciente = validarIdRuta(req.params.idPaciente);

    const historial = await historialService.listarHistorialMedico(
      usuario.id,
      idPaciente,
    );

    responder(res, 200, "ok", historial);
  } catch (error) {
    next(error);
  }
}
