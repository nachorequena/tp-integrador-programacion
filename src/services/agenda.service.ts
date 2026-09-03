/**
 * SERVICE: agenda médica
 * ======================
 *
 * CRUD de la tabla `agenda`: los rangos horarios que cada médico atiende en una
 * sede, para una especialidad y una fecha.
 *
 * Es el service más complejo de la entrega porque combina tres cosas:
 *
 *   1. **Validaciones de existencia** — médico, especialidad y sede tienen que
 *      existir (son claves foráneas) y el médico tiene que ser realmente médico.
 *   2. **Reglas de pertenencia por rol** — un `medico` solo puede tocar SU
 *      agenda. Esto NO lo puede resolver `verificarRol`, que solo mira el rol y
 *      no sabe de quién es cada fila. Se resuelve acá, con la fila en la mano.
 *   3. **Solapamiento** — un médico no puede estar en dos lugares a la vez.
 *
 * La consigna permite varios rangos por día para el mismo médico; lo que se
 * rechaza es que se pisen entre sí.
 */

import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import {
  Agenda,
  AgendaDetallada,
  DatosAgenda,
  FiltrosAgenda,
  PayloadJWT,
} from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { buscarDependencias, Dependencia } from "./dependencias.service";
import { existeEspecialidad } from "./especialidad.service";
import { existeSede } from "./sede.service";
import { esMedico } from "./usuario.service";

/**
 * Relaciones que impiden borrar una agenda.
 *
 * La consigna no menciona ninguna, pero `turno.id_agenda` es una clave foránea:
 * borrar una agenda con turnos daría un error de FK → 500. De `turno` (semana
 * 3+) solo se cuenta, no se implementa nada más.
 */
const DEPENDENCIAS_AGENDA: Dependencia[] = [
  { etiqueta: "turnos asignados", tabla: "turno", columna: "id_agenda" },
];

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
 */
const SELECT_AGENDA = `
  SELECT a.id, a.hora_entrada, a.hora_salida, a.fecha,
         a.id_medico, a.id_especialidad, a.id_sede,
         CONCAT(u.apellido, ', ', u.nombre) AS medico,
         e.descripcion AS especialidad,
         s.nombre AS sede
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
): Promise<AgendaDetallada[]> {
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

  return filas as AgendaDetallada[];
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
async function buscarAgendaDetallada(id: number): Promise<AgendaDetallada | null> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_AGENDA} WHERE a.id = ? LIMIT 1`,
    [id],
  );
  return (filas[0] as AgendaDetallada | undefined) ?? null;
}

/**
 * Comprueba que las tres claves foráneas existan y que el médico sea médico.
 *
 * @param datos Datos de la agenda, ya validados en formato.
 * @throws `ErrorHttp` 400 si alguna referencia no existe o el usuario indicado
 *   como médico no tiene ese rol.
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
 * Comprueba que quien opera pueda hacerlo sobre la agenda de ese médico.
 *
 * `operador` y `admin` pueden con cualquiera. El `medico` solo consigo mismo.
 *
 * @param idMedicoDeLaAgenda Dueño de la agenda (existente o propuesta).
 * @param usuario Payload del token.
 * @throws `ErrorHttp` 403 si un médico intenta operar sobre agenda ajena.
 */
function validarPertenencia(idMedicoDeLaAgenda: number, usuario: PayloadJWT): void {
  if (usuario.rol === "medico" && idMedicoDeLaAgenda !== usuario.id) {
    throw new ErrorHttp(403, "Solo podés gestionar tu propia agenda");
  }
}

/**
 * Da de alta un rango de agenda.
 *
 * @param datos Datos ya validados en formato.
 * @param usuario Payload del token de quien la crea.
 * @returns La agenda creada, con médico, especialidad y sede resueltos.
 * @throws `ErrorHttp` 403 si un médico intenta crear agenda para otro.
 * @throws `ErrorHttp` 400 si alguna referencia no existe.
 * @throws `ErrorHttp` 409 si el rango se solapa con otro del mismo médico.
 */
export async function crearAgenda(
  datos: DatosAgenda,
  usuario: PayloadJWT,
): Promise<AgendaDetallada> {
  validarPertenencia(datos.id_medico, usuario);
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
 *   - sobre la fila que ya está, para que un médico no edite la de otro;
 *   - sobre los datos nuevos, para que no se la reasigne a un colega.
 *
 * @param id Id de la agenda a modificar.
 * @param datos Datos nuevos, ya validados en formato.
 * @param usuario Payload del token.
 * @returns La agenda actualizada.
 * @throws `ErrorHttp` 404 si la agenda no existe.
 * @throws `ErrorHttp` 403 si un médico intenta modificar agenda ajena.
 * @throws `ErrorHttp` 400 si alguna referencia no existe.
 * @throws `ErrorHttp` 409 si el rango nuevo se solapa con otro.
 */
export async function actualizarAgenda(
  id: number,
  datos: DatosAgenda,
  usuario: PayloadJWT,
): Promise<AgendaDetallada> {
  const existente = await buscarAgendaPorId(id);
  if (!existente) {
    throw new ErrorHttp(404, "La agenda indicada no existe");
  }

  validarPertenencia(existente.id_medico, usuario);
  validarPertenencia(datos.id_medico, usuario);

  await validarReferencias(datos);
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
 * Elimina un rango de agenda, previa validación de dependencias.
 *
 * @param id Id de la agenda a eliminar.
 * @param usuario Payload del token.
 * @throws `ErrorHttp` 404 si la agenda no existe.
 * @throws `ErrorHttp` 403 si un médico intenta borrar agenda ajena.
 * @throws `ErrorHttp` 409 si tiene turnos asignados.
 */
export async function eliminarAgenda(
  id: number,
  usuario: PayloadJWT,
): Promise<void> {
  const existente = await buscarAgendaPorId(id);
  if (!existente) {
    throw new ErrorHttp(404, "La agenda indicada no existe");
  }

  validarPertenencia(existente.id_medico, usuario);

  const bloqueantes = await buscarDependencias(id, DEPENDENCIAS_AGENDA);
  if (bloqueantes.length > 0) {
    throw new ErrorHttp(
      409,
      `No se puede eliminar la agenda porque tiene ${bloqueantes.join(" y ")}`,
    );
  }

  await pool.query("DELETE FROM agenda WHERE id = ?", [id]);
}
