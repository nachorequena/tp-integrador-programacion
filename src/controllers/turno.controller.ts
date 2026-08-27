/**
 * CONTROLLER: turno
 * =================
 */

import {
  NextFunction,
  Request,
  Response,
} from "express";
import * as turnoService from "../services/turno.service";
import { responder } from "../utils/respuesta";
import { ErrorHttp } from "../utils/errorHttp";

/**
 * POST /turnos
 */
export async function crear(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;

    let idPaciente: number;

if (usuario.rol === "paciente") {
  idPaciente = usuario.id;
} else {
  if (!req.body.id_paciente) {
    throw new ErrorHttp(
      400,
      "El operador debe indicar el paciente",
    );
  }

  if (
    usuario.id_sede === null ||
    Number(req.body.id_sede) !== usuario.id_sede
  ) {
    throw new ErrorHttp(
      403,
      "El operador solo puede solicitar turnos de su propia sede",
    );
  }

  idPaciente = Number(req.body.id_paciente);
}

    const idTurno = await turnoService.crearTurno(
      req.body,
      idPaciente,
    );

    responder(res, 201, "ok", {
      id: idTurno,
      mensaje: "Turno confirmado correctamente",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /turnos/:id/cancelar
 */
export async function cancelar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;
    const idTurno = Number(req.params.id);

    await turnoService.cancelarTurno(
      idTurno,
      usuario.id,
      usuario.rol,
      usuario.id_sede,
    );

    responder(res, 200, "ok", {
      mensaje: "Turno cancelado correctamente",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /turnos/:id/atender
 */
export async function atender(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;
    const idTurno = Number(req.params.id);

    await turnoService.atenderTurno(
      idTurno,
      usuario.id,
      usuario.id_sede,
    );

    responder(res, 200, "ok", {
      mensaje: "Turno marcado como atendido",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /turnos/mios
 */
export async function misTurnos(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;

    const turnos =
      await turnoService.listarTurnosPaciente(
        usuario.id,
      );

    responder(res, 200, "ok", turnos);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /turnos/medico?fecha=YYYY-MM-DD
 */
export async function turnosMedico(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;
    const fecha = String(req.query.fecha || "");

    if (!fecha) {
      throw new ErrorHttp(
        400,
        "La fecha es obligatoria",
      );
    }

    const turnos =
      await turnoService.listarTurnosMedico(
        usuario.id,
        fecha,
      );

    responder(res, 200, "ok", turnos);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /turnos/sede?fecha=YYYY-MM-DD
 */
export async function turnosSede(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = req.usuario!;
    const fecha = String(req.query.fecha || "");

    if (!fecha) {
      throw new ErrorHttp(
        400,
        "La fecha es obligatoria",
      );
    }

    if (usuario.id_sede === null) {
      throw new ErrorHttp(
        403,
        "El usuario no tiene una sede asignada",
      );
    }

    const turnos =
      await turnoService.listarTurnosSede(
        usuario.id_sede,
        fecha,
      );

    responder(res, 200, "ok", turnos);
  } catch (error) {
    next(error);
  }
}