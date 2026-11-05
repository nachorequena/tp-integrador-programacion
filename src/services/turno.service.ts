/**
 * SERVICE: turno
 * ==============
 *
 * Lógica de negocio de los turnos: alta, cancelación, atención (con su
 * historial clínico) y los listados de cada rol.
 *
 * Flujo: `turno.routes.ts` → `turno.controller.ts` → este service → tablas
 * `turno`, `agenda`, `usuario`, `historial_clinico` y `notificacion` (vía
 * `notificacion.service.ts`).
 *
 * Quién lo usa desde el frontend:
 *   - paciente: "Solicitar turno" (alta) y "Mis turnos" (listado + cancelar);
 *   - operador: "Nuevo turno" (alta en nombre de un paciente) y los turnos de
 *     su sede (listado + cancelar);
 *   - médico: "Turnos del día" (listado + atender + cancelar).
 *
 * Cambios de la etapa del frontend (consigna final):
 *   - Los listados devuelven `TurnoDetallado`: nombres de médico, paciente,
 *     especialidad y sede, fecha de nacimiento del paciente (el médico ve la
 *     edad) y el resumen del historial si el turno fue atendido.
 *   - El médico opera sobre SUS turnos en cualquier sede donde atienda. La
 *     restricción de la semana 3 ("solo turnos de su propia sede") se
 *     reemplazó, porque ahora un médico puede tener agenda en varias sedes.
 *   - El alta solo acepta horarios futuros y de la grilla de 30 minutos, igual
 *     que los que ofrece `disponibilidad.service.ts`.
 *   - Atender puede recibir el historial clínico en el mismo pedido: estado e
 *     historial se guardan juntos, en una transacción.
 *   - Cada evento notifica al paciente y al médico, y al operador si fue él
 *     quien hizo la acción, para que el contador de la campana del frontend
 *     se actualice para quien actúa.
 */

import { ResultSetHeader, RowDataPacket } from "mysql2";
import { PoolConnection } from "mysql2/promise";
import { pool } from "../database/conexion";
import {
  DatosHistorial,
  DatosNuevoTurno,
  FiltrosTurnosDia,
  PayloadJWT,
  TurnoDetallado,
} from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { aFechaLocal, aMinutos, yaPaso } from "../utils/fechas";
import { DURACION_TURNO, esHorarioDeLaGrilla } from "./disponibilidad.service";
import * as notificacionService from "./notificacion.service";

/**
 * SELECT base de los listados, con todo resuelto por JOIN.
 *
 * - `agenda` aporta médico, especialidad y sede: `turno` no los guarda, los
 *   hereda del rango de agenda en el que cae.
 * - `historial_clinico` va con LEFT JOIN porque solo existe para los turnos
 *   atendidos: con un JOIN común, los turnos sin historial desaparecerían.
 * - Las columnas se listan explícitas: así nunca sale la `password` de los
 *   usuarios unidos, y la forma de la respuesta no cambia sola si se agrega
 *   una columna.
 */
const SELECT_TURNO_DETALLE = `
  SELECT t.id, t.nota, t.id_agenda, t.fecha, t.hora,
         t.id_paciente, t.id_cobertura, t.estado,
         a.id_medico, a.id_especialidad, a.id_sede,
         CONCAT(m.apellido, ', ', m.nombre) AS medico,
         e.descripcion AS especialidad,
         s.nombre AS sede,
         CONCAT(p.apellido, ', ', p.nombre) AS paciente,
         p.dni AS dni_paciente,
         p.fecha_nacimiento AS fecha_nacimiento_paciente,
         c.nombre AS cobertura,
         h.diagnostico, h.tratamiento, h.observaciones
    FROM turno t
    JOIN agenda a ON a.id = t.id_agenda
    JOIN usuario m ON m.id = a.id_medico
    JOIN especialidad e ON e.id = a.id_especialidad
    JOIN sede s ON s.id = a.id_sede
    JOIN usuario p ON p.id = t.id_paciente
    JOIN cobertura c ON c.id = t.id_cobertura
    LEFT JOIN historial_clinico h ON h.id_turno = t.id`;

/** Los tres eventos de un turno que generan notificaciones. */
type EventoTurno = "confirmado" | "cancelado" | "atendido";

/**
 * Busca la cobertura registrada para un paciente.
 *
 * La consigna exige que la cobertura del turno salga de acá y no del cuerpo
 * de la petición, para que nadie pueda pedir un turno con una cobertura que no
 * le corresponde. El filtro por `rol = 'paciente'` impide que un operador saque
 * un turno a nombre de un médico o de otro operador.
 *
 * @param conexion Conexión de la transacción en curso.
 * @param idPaciente Id del paciente titular del turno.
 * @returns El id de su cobertura.
 * @throws `ErrorHttp` 404 si no existe un paciente con ese id.
 * @throws `ErrorHttp` 400 si el paciente no tiene cobertura registrada.
 */
async function obtenerCoberturaPaciente(
  conexion: PoolConnection,
  idPaciente: number,
): Promise<number> {
  // Usa la conexión de la transacción (no el pool) para que la lectura forme
  // parte de la misma transacción que el INSERT.
  const [filas] = await conexion.query<RowDataPacket[]>(
    "SELECT id_cobertura FROM usuario WHERE id = ? AND rol = 'paciente'",
    [idPaciente],
  );

  // Sin filas: no hay usuario con ese id, o existe pero no es paciente → 404.
  if (filas.length === 0) {
    throw new ErrorHttp(404, "Paciente no encontrado");
  }
  // Existe pero su id_cobertura es NULL → 400 (no se puede sacar turno).
  if (!filas[0].id_cobertura) {
    throw new ErrorHttp(400, "El paciente no tiene una cobertura registrada");
  }
  return Number(filas[0].id_cobertura);
}

/**
 * Busca un turno con todos sus datos resueltos.
 *
 * @param idTurno Id del turno.
 * @returns El turno detallado.
 * @throws `ErrorHttp` 404 si no existe.
 */
export async function buscarTurnoDetallado(idTurno: number): Promise<TurnoDetallado> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_TURNO_DETALLE} WHERE t.id = ? LIMIT 1`,
    [idTurno],
  );
  if (filas.length === 0) {
    throw new ErrorHttp(404, "Turno no encontrado");
  }
  return filas[0] as TurnoDetallado;
}

/**
 * Genera las notificaciones de un evento de turno.
 *
 * Destinatarios:
 *   - el paciente, siempre (lo pedía la semana 3);
 *   - el médico, siempre: también le interesa que le confirmen o cancelen un
 *     turno de su agenda;
 *   - el operador, solo si fue quien hizo la acción. El criterio de aceptación
 *     pide que el contador de quien realiza la acción se actualice sin
 *     recargar, y un operador no es ni paciente ni médico del turno.
 *
 * Las fechas van en formato día/mes/año porque el texto llega armado a la
 * pantalla, y la consigna pide fechas en formato local.
 *
 * @param turno Turno ya detallado (con nombres).
 * @param evento Qué le pasó al turno.
 * @param actor Quién hizo la acción (payload del token).
 */
async function notificarEvento(
  turno: TurnoDetallado,
  evento: EventoTurno,
  actor: PayloadJWT,
): Promise<void> {
  // "15/11/2026 a las 09:30": aFechaLocal pasa "2026-11-15" a día/mes/año.
  const cuando = `${aFechaLocal(String(turno.fecha))} a las ${turno.hora}`;
  // Tipo guardado en la tabla: "turno_confirmado", "turno_cancelado"...
  const tipo = `turno_${evento}`;
  // Palabra para el mensaje: "atendido" se redacta más largo; los otros dos
  // eventos se usan tal cual ("confirmado", "cancelado").
  const texto = evento === "atendido" ? "marcado como atendido" : evento;

  // 1) Al paciente, siempre. Cada `await` hace un INSERT en `notificacion`.
  await notificacionService.crearNotificacion(
    turno.id_paciente,
    tipo,
    `Tu turno del ${cuando} con ${turno.medico} (${turno.especialidad}) fue ${texto}`,
  );
  // 2) Al médico del turno, siempre.
  await notificacionService.crearNotificacion(
    turno.id_medico,
    tipo,
    `El turno de ${turno.paciente} del ${cuando} en ${turno.sede} fue ${texto}`,
  );
  // 3) Al operador SOLO si él hizo la acción (`actor` = quien vino en el
  //    token). Si la hizo el paciente o el médico, ya recibieron la suya arriba.
  if (actor.rol === "operador") {
    await notificacionService.crearNotificacion(
      actor.id,
      tipo,
      `Gestionaste el turno de ${turno.paciente} del ${cuando}: ${texto}`,
    );
  }
}

/**
 * Da de alta un turno en estado `confirmado`.
 *
 * Todo pasa dentro de una TRANSACCIÓN que bloquea el rango de agenda con
 * `SELECT ... FOR UPDATE`. Es lo que resuelve el caso que menciona la
 * consigna, "el horario se ocupó mientras tanto": si dos pacientes confirman
 * el mismo horario al mismo tiempo, el segundo espera a que termine el
 * primero, y cuando le toca ya ve el turno tomado y recibe un 409 claro, en
 * vez de quedar dos turnos superpuestos.
 *
 * Orden de las validaciones, de lo más general a lo más puntual:
 *   1. el paciente existe y tiene cobertura;
 *   2. el horario es futuro;
 *   3. hay un rango de agenda del médico que lo cubre, en esa especialidad y
 *      sede, y el horario es de la grilla de 30 minutos;
 *   4. no hay un turno confirmado a menos de 30 minutos en ese rango.
 *
 * @param datos Datos del turno, ya validados en formato.
 * @param idPaciente Titular del turno (del token si lo pide el paciente, del
 *   cuerpo si lo pide un operador).
 * @param actor Quién pide el turno, para las notificaciones.
 * @returns El turno creado, detallado.
 * @throws `ErrorHttp` 404/400 si el paciente no existe o no tiene cobertura.
 * @throws `ErrorHttp` 400 si el horario ya pasó o no es de la agenda.
 * @throws `ErrorHttp` 409 si el horario ya fue tomado.
 */
export async function crearTurno(
  datos: DatosNuevoTurno,
  idPaciente: number,
  actor: PayloadJWT,
): Promise<TurnoDetallado> {
  // Se pide UNA conexión dedicada al pool (y no `pool.query` directo) porque
  // una transacción tiene que ejecutar todas sus consultas por la misma
  // conexión: si cada consulta saliera por una distinta, el BEGIN/COMMIT no
  // las agruparía.
  const conexion = await pool.getConnection();
  // Acá se guarda el id del turno insertado, para buscarlo después del COMMIT.
  let idTurno: number;

  // try / catch / finally:
  //   - try: todos los pasos de la transacción. Cualquier `throw` (las
  //     validaciones de abajo o un error de MySQL) salta directo al catch.
  //   - catch: deshace TODO lo hecho (ROLLBACK) y vuelve a lanzar el error
  //     para que llegue al controller → manejadorErrores.
  //   - finally: se ejecuta SIEMPRE (haya salido bien o mal) y libera la conexión.
  try {
    // BEGIN: desde acá, nada queda guardado de verdad hasta el COMMIT.
    await conexion.beginTransaction();

    // VALIDACIÓN 1 — el paciente existe y tiene cobertura. Si no, la función
    // lanza un 404 ("Paciente no encontrado") o un 400 ("no tiene cobertura").
    // La cobertura del turno SIEMPRE sale de acá, nunca del cuerpo.
    const idCobertura = await obtenerCoberturaPaciente(conexion, idPaciente);

    // VALIDACIÓN 2 — el horario es futuro. `yaPaso` arma la fecha+hora y la
    // compara con "ahora": si ya pasó (incluso hoy más temprano) → 400.
    if (yaPaso(datos.fecha, datos.hora)) {
      throw new ErrorHttp(400, "No se puede pedir un turno para un horario que ya pasó");
    }

    // VALIDACIÓN 3 — busca el rango de agenda que cubre ese horario: mismo
    // médico, especialidad, sede y fecha, con hora_entrada <= hora pedida y
    // hora_salida > hora pedida (un turno a la hora exacta de salida no entra).

    // Las horas son varchar(5) "HH:MM": compararlas como texto respeta el
    // orden cronológico porque siempre tienen dos dígitos (lo garantiza el
    // validador). `FOR UPDATE` bloquea el rango hasta el COMMIT.
    const [agendas] = await conexion.query<RowDataPacket[]>(
      `SELECT id, hora_entrada, hora_salida
         FROM agenda
        WHERE id_medico = ? AND id_especialidad = ? AND id_sede = ? AND fecha = ?
          AND hora_entrada <= ? AND hora_salida > ?
        LIMIT 1
          FOR UPDATE`,
      [datos.id_medico, datos.id_especialidad, datos.id_sede, datos.fecha, datos.hora, datos.hora],
    );

    // `agendas[0]` es el rango encontrado, o `undefined` si no hubo ninguno.
    const agenda = agendas[0];
    // El if rechaza con 400 en dos casos:
    //   a) `!agenda`: el médico no atiende a esa hora (en esa sede/especialidad);
    //   b) `!esHorarioDeLaGrilla(...)`: la hora no cae en la grilla de 30 min
    //      contada desde la entrada (rango 08:00 → vale 08:30, no vale 08:10),
    //      o el turno no llega a terminar antes de la hora de salida.
    if (!agenda || !esHorarioDeLaGrilla(agenda as { hora_entrada: string; hora_salida: string }, datos.hora)) {
      throw new ErrorHttp(
        400,
        "El horario solicitado no está disponible en la agenda del médico",
      );
    }

    // VALIDACIÓN 4 — el horario sigue libre. Trae las horas de los turnos
    // CONFIRMADOS de ese rango (los cancelados liberan el lugar, por eso no
    // cuentan; los atendidos son del pasado).
    const [confirmados] = await conexion.query<RowDataPacket[]>(
      "SELECT hora FROM turno WHERE id_agenda = ? AND estado = 'confirmado' AND hora IS NOT NULL",
      [agenda.id],
    );
    // Pasa "HH:MM" a minutos desde medianoche ("09:30" → 570) para poder restar.
    const pedido = aMinutos(datos.hora);
    // `.some` devuelve true si AL MENOS UN turno confirmado está a menos de 30
    // minutos del pedido (Math.abs = distancia sin importar si es antes o
    // después). Eso significa que se superpondrían.
    const ocupado = confirmados.some(
      (turno) => Math.abs(aMinutos(String(turno.hora)) - pedido) < DURACION_TURNO,
    );
    // Ocupado → 409 Conflict. Es el error que el frontend detecta para volver
    // al paso "Horario" del stepper y recargar los horarios libres.
    if (ocupado) {
      throw new ErrorHttp(409, "Ese horario ya fue tomado por otro paciente. Elegí otro horario.");
    }

    // Todo validado: se inserta el turno, siempre en estado 'confirmado'. Los
    // `?` se reemplazan en orden por los valores del array (mysql2 los escapa,
    // así no hay inyección SQL).
    const [resultado] = await conexion.query<ResultSetHeader>(
      `INSERT INTO turno (nota, id_agenda, fecha, hora, id_paciente, id_cobertura, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'confirmado')`,
      [datos.nota, agenda.id, datos.fecha, datos.hora, idPaciente, idCobertura],
    );
    // `insertId` es el id autoincremental que MySQL le asignó a la fila nueva.
    idTurno = resultado.insertId;

    // COMMIT: recién ahora el turno queda guardado y se libera el bloqueo del
    // rango de agenda (otro pedido que estuviera esperando sigue y verá este turno).
    await conexion.commit();
  } catch (error) {
    // Algo falló (una validación o la base): ROLLBACK deshace todo lo hecho
    // desde el BEGIN, así no queda nada a medias. Después se vuelve a lanzar
    // el MISMO error (`throw error`) para que el controller lo reciba y el
    // cliente vea el 400/404/409 correcto.
    await conexion.rollback();
    throw error;
  } finally {
    // Devolver la conexión al pool SIEMPRE, salga bien o mal: si no, el pool
    // se queda sin conexiones libres y la API se cuelga.
    conexion.release();
  }

  // Fuera de la transacción (el turno ya está guardado): se vuelve a leer con
  // JOINs para tener los nombres de médico, paciente, sede y especialidad, que
  // necesitan las notificaciones y la respuesta al frontend.
  const turno = await buscarTurnoDetallado(idTurno);
  // Crea las notificaciones "turno_confirmado" (paciente, médico y, si lo
  // pidió un operador, el operador).
  await notificarEvento(turno, "confirmado", actor);
  // Lo recibe el controller, que responde 201.
  return turno;
}

/**
 * Controla que quien opera sobre un turno tenga derecho a hacerlo.
 *
 * Reglas (no alcanza con `verificarRol`, porque dependen de la fila):
 *   - `paciente`: solo los suyos;
 *   - `operador`: los de su sede (la sede sale del rango de agenda);
 *   - `medico`: los suyos, en CUALQUIER sede donde tenga agenda (cambio de la
 *     consigna final respecto de la semana 3).
 *
 * @param turno Turno a operar.
 * @param usuario Payload del token de quien opera.
 * @throws `ErrorHttp` 403 si el turno no le corresponde.
 */
function validarPermisoSobreTurno(turno: TurnoDetallado, usuario: PayloadJWT): void {
  if (usuario.rol === "paciente" && turno.id_paciente !== usuario.id) {
    throw new ErrorHttp(403, "No podés operar sobre un turno de otro paciente");
  }
  if (usuario.rol === "operador" && Number(turno.id_sede) !== usuario.id_sede) {
    throw new ErrorHttp(403, "El turno pertenece a otra sede");
  }
  if (usuario.rol === "medico" && Number(turno.id_medico) !== usuario.id) {
    throw new ErrorHttp(403, "El médico solo puede operar sobre sus propios turnos");
  }
}

/**
 * Cancela un turno confirmado y genera las notificaciones.
 *
 * @param idTurno Turno a cancelar.
 * @param usuario Payload del token de quien cancela.
 * @returns El turno ya cancelado, detallado.
 * @throws `ErrorHttp` 404 si el turno no existe.
 * @throws `ErrorHttp` 403 si no le corresponde a quien cancela.
 * @throws `ErrorHttp` 400 si el turno no está confirmado.
 */
export async function cancelarTurno(
  idTurno: number,
  usuario: PayloadJWT,
): Promise<TurnoDetallado> {
  const turno = await buscarTurnoDetallado(idTurno);
  validarPermisoSobreTurno(turno, usuario);

  if (turno.estado !== "confirmado") {
    throw new ErrorHttp(400, "Solo se pueden cancelar turnos confirmados");
  }

  await pool.query("UPDATE turno SET estado = 'cancelado' WHERE id = ?", [idTurno]);

  const cancelado = await buscarTurnoDetallado(idTurno);
  await notificarEvento(cancelado, "cancelado", usuario);
  return cancelado;
}

/**
 * Marca un turno como `atendido` y, si viene, guarda su historial clínico.
 *
 * Con historial, el cambio de estado y el INSERT van en una transacción:
 * si el historial fallara, el turno no puede quedar "atendido" sin el
 * diagnóstico que el médico acaba de escribir en la pantalla.
 *
 * Sin historial se comporta como en la semana 3 (el historial se puede cargar
 * después con `POST /historial/:idTurno`).
 *
 * @param idTurno Turno a atender.
 * @param usuario Payload del token del médico.
 * @param historial Diagnóstico, tratamiento y observaciones, ya validados.
 * @returns El turno atendido, detallado (incluye el historial).
 * @throws `ErrorHttp` 404 si el turno no existe.
 * @throws `ErrorHttp` 403 si el turno es de otro médico.
 * @throws `ErrorHttp` 400 si el turno no está confirmado.
 */
export async function atenderTurno(
  idTurno: number,
  usuario: PayloadJWT,
  historial?: DatosHistorial,
): Promise<TurnoDetallado> {
  const turno = await buscarTurnoDetallado(idTurno);
  validarPermisoSobreTurno(turno, usuario);

  if (turno.estado !== "confirmado") {
    throw new ErrorHttp(400, "Solo se pueden atender turnos confirmados");
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    await conexion.query("UPDATE turno SET estado = 'atendido' WHERE id = ?", [idTurno]);

    if (historial) {
      // El paciente sale del turno, nunca del cuerpo: así no se puede cargar
      // un diagnóstico en la ficha de otra persona.
      await conexion.query(
        `INSERT INTO historial_clinico
           (id_turno, id_medico, id_paciente, diagnostico, tratamiento, observaciones)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          idTurno,
          usuario.id,
          turno.id_paciente,
          historial.diagnostico,
          historial.tratamiento ?? null,
          historial.observaciones ?? null,
        ],
      );
    }

    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }

  const atendido = await buscarTurnoDetallado(idTurno);
  await notificarEvento(atendido, "atendido", usuario);
  return atendido;
}

/**
 * Turnos del paciente autenticado, ordenados por proximidad.
 *
 * Primero los que vienen (del más cercano al más lejano) y después los que ya
 * pasaron (del más reciente al más viejo). Ordenar todo por fecha ascendente
 * pondría arriba un turno de hace dos años; ordenar todo descendente pondría
 * arriba el turno más lejano en el futuro. Ninguna de las dos es "del más
 * próximo al menos próximo", que es lo que pide la consigna.
 *
 * @param idPaciente Id del paciente, tomado del token.
 * @returns Sus turnos detallados.
 */
export async function listarTurnosPaciente(idPaciente: number): Promise<TurnoDetallado[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_TURNO_DETALLE}
      WHERE t.id_paciente = ?
      ORDER BY (CONCAT(t.fecha, ' ', t.hora) < DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i')),
               CASE WHEN CONCAT(t.fecha, ' ', t.hora) >= DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i')
                    THEN CONCAT(t.fecha, ' ', t.hora) END ASC,
               CONCAT(t.fecha, ' ', t.hora) DESC`,
    [idPaciente],
  );
  return filas as TurnoDetallado[];
}

/**
 * Turnos de un médico para una fecha, en todas las sedes donde atiende.
 *
 * @param idMedico Id del médico, tomado del token.
 * @param filtros Fecha obligatoria y sede opcional (filtro de la pantalla).
 * @returns Los turnos de ese día, ordenados por hora (proximidad).
 */
export async function listarTurnosMedico(
  idMedico: number,
  filtros: FiltrosTurnosDia,
): Promise<TurnoDetallado[]> {
  const parametros: unknown[] = [idMedico, filtros.fecha];
  let sql = `${SELECT_TURNO_DETALLE} WHERE a.id_medico = ? AND t.fecha = ?`;

  if (filtros.id_sede !== undefined) {
    sql += " AND a.id_sede = ?";
    parametros.push(filtros.id_sede);
  }

  const [filas] = await pool.query<RowDataPacket[]>(`${sql} ORDER BY t.hora, t.id`, parametros);
  return filas as TurnoDetallado[];
}

/**
 * Turnos de una sede para una fecha, para el operador.
 *
 * El filtro opcional por médico lo usa el ícono de "ojo" de la agenda del
 * operador: "ver los turnos de este médico en esta fecha".
 *
 * @param idSede Id de la sede, tomado del token del operador.
 * @param filtros Fecha obligatoria y médico opcional.
 * @returns Los turnos de esa sede ese día, ordenados por hora.
 */
export async function listarTurnosSede(
  idSede: number,
  filtros: FiltrosTurnosDia,
): Promise<TurnoDetallado[]> {
  const parametros: unknown[] = [idSede, filtros.fecha];
  let sql = `${SELECT_TURNO_DETALLE} WHERE a.id_sede = ? AND t.fecha = ?`;

  if (filtros.id_medico !== undefined) {
    sql += " AND a.id_medico = ?";
    parametros.push(filtros.id_medico);
  }

  const [filas] = await pool.query<RowDataPacket[]>(`${sql} ORDER BY t.hora, t.id`, parametros);
  return filas as TurnoDetallado[];
}
