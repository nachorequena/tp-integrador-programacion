/**
 * SERVICE: historial clínico
 * ==========================
 *
 * Registro y consulta del historial clínico (tabla `historial_clinico`).
 *
 * Flujo: `historial.routes.ts` → `historial.controller.ts` → este service →
 * tablas `historial_clinico`, `turno`, `agenda`, `usuario`, `especialidad` y
 * `sede`.
 *
 * Quién lo usa desde el frontend:
 *   - el médico, en "Historial de pacientes" (`listarHistorialMedico`): solo
 *     ve los registros de los turnos que atendió él mismo;
 *   - el paciente, en "Mi historial clínico" (`listarHistorialPaciente`).
 *
 * El historial también se puede guardar en el mismo pedido que marca el
 * turno como atendido (`turno.service.ts` → `atenderTurno`), que es lo que
 * usa la pantalla del médico. `registrarHistorial` queda para cargarlo
 * después, como en la semana 3.
 */

import {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2";
import { pool } from "../database/conexion";
import { DatosHistorial, HistorialDetallado } from "../types";
import { ErrorHttp } from "../utils/errorHttp";

/**
 * Registra el historial clínico de un turno atendido.
 *
 * Tres condiciones, en este orden: el turno tiene que estar `atendido`, lo
 * tiene que haber atendido ESTE médico, y no puede tener ya un historial
 * cargado. La última evita duplicados: la tabla no tiene UNIQUE sobre
 * `id_turno`, así que sin este control quedarían dos historiales del mismo
 * turno diciendo cosas distintas.
 *
 * El paciente no se recibe por parámetro sino que se lee del turno: si viniera
 * de afuera, se podría cargar un diagnóstico en la ficha de otra persona.
 *
 * @param idTurno Turno ya atendido.
 * @param idMedico Médico que registra, del token.
 * @param datos Diagnóstico, tratamiento y observaciones ya validados.
 * @returns El id del historial creado.
 * @throws `ErrorHttp` 404 si el turno no existe.
 * @throws `ErrorHttp` 400 si el turno no está atendido.
 * @throws `ErrorHttp` 403 si el turno es de otro médico. No importa la sede:
 *   desde la consigna final un médico puede atender en varias sedes.
 * @throws `ErrorHttp` 409 si el turno ya tiene historial.
 */
export async function registrarHistorial(
  idTurno: number,
  idMedico: number,
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
 * SELECT base de las consultas, con los datos del turno que originó cada
 * registro.
 *
 * Un diagnóstico suelto no dice nada si no se sabe de qué consulta salió: la
 * fecha y hora del turno, el médico, la especialidad y la sede lo ponen en
 * contexto. Los JOIN son internos porque las claves son NOT NULL con FK.
 */
const SELECT_HISTORIAL = `
  SELECT h.id, h.id_turno, h.id_medico, h.id_paciente,
         h.diagnostico, h.tratamiento, h.observaciones, h.fecha_registro,
         t.fecha AS fecha_turno, t.hora AS hora_turno,
         CONCAT(m.apellido, ', ', m.nombre) AS medico,
         e.descripcion AS especialidad,
         s.nombre AS sede
    FROM historial_clinico h
    JOIN turno t ON t.id = h.id_turno
    JOIN agenda a ON a.id = t.id_agenda
    JOIN usuario m ON m.id = h.id_medico
    JOIN especialidad e ON e.id = a.id_especialidad
    JOIN sede s ON s.id = a.id_sede`;

/**
 * Devuelve la totalidad del historial clínico de un paciente.
 *
 * Es la vista del propio paciente, que según la consigna accede a todo su
 * historial. El id sale del token, nunca de la URL.
 *
 * @param idPaciente Id del paciente, tomado del token.
 * @returns Sus registros, del más reciente al más antiguo.
 */
export async function listarHistorialPaciente(
  idPaciente: number,
): Promise<HistorialDetallado[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_HISTORIAL}
      WHERE h.id_paciente = ?
      ORDER BY t.fecha DESC, t.hora DESC, h.fecha_registro DESC`,
    [idPaciente],
  );
  return filas as HistorialDetallado[];
}

/**
 * Vista del médico sobre el historial de un paciente.
 *
 * Filtra por `id_medico` además de por paciente, que es lo que hace cumplir el
 * criterio de aceptación: un médico no puede ver registros de turnos que no
 * atendió él. Si el paciente nunca lo vio, devuelve una lista vacía en vez de
 * un 403, porque decir "existe pero no podés verlo" ya sería filtrar
 * información clínica.
 *
 * @param idMedico Id del médico, tomado del token.
 * @param idPaciente Paciente a consultar.
 * @returns Los registros que cargó este médico sobre ese paciente.
 */
export async function listarHistorialMedico(
  idMedico: number,
  idPaciente: number,
): Promise<HistorialDetallado[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_HISTORIAL}
      WHERE h.id_medico = ? AND h.id_paciente = ?
      ORDER BY t.fecha DESC, t.hora DESC, h.fecha_registro DESC`,
    [idMedico, idPaciente],
  );
  return filas as HistorialDetallado[];
}
