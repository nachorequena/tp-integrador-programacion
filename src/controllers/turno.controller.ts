/**
 * CONTROLLER: turno
 * =================
 *
 * Alta, cancelación, atención y listados de turnos.
 *
 * Como el de agenda, estos controllers le pasan `req.usuario` al service:
 * `verificarRol` filtra por rol, pero las reglas de esta semana dependen de
 * QUIÉN pide (un paciente solo cancela el suyo, un operador solo los de su
 * sede). Esa parte la resuelve el service, que es el que puede leer la fila.
 *
 * Lo que sí se decide acá es de quién es el turno que se está sacando: el
 * paciente lo saca para sí mismo y el operador en representación de otro. Es
 * una regla del endpoint, no de la fila, así que no baja al service.
 */

import { NextFunction, Request, Response } from "express";
import * as turnoService from "../services/turno.service";
import { PayloadJWT } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { responder } from "../utils/respuesta";
import { validarIdRuta } from "../validators/comunes";
import {
  validarFechaObligatoria,
  validarNuevoTurno,
} from "../validators/turno.validators";

/**
 * Devuelve el usuario autenticado o corta la petición.
 *
 * En la práctica nunca falla, porque todas estas rutas van detrás de
 * `verificarToken`. Está para que TypeScript descarte el `undefined` y para
 * que, si alguien monta una ruta sin el middleware, el error sea explícito.
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
 * `POST /turnos` — solicita un turno.
 *
 * Lo puede pedir el propio paciente o un operador en su representación. En el
 * primer caso el paciente sale del token y `id_paciente` del cuerpo se ignora:
 * si se tomara del body, un paciente podría sacarle turnos a otro.
 */
export async function crear(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const datos = validarNuevoTurno(req.body);

    let idPaciente: number;

    if (usuario.rol === "paciente") {
      idPaciente = usuario.id;
    } else {
      if (datos.id_paciente === undefined) {
        throw new ErrorHttp(400, "El operador debe indicar el paciente");
      }

      // El operador solo opera sobre su propia sede, como pide la consigna.
      if (usuario.id_sede === null || datos.id_sede !== usuario.id_sede) {
        throw new ErrorHttp(
          403,
          "El operador solo puede solicitar turnos de su propia sede",
        );
      }

      idPaciente = datos.id_paciente;
    }

    const idTurno = await turnoService.crearTurno(datos, idPaciente);

    responder(res, 201, "ok", {
      id: idTurno,
      mensaje: "Turno confirmado correctamente",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * `PATCH /turnos/:id/cancelar` — pasa el turno a `cancelado`.
 *
 * Se usa PATCH y no PUT porque no se reemplaza el turno: se cambia un solo
 * campo de estado.
 */
export async function cancelar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const idTurno = validarIdRuta(req.params.id);

    await turnoService.cancelarTurno(
      idTurno,
      usuario.id,
      usuario.rol,
      usuario.id_sede,
    );

    responder(res, 200, "ok", { mensaje: "Turno cancelado correctamente" });
  } catch (error) {
    next(error);
  }
}

/** `PATCH /turnos/:id/atender` — el médico pasa el turno a `atendido`. */
export async function atender(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const idTurno = validarIdRuta(req.params.id);

    await turnoService.atenderTurno(idTurno, usuario.id, usuario.id_sede);

    responder(res, 200, "ok", { mensaje: "Turno marcado como atendido" });
  } catch (error) {
    next(error);
  }
}

/**
 * `GET /turnos/mios` — turnos del paciente autenticado.
 *
 * El paciente sale del token, nunca de la URL: así no hay forma de pedir los
 * turnos de otro.
 */
export async function misTurnos(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const turnos = await turnoService.listarTurnosPaciente(usuario.id);
    responder(res, 200, "ok", turnos);
  } catch (error) {
    next(error);
  }
}

/** `GET /turnos/medico?fecha=YYYY-MM-DD` — turnos programados del médico. */
export async function turnosMedico(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const fecha = validarFechaObligatoria(req.query);

    const turnos = await turnoService.listarTurnosMedico(usuario.id, fecha);
    responder(res, 200, "ok", turnos);
  } catch (error) {
    next(error);
  }
}

/**
 * `GET /turnos/sede?fecha=YYYY-MM-DD` — turnos de la sede, para el operador.
 *
 * La sede sale del token y no de la query: el operador solo puede ver la suya.
 */
export async function turnosSede(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const fecha = validarFechaObligatoria(req.query);

    if (usuario.id_sede === null) {
      throw new ErrorHttp(403, "El usuario no tiene una sede asignada");
    }

    const turnos = await turnoService.listarTurnosSede(usuario.id_sede, fecha);
    responder(res, 200, "ok", turnos);
  } catch (error) {
    next(error);
  }
}
