/**
 * SERVICE: agenda médica
 * ======================
 *
 * CRUD de la tabla `agenda`: los rangos horarios que cada médico atiende en una
 * sede, para una especialidad y una fecha.
 *
 * Flujo: `agenda.routes.ts` → `agenda.controller.ts` → este service → tablas
 * `agenda`, `turno` (para contar y proteger los turnos), `usuario`,
 * `especialidad`, `sede` y `medico_especialidad` (vía `medico.service.ts`).
 *
 * Quién lo usa desde el frontend: el médico ("Mi agenda"), el operador
 * ("Agendas médicas" de su sede) y el administrador.
 *
 * Es el service más complejo del backend porque combina cuatro cosas:
 *
 *   1. **Validaciones de existencia** — médico, especialidad y sede tienen que
 *      existir (son claves foráneas), el médico tiene que ser realmente médico
 *      y tener esa especialidad asignada.
 *   2. **Reglas de pertenencia por rol** — un `medico` solo puede tocar SU
 *      agenda y un `operador` solo la de SU sede (esto último lo agregó la
 *      consigna final; consultar otras sedes sigue permitido). Esto NO lo
 *      puede resolver `verificarRol`, que solo mira el rol y no sabe de quién
 *      es cada fila. Se resuelve acá, con la fila en la mano.
 *   3. **Solapamiento** — un médico no puede estar en dos lugares a la vez.
 *   4. **Protección de los turnos confirmados** — no se puede eliminar un rango
 *      con turnos confirmados ni modificarlo dejando alguno afuera (consigna
 *      final). La interfaz lo informa con el mensaje que se arma acá.
 *
 * La consigna permite varios rangos por día para el mismo médico, incluso en
 * sedes distintas; lo que se rechaza es que se pisen entre sí.
 */

import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import {
  Agenda,
  AgendaConTurnos,
  DatosAgenda,
  FiltrosAgenda,
  PayloadJWT,
} from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { aMinutos } from "../utils/fechas";
import { DURACION_TURNO } from "./disponibilidad.service";
import { existeEspecialidad } from "./especialidad.service";
import { tieneEspecialidad } from "./medico.service";
import { existeSede } from "./sede.service";
import { esMedico } from "./usuario.service";

/**
 * SELECT base del listado, con los nombres resueltos por JOIN.
 *
 * Se devuelven los ids Y los nombres: los ids sirven para operar (modificar,
 * borrar) y los nombres para mostrar, sin obligar a quien consume la API a
 * hacer una llamada extra por cada uno.
 *
 * Los JOIN son internos (no LEFT) a propósito: las tres columnas son NOT NULL
 * con clave foránea, así que siempre tienen correspondencia. Si una fila
 * desapareciera del listado, sería señal de un problema de integridad real.
 *
 * Las dos subconsultas cuentan los turnos del rango. El frontend las usa para
 * no ofrecer acciones que se van a rechazar (deshabilita "eliminar" si hay
 * turnos confirmados) y para avisar por qué.
 */
const SELECT_AGENDA = `
  SELECT a.id, a.hora_entrada, a.hora_salida, a.fecha,
         a.id_medico, a.id_especialidad, a.id_sede,
         CONCAT(u.apellido, ', ', u.nombre) AS medico,
         e.descripcion AS especialidad,
         s.nombre AS sede,
         (SELECT COUNT(*) FROM turno t
           WHERE t.id_agenda = a.id AND t.estado = 'confirmado') AS turnos_confirmados,
         (SELECT COUNT(*) FROM turno t WHERE t.id_agenda = a.id) AS turnos_totales
    FROM agenda a
    JOIN usuario u ON u.id = a.id_medico
    JOIN especialidad e ON e.id = a.id_especialidad
    JOIN sede s ON s.id = a.id_sede`;

/**
 * Lista agendas aplicando los filtros recibidos.
 *
 * Los tres filtros son opcionales y se combinan con AND. El WHERE se arma
 * dinámicamente: por cada filtro presente se agrega una condición con `?` y su
 * valor al array de parámetros, así la consulta sigue siendo parametrizada y no
 * hay riesgo de inyección.
 *
 * REGLA DE ROL: si quien consulta es `medico`, se le fuerza el filtro a su
 * propio id, pisando lo que haya mandado por query. Así no puede ver la agenda
 * de un colega poniendo `?id_medico=3` a mano.
 *
 * @param filtros Filtros ya validados (`id_medico`, `id_sede`, `fecha`).
 * @param usuario Payload del token de quien consulta.
 * @returns Las agendas que cumplen los filtros, ordenadas por fecha y hora.
 */
export async function listarAgendas(
  filtros: FiltrosAgenda,
  usuario: PayloadJWT,
): Promise<AgendaConTurnos[]> {
  const condiciones: string[] = [];
  const parametros: unknown[] = [];

  // Un médico solo ve lo suyo, sin importar lo que pida.
  const idMedico = usuario.rol === "medico" ? usuario.id : filtros.id_medico;

  if (idMedico !== undefined) {
    condiciones.push("a.id_medico = ?");
    parametros.push(idMedico);
  }

  if (filtros.id_sede !== undefined) {
    condiciones.push("a.id_sede = ?");
    parametros.push(filtros.id_sede);
  }

  if (filtros.fecha !== undefined) {
    condiciones.push("a.fecha = ?");
    parametros.push(filtros.fecha);
  }

  const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(" AND ")}` : "";

  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_AGENDA}${where} ORDER BY a.fecha, a.hora_entrada`,
    parametros,
  );

  return filas as AgendaConTurnos[];
}

/**
 * Busca una agenda por id, sin los JOIN.
 *
 * Se usa internamente para saber si existe y de quién es, antes de modificarla
 * o borrarla.
 *
 * @param id Id de la agenda.
 * @returns La fila de agenda, o `null` si no existe.
 */
export async function buscarAgendaPorId(id: number): Promise<Agenda | null> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT id, hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede
       FROM agenda WHERE id = ? LIMIT 1`,
    [id],
  );
  return (filas[0] as Agenda | undefined) ?? null;
}

/**
 * Busca una agenda por id, con los nombres resueltos. Es lo que se devuelve al
 * cliente después de un alta o una modificación.
 *
 * @param id Id de la agenda.
 * @returns La agenda con médico, especialidad y sede, o `null` si no existe.
 */
async function buscarAgendaDetallada(id: number): Promise<AgendaConTurnos | null> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_AGENDA} WHERE a.id = ? LIMIT 1`,
    [id],
  );
  return (filas[0] as AgendaConTurnos | undefined) ?? null;
}

/**
 * Comprueba que las tres claves foráneas existan, que el médico sea médico y
 * que tenga asignada la especialidad del rango.
 *
 * La última condición la pide la consigna final ("la especialidad se elige
 * entre las del propio médico"). El frontend ya ofrece solo esas, pero la API
 * no puede confiar en que el cliente sea siempre esa pantalla.
 *
 * @param datos Datos de la agenda, ya validados en formato.
 * @throws `ErrorHttp` 400 si alguna referencia no existe, el usuario indicado
 *   como médico no tiene ese rol o no tiene esa especialidad.
 */
async function validarReferencias(datos: DatosAgenda): Promise<void> {
  if (!(await esMedico(datos.id_medico))) {
    // Un solo mensaje para los dos casos (no existe / existe pero no es médico)
    // porque para quien consume la API el problema es el mismo: ese id no sirve.
    throw new ErrorHttp(400, "El id_medico indicado no corresponde a un médico");
  }

  if (!(await existeEspecialidad(datos.id_especialidad))) {
    throw new ErrorHttp(400, "La especialidad indicada no existe");
  }

  if (!(await existeSede(datos.id_sede))) {
    throw new ErrorHttp(400, "La sede indicada no existe");
  }

  if (!(await tieneEspecialidad(datos.id_medico, datos.id_especialidad))) {
    throw new ErrorHttp(400, "El médico no tiene asignada la especialidad indicada");
  }
}

/**
 * Verifica que el rango horario no se pise con otro del mismo médico ese día.
 *
 * Dos rangos se solapan si cada uno empieza antes de que el otro termine:
 *
 *   existente.hora_entrada < nueva.hora_salida  Y  nueva.hora_entrada < existente.hora_salida
 *
 * Las horas son `varchar(5)` en formato "HH:MM" con ceros a la izquierda, así
 * que MySQL las compara alfabéticamente y el orden coincide con el
 * cronológico ("09:00" < "15:30"). No hace falta convertirlas.
 *
 * Rangos que solo se tocan en el borde (08:00-12:00 y 12:00-16:00) NO se
 * consideran solapados: se usan `<` y `>` estrictos.
 *
 * @param datos Rango a insertar o dejar guardado.
 * @param idExcluir En una modificación, el id de la propia fila: sin esto una
 *   agenda se detectaría como solapada consigo misma.
 * @throws `ErrorHttp` 409 si pisa otro rango del mismo médico en esa fecha.
 */
async function validarSolapamiento(
  datos: DatosAgenda,
  idExcluir?: number,
): Promise<void> {
  const parametros: unknown[] = [
    datos.id_medico,
    datos.fecha,
    datos.hora_salida,
    datos.hora_entrada,
  ];

  let sql = `SELECT hora_entrada, hora_salida FROM agenda
              WHERE id_medico = ? AND fecha = ?
                AND hora_entrada < ? AND hora_salida > ?`;

  if (idExcluir !== undefined) {
    sql += " AND id <> ?";
    parametros.push(idExcluir);
  }

  const [filas] = await pool.query<RowDataPacket[]>(`${sql} LIMIT 1`, parametros);

  if (filas.length > 0) {
    const choque = filas[0];
    throw new ErrorHttp(
      409,
      `El médico ya tiene una agenda de ${choque.hora_entrada} a ${choque.hora_salida} el ${datos.fecha}`,
    );
  }
}

/**
 * Comprueba que quien opera pueda hacerlo sobre ese rango de agenda.
 *
 *   - `admin`: cualquiera.
 *   - `medico`: solo los suyos (en cualquier sede: puede atender en varias).
 *   - `operador`: solo los de SU sede. Es la regla nueva de la consigna final:
 *     en la semana 2 el operador gestionaba cualquier sede; ahora solo puede
 *     consultar las demás.
 *
 * Se llama con la fila existente Y con los datos nuevos: así un médico no se
 * puede apropiar de la agenda de un colega ni un operador puede "mudar" un
 * rango de su sede a otra.
 *
 * @param agenda Médico y sede del rango (existente o propuesto).
 * @param usuario Payload del token.
 * @throws `ErrorHttp` 403 si el rango no le corresponde a quien opera.
 */
function validarPertenencia(
  agenda: { id_medico: number; id_sede: number },
  usuario: PayloadJWT,
): void {
  if (usuario.rol === "medico" && agenda.id_medico !== usuario.id) {
    throw new ErrorHttp(403, "Solo podés gestionar tu propia agenda");
  }
  if (usuario.rol === "operador" && agenda.id_sede !== usuario.id_sede) {
    throw new ErrorHttp(403, "Solo podés modificar la agenda de tu sede");
  }
}

/**
 * Horas de los turnos confirmados de un rango.
 *
 * @param idAgenda Id del rango.
 * @returns Las horas "HH:MM", en orden.
 */
async function horasConfirmadas(idAgenda: number): Promise<string[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT hora FROM turno
      WHERE id_agenda = ? AND estado = 'confirmado' AND hora IS NOT NULL
      ORDER BY hora`,
    [idAgenda],
  );
  return filas.map((fila) => String(fila.hora));
}

/**
 * Impide una modificación que deje turnos confirmados afuera.
 *
 * La consigna final lo pide textual: "no se permite modificar un rango
 * dejando algún turno confirmado fuera del nuevo horario". Además, si el rango
 * tiene turnos confirmados, tampoco se le puede cambiar la fecha, el médico,
 * la especialidad ni la sede: el turno quedaría apuntando a un rango que ya no
 * es el que el paciente reservó.
 *
 * Un turno queda "adentro" si empieza a la hora de entrada o después y termina
 * (inicio + 30 minutos) antes o justo a la hora de salida.
 *
 * @param existente Rango tal como está guardado.
 * @param datos Datos nuevos propuestos.
 * @throws `ErrorHttp` 409 con un mensaje que explica qué turnos lo impiden.
 */
async function validarTurnosConfirmados(existente: Agenda, datos: DatosAgenda): Promise<void> {
  const horas = await horasConfirmadas(existente.id);
  if (horas.length === 0) return;

  const cambiaContexto =
    existente.fecha !== datos.fecha ||
    existente.id_medico !== datos.id_medico ||
    existente.id_especialidad !== datos.id_especialidad ||
    existente.id_sede !== datos.id_sede;

  if (cambiaContexto) {
    throw new ErrorHttp(
      409,
      `El rango tiene ${horas.length} turno(s) confirmado(s): no se puede cambiar su fecha, médico, especialidad ni sede. Cancelá esos turnos primero.`,
    );
  }

  const entrada = aMinutos(datos.hora_entrada);
  const salida = aMinutos(datos.hora_salida);
  const afuera = horas.filter(
    (hora) => aMinutos(hora) < entrada || aMinutos(hora) + DURACION_TURNO > salida,
  );

  if (afuera.length > 0) {
    throw new ErrorHttp(
      409,
      `El nuevo horario deja afuera turnos confirmados (${afuera.join(", ")}). Ampliá el rango o cancelá esos turnos primero.`,
    );
  }
}

/**
 * Da de alta un rango de agenda.
 *
 * @param datos Datos ya validados en formato.
 * @param usuario Payload del token de quien la crea.
 * @returns La agenda creada, con médico, especialidad y sede resueltos.
 * @throws `ErrorHttp` 403 si un médico intenta crear agenda para otro o un
 *   operador intenta crearla en otra sede.
 * @throws `ErrorHttp` 400 si alguna referencia no existe.
 * @throws `ErrorHttp` 409 si el rango se solapa con otro del mismo médico.
 */
export async function crearAgenda(
  datos: DatosAgenda,
  usuario: PayloadJWT,
): Promise<AgendaConTurnos> {
  validarPertenencia(datos, usuario);
  await validarReferencias(datos);
  await validarSolapamiento(datos);

  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO agenda (hora_entrada, hora_salida, fecha, id_medico, id_especialidad, id_sede)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      datos.hora_entrada,
      datos.hora_salida,
      datos.fecha,
      datos.id_medico,
      datos.id_especialidad,
      datos.id_sede,
    ],
  );

  const agenda = await buscarAgendaDetallada(resultado.insertId);
  if (!agenda) {
    throw new ErrorHttp(500, "No se pudo recuperar la agenda recién creada");
  }
  return agenda;
}

/**
 * Modifica un rango de agenda existente.
 *
 * La pertenencia se controla DOS veces, y las dos hacen falta:
 *   - sobre la fila que ya está, para que un médico no edite la de otro (ni un
 *     operador la de otra sede);
 *   - sobre los datos nuevos, para que no se la reasigne a un colega (ni a
 *     otra sede).
 *
 * Después se controla que el cambio no deje turnos confirmados afuera.
 *
 * @param id Id de la agenda a modificar.
 * @param datos Datos nuevos, ya validados en formato.
 * @param usuario Payload del token.
 * @returns La agenda actualizada.
 * @throws `ErrorHttp` 404 si la agenda no existe.
 * @throws `ErrorHttp` 403 si el rango no le corresponde a quien opera.
 * @throws `ErrorHttp` 400 si alguna referencia no existe.
 * @throws `ErrorHttp` 409 si el rango nuevo se solapa con otro o deja turnos
 *   confirmados afuera.
 */
export async function actualizarAgenda(
  id: number,
  datos: DatosAgenda,
  usuario: PayloadJWT,
): Promise<AgendaConTurnos> {
  const existente = await buscarAgendaPorId(id);
  if (!existente) {
    throw new ErrorHttp(404, "La agenda indicada no existe");
  }

  validarPertenencia(existente, usuario);
  validarPertenencia(datos, usuario);

  await validarReferencias(datos);
  await validarTurnosConfirmados(existente, datos);
  await validarSolapamiento(datos, id);

  await pool.query(
    `UPDATE agenda
        SET hora_entrada = ?, hora_salida = ?, fecha = ?,
            id_medico = ?, id_especialidad = ?, id_sede = ?
      WHERE id = ?`,
    [
      datos.hora_entrada,
      datos.hora_salida,
      datos.fecha,
      datos.id_medico,
      datos.id_especialidad,
      datos.id_sede,
      id,
    ],
  );

  const actualizada = await buscarAgendaDetallada(id);
  if (!actualizada) {
    throw new ErrorHttp(500, "No se pudo recuperar la agenda actualizada");
  }
  return actualizada;
}

/**
 * Elimina un rango de agenda, previa validación de sus turnos.
 *
 * Dos casos bloquean la baja, con mensajes distintos porque la solución es
 * distinta:
 *   - **turnos confirmados**: la consigna final lo prohíbe explícitamente. Hay
 *     que cancelarlos primero.
 *   - **turnos atendidos o cancelados**: no hay nada que cancelar, pero
 *     `turno.id_agenda` es clave foránea. Borrar el rango haría fallar el
 *     DELETE (500) o dejaría sin agenda al historial de esas consultas.
 *
 * @param id Id de la agenda a eliminar.
 * @param usuario Payload del token.
 * @throws `ErrorHttp` 404 si la agenda no existe.
 * @throws `ErrorHttp` 403 si el rango no le corresponde a quien opera.
 * @throws `ErrorHttp` 409 si tiene turnos.
 */
export async function eliminarAgenda(
  id: number,
  usuario: PayloadJWT,
): Promise<void> {
  const existente = await buscarAgendaPorId(id);
  if (!existente) {
    throw new ErrorHttp(404, "La agenda indicada no existe");
  }

  validarPertenencia(existente, usuario);

  const confirmados = await horasConfirmadas(id);
  if (confirmados.length > 0) {
    throw new ErrorHttp(
      409,
      `No se puede eliminar el rango porque tiene ${confirmados.length} turno(s) confirmado(s). Cancelalos primero.`,
    );
  }

  const [historicos] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS cantidad FROM turno WHERE id_agenda = ?",
    [id],
  );
  if (Number(historicos[0].cantidad) > 0) {
    throw new ErrorHttp(
      409,
      "No se puede eliminar el rango porque tiene turnos atendidos o cancelados que forman parte del historial",
    );
  }

  await pool.query("DELETE FROM agenda WHERE id = ?", [id]);
}
