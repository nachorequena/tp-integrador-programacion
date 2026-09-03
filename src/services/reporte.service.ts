/**
 * SERVICE: reportes y estadísticas
 * ================================
 *
 * Los cuatro indicadores que pide la consigna, resueltos con consultas
 * agregadas sobre `turno`, `agenda`, `especialidad`, `sede` y `usuario`.
 *
 * No hay tablas nuevas ni columnas calculadas guardadas: los números se
 * cuentan en el momento. Eso hace que los reportes reflejen siempre el estado
 * real —cancelar un turno cambia la tasa de cancelación en la consulta
 * siguiente, sin ningún paso intermedio—, que es justo lo que pide el punto de
 * "cierre y pulido".
 *
 * Todos los reportes cuelgan de `turno`, y `turno` no guarda ni el médico ni la
 * sede ni la especialidad: los hereda del rango de agenda al que pertenece. De
 * ahí que todas las consultas hagan `JOIN agenda`.
 */

import { RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { ConteoTurnos, MedicoRanking, RangoFechas, TasaCancelacion } from "../types";

/**
 * Traduce el rango de fechas a un fragmento de SQL y sus parámetros.
 *
 * Existe para que los cuatro reportes filtren exactamente igual: si cada uno
 * armara su propio WHERE, bastaría un `>=` donde va un `>` para que dos
 * indicadores del mismo tablero dejaran de cuadrar entre sí.
 *
 * Los dos extremos son inclusivos. Se filtra por `turno.fecha` (la fecha del
 * turno) y no por la de la agenda: lo que interesa medir es cuándo se atiende
 * al paciente.
 *
 * @param rango Extremos ya validados. Cualquiera de los dos puede faltar.
 * @param alias Alias de la tabla `turno` en la consulta que llama.
 * @returns Las condiciones y los parámetros, listos para concatenar.
 */
function filtroDeFechas(
  rango: RangoFechas,
  alias = "t",
): { condiciones: string[]; parametros: unknown[] } {
  const condiciones: string[] = [];
  const parametros: unknown[] = [];

  if (rango.desde !== undefined) {
    condiciones.push(`${alias}.fecha >= ?`);
    parametros.push(rango.desde);
  }

  if (rango.hasta !== undefined) {
    condiciones.push(`${alias}.fecha <= ?`);
    parametros.push(rango.hasta);
  }

  return { condiciones, parametros };
}

/**
 * Une condiciones en una cláusula WHERE, o devuelve cadena vacía si no hay.
 *
 * @param condiciones Condiciones ya armadas.
 * @returns `" WHERE a AND b"`, o `""`.
 */
function armarWhere(condiciones: string[]): string {
  return condiciones.length > 0 ? ` WHERE ${condiciones.join(" AND ")}` : "";
}

/**
 * Cantidad de turnos por especialidad.
 *
 * Se usa `LEFT JOIN` desde `especialidad` y no `INNER JOIN` desde `turno`: así
 * las especialidades sin ningún turno aparecen con 0 en lugar de desaparecer
 * del reporte. Un tablero que oculta las especialidades que nadie pide es
 * justamente el que no deja verlas.
 *
 * Por el mismo motivo el filtro de fechas va en el `ON` y no en el `WHERE`: en
 * un LEFT JOIN, una condición sobre la tabla derecha puesta en el WHERE
 * descarta las filas sin coincidencia y convierte el LEFT en un INNER.
 *
 * @param rango Rango de fechas, opcional.
 * @returns Una fila por especialidad, de la más pedida a la menos.
 */
export async function turnosPorEspecialidad(rango: RangoFechas): Promise<ConteoTurnos[]> {
  const { condiciones, parametros } = filtroDeFechas(rango);
  const extra = condiciones.length > 0 ? ` AND ${condiciones.join(" AND ")}` : "";

  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.descripcion AS nombre, COUNT(t.id) AS cantidad
       FROM especialidad e
       LEFT JOIN agenda a ON a.id_especialidad = e.id
       LEFT JOIN turno t ON t.id_agenda = a.id${extra}
      GROUP BY e.id, e.descripcion
      ORDER BY cantidad DESC, e.descripcion`,
    parametros,
  );

  return filas as ConteoTurnos[];
}

/**
 * Cantidad de turnos por sede.
 *
 * Mismo criterio que el reporte por especialidad: LEFT JOIN desde `sede` para
 * que una sede sin movimiento se vea con 0 y no se pierda.
 *
 * @param rango Rango de fechas, opcional.
 * @returns Una fila por sede, de la más concurrida a la menos.
 */
export async function turnosPorSede(rango: RangoFechas): Promise<ConteoTurnos[]> {
  const { condiciones, parametros } = filtroDeFechas(rango);
  const extra = condiciones.length > 0 ? ` AND ${condiciones.join(" AND ")}` : "";

  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, s.nombre, COUNT(t.id) AS cantidad
       FROM sede s
       LEFT JOIN agenda a ON a.id_sede = s.id
       LEFT JOIN turno t ON t.id_agenda = a.id${extra}
      GROUP BY s.id, s.nombre
      ORDER BY cantidad DESC, s.nombre`,
    parametros,
  );

  return filas as ConteoTurnos[];
}

/**
 * Ranking de médicos por turnos atendidos.
 *
 * La consigna aclara "no solo el primero": se devuelve la lista completa
 * ordenada, y es quien consume la API el que decide cuántos mostrar.
 *
 * Solo cuentan los turnos en estado `atendido`. Un turno confirmado todavía no
 * se atendió y uno cancelado nunca se va a atender, así que ninguno de los dos
 * mide el trabajo del médico.
 *
 * Se listan todos los médicos, incluso los que no atendieron a nadie: un
 * ranking que oculta los ceros no permite ver quién no está atendiendo.
 *
 * @param rango Rango de fechas, opcional.
 * @returns Los médicos ordenados por turnos atendidos, de mayor a menor.
 */
export async function rankingMedicos(rango: RangoFechas): Promise<MedicoRanking[]> {
  const { condiciones, parametros } = filtroDeFechas(rango);
  const extra = condiciones.length > 0 ? ` AND ${condiciones.join(" AND ")}` : "";

  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT u.id AS id_medico,
            CONCAT(u.apellido, ', ', u.nombre) AS medico,
            COUNT(t.id) AS atendidos
       FROM usuario u
       LEFT JOIN agenda a ON a.id_medico = u.id
       LEFT JOIN turno t ON t.id_agenda = a.id
            AND t.estado = 'atendido'${extra}
      WHERE u.rol = 'medico'
      GROUP BY u.id, u.apellido, u.nombre
      ORDER BY atendidos DESC, u.apellido, u.nombre`,
    parametros,
  );

  return filas as MedicoRanking[];
}

/**
 * Tasa de cancelación del período.
 *
 * Se resuelve en una sola consulta con un `SUM(CASE ...)` en lugar de dos
 * queries separadas: si se contara el total y los cancelados por separado, un
 * turno cancelado entre una consulta y la otra daría una tasa imposible.
 *
 * La división se hace en JavaScript y no en SQL para poder tratar el caso de un
 * período sin turnos: en SQL sería una división por cero que devuelve NULL, y
 * hay que decidir igual qué significa. Acá significa 0.
 *
 * @param rango Rango de fechas, opcional.
 * @returns Total, cancelados y la proporción entre 0 y 1 con dos decimales.
 */
export async function tasaCancelacion(rango: RangoFechas): Promise<TasaCancelacion> {
  const { condiciones, parametros } = filtroDeFechas(rango);

  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN t.estado = 'cancelado' THEN 1 ELSE 0 END) AS cancelados
       FROM turno t${armarWhere(condiciones)}`,
    parametros,
  );

  const total = Number(filas[0].total);
  // SUM devuelve NULL, no 0, cuando no hay ninguna fila que sumar.
  const cancelados = Number(filas[0].cancelados ?? 0);

  // Un período sin turnos no tiene una tasa "indefinida" que el cliente deba
  // interpretar: no se canceló nada, así que la tasa es 0.
  const tasa = total === 0 ? 0 : Number((cancelados / total).toFixed(2));

  return { total, cancelados, tasa };
}
