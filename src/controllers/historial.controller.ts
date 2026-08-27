/**
 * CONTROLLER: historial clínico
 * =============================
 */

import {
  NextFunction,
  Request,
  Response,
} from "express";
import * as historialService from "../services/historial.service";
import { responder } from "../utils/respuesta";
import { ErrorHttp } from "../utils/errorHttp";

/**
 * POST /historial/:idTurno
 */
export async function registrar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;
    const idTurno = Number(req.params.idTurno);

    const idHistorial =
      await historialService.registrarHistorial(
        idTurno,
        usuario.id,
        usuario.id_sede,
        req.body,
      );

    responder(res, 201, "ok", {
      id: idHistorial,
      mensaje:
        "Historial clínico registrado correctamente",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /historial/mio
 */
export async function miHistorial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;

    const historial =
      await historialService.listarHistorialPaciente(
        usuario.id,
      );

    responder(res, 200, "ok", historial);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /historial/paciente/:idPaciente
 */
export async function historialPacienteMedico(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;
    const idPaciente =
      Number(req.params.idPaciente);

    if (!idPaciente) {
      throw new ErrorHttp(
        400,
        "Paciente inválido",
      );
    }

    const historial =
      await historialService.listarHistorialMedico(
        usuario.id,
        idPaciente,
      );

    responder(res, 200, "ok", historial);
  } catch (error) {
    next(error);
  }
}