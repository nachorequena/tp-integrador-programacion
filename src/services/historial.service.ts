/**
 * SERVICE: historial clínico
 * ==========================
 *
 * Gestiona el registro y consulta del historial clínico.
 */

import {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2";
import { pool } from "../database/conexion";
import {
  DatosHistorial,
  HistorialClinico,
} from "../types";
import { ErrorHttp } from "../utils/errorHttp";

/**
 * Registra el historial clínico de un turno atendido.
 *
 * Solo puede hacerlo el médico que atendió ese turno.
 */
export async function registrarHistorial(
  idTurno: number,
  idMedico: number,
  idSedeMedico: number | null,
  datos: DatosHistorial,
): Promise<number> {
  if (
    !datos.diagnostico ||
    datos.diagnostico.trim() === ""
  ) {
    throw new ErrorHttp(
      400,
      "El diagnóstico es obligatorio",
    );
  }

  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT
       t.id,
       t.id_paciente,
       t.estado,
       a.id_medico,
       a.id_sede
     FROM turno t
     INNER JOIN agenda a
       ON a.id = t.id_agenda
     WHERE t.id = ?
     LIMIT 1`,
    [idTurno],
  );

  if (filas.length === 0) {
    throw new ErrorHttp(
      404,
      "Turno no encontrado",
    );
  }

  const turno = filas[0];

  if (turno.estado !== "atendido") {
    throw new ErrorHttp(
      400,
      "El historial solo puede registrarse en un turno atendido",
    );
  }

  if (Number(turno.id_medico) !== idMedico) {
    throw new ErrorHttp(
      403,
      "El médico solo puede registrar historial de sus propios turnos",
    );
  }

  if (
    idSedeMedico === null ||
    Number(turno.id_sede) !== idSedeMedico
  ) {
    throw new ErrorHttp(
      403,
      "El turno pertenece a otra sede",
    );
  }

  const [historialExistente] =
    await pool.query<RowDataPacket[]>(
      `SELECT id
       FROM historial_clinico
       WHERE id_turno = ?
       LIMIT 1`,
      [idTurno],
    );

  if (historialExistente.length > 0) {
    throw new ErrorHttp(
      409,
      "El turno ya tiene un historial clínico registrado",
    );
  }

  const [resultado] =
    await pool.query<ResultSetHeader>(
      `INSERT INTO historial_clinico
        (
          id_turno,
          id_medico,
          id_paciente,
          diagnostico,
          tratamiento,
          observaciones
        )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        idTurno,
        idMedico,
        turno.id_paciente,
        datos.diagnostico,
        datos.tratamiento || null,
        datos.observaciones || null,
      ],
    );

  return resultado.insertId;
}

/**
 * Devuelve todo el historial clínico del paciente.
 */
export async function listarHistorialPaciente(
  idPaciente: number,
): Promise<HistorialClinico[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT
       id,
       id_turno,
       id_medico,
       id_paciente,
       diagnostico,
       tratamiento,
       observaciones,
       fecha_registro
     FROM historial_clinico
     WHERE id_paciente = ?
     ORDER BY fecha_registro DESC`,
    [idPaciente],
  );

  return filas as HistorialClinico[];
}

/**
 * Permite a un médico consultar únicamente los registros
 * de turnos atendidos por él.
 */
export async function listarHistorialMedico(
  idMedico: number,
  idPaciente: number,
): Promise<HistorialClinico[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT
       id,
       id_turno,
       id_medico,
       id_paciente,
       diagnostico,
       tratamiento,
       observaciones,
       fecha_registro
     FROM historial_clinico
     WHERE id_medico = ?
       AND id_paciente = ?
     ORDER BY fecha_registro DESC`,
    [idMedico, idPaciente],
  );

  return filas as HistorialClinico[];
}