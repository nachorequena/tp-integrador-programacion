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
 * Columnas de `turno` con alias `t`, para los listados que hacen JOIN.
 *
 * Se listan explícitas en vez de `t.*` para que la forma de la respuesta no
 * cambie sola si mañana se agrega una columna a la tabla.
 */
const SELECT_TURNO = `SELECT
       t.id, t.nota, t.id_agenda, t.fecha, t.hora,
       t.id_paciente, t.id_cobertura, t.estado
     FROM turno t`;

/**
 * Busca la cobertura registrada para un paciente.
 *
 * La consigna exige que la cobertura del turno salga de acá y no del cuerpo de
 * la petición, para que nadie pueda pedir un turno con una cobertura que no le
 * corresponde. El filtro por `rol = 'paciente'` no es decorativo: impide que un
 * operador saque un turno a nombre de un médico o de otro operador.
 *
 * @param idPaciente Id del paciente titular del turno.
 * @returns El id de su cobertura.
 * @throws `ErrorHttp` 404 si no existe un paciente con ese id.
 * @throws `ErrorHttp` 400 si el paciente no tiene cobertura registrada.
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
 * Busca el rango de agenda que cubre el horario pedido.
 *
 * Es la validación central del alta: la consigna prohíbe dar un turno fuera de
 * los rangos horarios del médico. Si no hay agenda que lo contenga, no hay
 * turno posible.
 *
 * El rango se compara como texto porque las columnas son `varchar(5)`, no
 * `time`. Funciona porque "HH:MM" tiene siempre el mismo largo y dos dígitos
 * por parte, así que el orden alfabético coincide con el cronológico. Depende
 * de que la hora venga con el cero adelante, y eso lo garantiza
 * `turno.validators.ts`.
 *
 * El límite superior es `<` y no `<=` a propósito: un rango que termina a las
 * 12:00 no incluye un turno a las 12:00, porque el médico ya se fue.
 *
 * @param idMedico Médico elegido.
 * @param idEspecialidad Especialidad pedida.
 * @param idSede Sede pedida.
 * @param fecha Fecha del turno, "YYYY-MM-DD".
 * @param hora Hora del turno, "HH:MM".
 * @returns El id de la agenda que cubre ese horario.
 * @throws `ErrorHttp` 400 si ninguna agenda del médico lo cubre.
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
 * Controla que el horario no esté ya tomado.
 *
 * Se compara la hora exacta y no un solapamiento por duración porque la tabla
 * `turno` no tiene columna de duración: el turno es un instante dentro del
 * rango, no un intervalo.
 *
 * Alcanza con mirar la misma agenda porque el alta de agenda (semana 2) ya
 * rechaza rangos solapados del mismo médico en la misma fecha. Es decir: un
 * par (médico, fecha, hora) cae como mucho en una agenda. Sin esa garantía,
 * este chequeo tendría que recorrer todas las agendas del médico.
 *
 * Solo bloquean los turnos `confirmado`: uno cancelado libera el horario.
 *
 * @param idAgenda Agenda donde cae el turno.
 * @param fecha Fecha del turno.
 * @param hora Hora del turno.
 * @throws `ErrorHttp` 409 si ya hay un turno confirmado a esa hora.
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
 * Da de alta un turno en estado `confirmado`.
 *
 * Orden de las validaciones: primero la cobertura (identifica al paciente),
 * después la agenda (¿el médico atiende a esa hora?) y por último la
 * superposición (¿el lugar está libre?). Va de lo más general a lo más
 * puntual, para que el mensaje de error apunte a la causa real.
 *
 * Al confirmarse se genera la notificación para el paciente, como pide la
 * consigna.
 *
 * @param datos Datos del turno, ya validados en formato.
 * @param idPaciente Titular del turno. Sale del token si lo pide el propio
 *   paciente, o del cuerpo si lo pide un operador en su representación.
 * @returns El id del turno creado.
 * @throws `ErrorHttp` 404 si el paciente no existe.
 * @throws `ErrorHttp` 400 si el paciente no tiene cobertura o el horario no
 *   está en la agenda del médico.
 * @throws `ErrorHttp` 409 si ya hay un turno confirmado a esa hora.
 */
export async function crearTurno(
  datos: DatosNuevoTurno,
  idPaciente: number,
): Promise<number> {
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
 *
 * @param idTurno Id del turno.
 * @returns La fila del turno.
 * @throws `ErrorHttp` 404 si no existe.
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
 * Cancela un turno y notifica al paciente.
 *
 * Las reglas de acceso son distintas según quién cancela, y por eso no alcanza
 * con `verificarRol`:
 *   - `paciente`: solo el suyo.
 *   - `operador`: cualquiera de su sede.
 *   - `medico`: los de su sede que además sean suyos.
 *
 * La sede y el médico se leen de la agenda del turno, no del turno: `turno` no
 * guarda esos datos, los hereda del rango de agenda al que pertenece.
 *
 * @param idTurno Turno a cancelar.
 * @param idUsuario Id de quien cancela, del token.
 * @param rol Rol de quien cancela, del token.
 * @param idSedeUsuario Sede de quien cancela. Es `null` para los pacientes.
 * @throws `ErrorHttp` 404 si el turno o su agenda no existen.
 * @throws `ErrorHttp` 400 si el turno no está confirmado.
 * @throws `ErrorHttp` 403 si el turno no le corresponde a quien cancela.
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
 * Marca un turno como `atendido` y notifica al paciente.
 *
 * Se dejó la carga del historial clínico como un paso posterior —la consigna
 * admite las dos variantes—; los dos registros quedan asociados por
 * `historial_clinico.id_turno`.
 *
 * @param idTurno Turno a atender.
 * @param idMedico Médico que atiende, del token.
 * @param idSedeMedico Sede del médico, del token.
 * @throws `ErrorHttp` 404 si el turno o su agenda no existen.
 * @throws `ErrorHttp` 400 si el turno no está confirmado.
 * @throws `ErrorHttp` 403 si el turno es de otro médico o de otra sede.
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
 * Turnos del paciente autenticado, del más próximo al menos próximo.
 *
 * @param idPaciente Id del paciente, tomado del token.
 * @returns Sus turnos, ordenados por fecha y hora ascendente.
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
 * Turnos programados de un médico para una fecha.
 *
 * El JOIN con `agenda` es necesario porque `turno` no guarda el médico: lo
 * hereda del rango de agenda en el que cae.
 *
 * @param idMedico Id del médico, tomado del token.
 * @param fecha Fecha a consultar, "YYYY-MM-DD".
 * @returns Sus turnos de ese día, ordenados por hora.
 */
export async function listarTurnosMedico(
  idMedico: number,
  fecha: string,
): Promise<Turno[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_TURNO}
     INNER JOIN agenda a ON a.id = t.id_agenda
     WHERE a.id_medico = ?
       AND t.fecha = ?
     ORDER BY t.hora ASC`,
    [idMedico, fecha],
  );

  return filas as Turno[];
}

/**
 * Turnos de una sede para una fecha, para uso del operador.
 *
 * @param idSede Id de la sede, tomado del token del operador.
 * @param fecha Fecha a consultar, "YYYY-MM-DD".
 * @returns Los turnos de esa sede ese día, ordenados por hora.
 */
export async function listarTurnosSede(
  idSede: number,
  fecha: string,
): Promise<Turno[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_TURNO}
     INNER JOIN agenda a ON a.id = t.id_agenda
     WHERE a.id_sede = ?
       AND t.fecha = ?
     ORDER BY t.hora ASC`,
    [idSede, fecha],
  );

  return filas as Turno[];
}