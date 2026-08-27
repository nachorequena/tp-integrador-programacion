/**
 * SERVICE: turno
 * ==============
 *
 * Contiene la lógica principal de los turnos:
 * - alta
 * - cancelación
 * - atención
 * - listados
 * - validación de agenda
 * - validación de superposición
 * - cobertura automática del paciente
 * - generación de notificaciones
 */

import {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2";
import { pool } from "../database/conexion";
import { DatosNuevoTurno, Turno } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import * as notificacionService from "./notificacion.service";

/**
 * Busca la cobertura registrada para un paciente.
 */
async function obtenerCoberturaPaciente(
  idPaciente: number,
): Promise<number> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT id_cobertura
     FROM usuario
     WHERE id = ? AND rol = 'paciente'`,
    [idPaciente],
  );

  if (filas.length === 0) {
    throw new ErrorHttp(404, "Paciente no encontrado");
  }

  const idCobertura = filas[0].id_cobertura;

  if (!idCobertura) {
    throw new ErrorHttp(
      400,
      "El paciente no tiene una cobertura registrada",
    );
  }

  return Number(idCobertura);
}

/**
 * Busca una agenda que coincida con:
 * médico, especialidad, sede y fecha.
 */
async function buscarAgenda(
  idMedico: number,
  idEspecialidad: number,
  idSede: number,
  fecha: string,
  hora: string,
): Promise<number> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT id
     FROM agenda
     WHERE id_medico = ?
       AND id_especialidad = ?
       AND id_sede = ?
       AND fecha = ?
       AND ? >= hora_entrada
       AND ? < hora_salida
     LIMIT 1`,
    [
      idMedico,
      idEspecialidad,
      idSede,
      fecha,
      hora,
      hora,
    ],
  );

  if (filas.length === 0) {
    throw new ErrorHttp(
      400,
      "El horario solicitado no está disponible en la agenda del médico",
    );
  }

  return Number(filas[0].id);
}

/**
 * Controla que no exista otro turno confirmado
 * para la misma agenda, fecha y hora.
 */
async function verificarSuperposicion(
  idAgenda: number,
  fecha: string,
  hora: string,
): Promise<void> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT id
     FROM turno
     WHERE id_agenda = ?
       AND fecha = ?
       AND hora = ?
       AND estado = 'confirmado'
     LIMIT 1`,
    [idAgenda, fecha, hora],
  );

  if (filas.length > 0) {
    throw new ErrorHttp(
      409,
      "Ya existe un turno confirmado para ese horario",
    );
  }
}

/**
 * Crea un nuevo turno confirmado.
 */
export async function crearTurno(
  datos: DatosNuevoTurno,
  idPaciente: number,
): Promise<number> {
  if (!datos.nota || datos.nota.trim() === "") {
    throw new ErrorHttp(400, "La nota es obligatoria");
  }

  const idCobertura =
    await obtenerCoberturaPaciente(idPaciente);

  const idAgenda = await buscarAgenda(
    datos.id_medico,
    datos.id_especialidad,
    datos.id_sede,
    datos.fecha,
    datos.hora,
  );

  await verificarSuperposicion(
    idAgenda,
    datos.fecha,
    datos.hora,
  );

  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO turno
      (
        nota,
        id_agenda,
        fecha,
        hora,
        id_paciente,
        id_cobertura,
        estado
      )
     VALUES (?, ?, ?, ?, ?, ?, 'confirmado')`,
    [
      datos.nota,
      idAgenda,
      datos.fecha,
      datos.hora,
      idPaciente,
      idCobertura,
    ],
  );

  await notificacionService.crearNotificacion(
    idPaciente,
    "turno_confirmado",
    `Tu turno del ${datos.fecha} a las ${datos.hora} fue confirmado`,
  );

  return resultado.insertId;
}

/**
 * Busca un turno por id.
 */
export async function buscarTurnoPorId(
  idTurno: number,
): Promise<Turno> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT
       id,
       nota,
       id_agenda,
       fecha,
       hora,
       id_paciente,
       id_cobertura,
       estado
     FROM turno
     WHERE id = ?
     LIMIT 1`,
    [idTurno],
  );

  if (filas.length === 0) {
    throw new ErrorHttp(404, "Turno no encontrado");
  }

  return filas[0] as Turno;
}

/**
 * Cancela un turno.
 */
export async function cancelarTurno(
  idTurno: number,
  idUsuario: number,
  rol: string,
  idSedeUsuario: number | null,
): Promise<void> {
  const turno = await buscarTurnoPorId(idTurno);

  if (turno.estado !== "confirmado") {
    throw new ErrorHttp(
      400,
      "Solo se pueden cancelar turnos confirmados",
    );
  }

  if (rol === "paciente") {
    if (turno.id_paciente !== idUsuario) {
      throw new ErrorHttp(
        403,
        "No podés cancelar un turno de otro paciente",
      );
    }
  } else {
    const [filasAgenda] =
      await pool.query<RowDataPacket[]>(
        `SELECT id_sede, id_medico
         FROM agenda
         WHERE id = ?`,
        [turno.id_agenda],
      );

    if (filasAgenda.length === 0) {
      throw new ErrorHttp(
        404,
        "La agenda del turno no existe",
      );
    }

    const agenda = filasAgenda[0];

    if (
      idSedeUsuario === null ||
      Number(agenda.id_sede) !== idSedeUsuario
    ) {
      throw new ErrorHttp(
        403,
        "El turno pertenece a otra sede",
      );
    }

    if (
      rol === "medico" &&
      Number(agenda.id_medico) !== idUsuario
    ) {
      throw new ErrorHttp(
        403,
        "El médico solo puede operar sobre sus propios turnos",
      );
    }
  }

  await pool.query<ResultSetHeader>(
    `UPDATE turno
     SET estado = 'cancelado'
     WHERE id = ?`,
    [idTurno],
  );

  await notificacionService.crearNotificacion(
    turno.id_paciente,
    "turno_cancelado",
    `Tu turno del ${turno.fecha} a las ${turno.hora} fue cancelado`,
  );
}

/**
 * Marca un turno como atendido.
 */
export async function atenderTurno(
  idTurno: number,
  idMedico: number,
  idSedeMedico: number | null,
): Promise<void> {
  const turno = await buscarTurnoPorId(idTurno);

  if (turno.estado !== "confirmado") {
    throw new ErrorHttp(
      400,
      "Solo se pueden atender turnos confirmados",
    );
  }

  const [filasAgenda] =
    await pool.query<RowDataPacket[]>(
      `SELECT id_medico, id_sede
       FROM agenda
       WHERE id = ?`,
      [turno.id_agenda],
    );

  if (filasAgenda.length === 0) {
    throw new ErrorHttp(
      404,
      "La agenda del turno no existe",
    );
  }

  const agenda = filasAgenda[0];

  if (Number(agenda.id_medico) !== idMedico) {
    throw new ErrorHttp(
      403,
      "El médico solo puede atender sus propios turnos",
    );
  }

  if (
    idSedeMedico === null ||
    Number(agenda.id_sede) !== idSedeMedico
  ) {
    throw new ErrorHttp(
      403,
      "El turno pertenece a otra sede",
    );
  }

  await pool.query<ResultSetHeader>(
    `UPDATE turno
     SET estado = 'atendido'
     WHERE id = ?`,
    [idTurno],
  );

  await notificacionService.crearNotificacion(
    turno.id_paciente,
    "turno_atendido",
    `Tu turno del ${turno.fecha} a las ${turno.hora} fue marcado como atendido`,
  );
}

/**
 * Turnos del paciente autenticado.
 */
export async function listarTurnosPaciente(
  idPaciente: number,
): Promise<Turno[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT
       id,
       nota,
       id_agenda,
       fecha,
       hora,
       id_paciente,
       id_cobertura,
       estado
     FROM turno
     WHERE id_paciente = ?
     ORDER BY fecha ASC, hora ASC`,
    [idPaciente],
  );

  return filas as Turno[];
}

/**
 * Turnos del médico para una fecha determinada.
 */
export async function listarTurnosMedico(
  idMedico: number,
  fecha: string,
): Promise<RowDataPacket[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT t.*
     FROM turno t
     INNER JOIN agenda a ON a.id = t.id_agenda
     WHERE a.id_medico = ?
       AND t.fecha = ?
     ORDER BY t.hora ASC`,
    [idMedico, fecha],
  );

  return filas;
}

/**
 * Turnos de una sede para una fecha determinada.
 */
export async function listarTurnosSede(
  idSede: number,
  fecha: string,
): Promise<RowDataPacket[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT t.*
     FROM turno t
     INNER JOIN agenda a ON a.id = t.id_agenda
     WHERE a.id_sede = ?
       AND t.fecha = ?
     ORDER BY t.hora ASC`,
    [idSede, fecha],
  );

  return filas;
}