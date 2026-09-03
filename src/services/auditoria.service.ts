/**
 * SERVICE: auditoría
 * ==================
 *
 * Escritura y consulta de `log_auditoria`.
 *
 * La escritura no la llama ningún controller: la dispara el middleware
 * `auditoria.ts` cuando una operación sensible termina bien. El criterio de
 * aceptación pide justamente eso —"sin código repetido en cada endpoint"—, así
 * que si algún día aparece un `registrarLog` dentro de un controller, es señal
 * de que algo se hizo mal.
 */

import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { EntradaAuditoria, FiltrosAuditoria, LogAuditoria } from "../types";

/** Largo de `log_auditoria.detalle` en la base. */
const MAXIMO_DETALLE = 255;

/**
 * Inserta una entrada en el log.
 *
 * **Nunca lanza.** Es deliberado: la auditoría es un efecto secundario de la
 * operación real, y si el log falla, la operación ya se completó y ya se le
 * respondió al cliente. Propagar el error convertiría un alta exitosa en un
 * 500, que es peor que perder un renglón del log.
 *
 * Esto importa acá más que en otros proyectos porque `log_auditoria.id` es
 * `tinyint`: a las 127 filas el AUTO_INCREMENT se queda sin valores y todo
 * INSERT posterior falla. Se decidió no tocar el esquema provisto, así que el
 * fallo se absorbe y se avisa por consola. Si aparece ese mensaje, hay que
 * vaciar la tabla a mano.
 *
 * @param entrada Datos ya armados por el middleware.
 * @returns `true` si se registró, `false` si falló (ya avisado por consola).
 */
export async function registrarLog(entrada: EntradaAuditoria): Promise<boolean> {
  try {
    // El detalle se recorta acá y no en quien lo arma: así ningún llamador
    // puede pasarse del largo de la columna por olvido.
    const detalle =
      entrada.detalle === null ? null : entrada.detalle.slice(0, MAXIMO_DETALLE);

    await pool.query<ResultSetHeader>(
      `INSERT INTO log_auditoria (id_usuario, accion, entidad, id_entidad, detalle)
       VALUES (?, ?, ?, ?, ?)`,
      [entrada.id_usuario, entrada.accion, entrada.entidad, entrada.id_entidad, detalle],
    );
    return true;
  } catch (error) {
    console.error(
      "[auditoría] no se pudo registrar la acción. La operación de negocio " +
        "sí se completó. Si el motivo es que la tabla se llenó (log_auditoria.id " +
        "es tinyint, tope 127), hay que vaciarla.",
      error,
    );
    return false;
  }
}

/**
 * Columnas del log con el nombre del usuario resuelto.
 *
 * Se hace el JOIN porque un log que solo muestra `id_usuario = 4` obliga a
 * quien audita a ir a buscar quién es 4 en otra tabla.
 */
const SELECT_LOG = `SELECT
       l.id, l.id_usuario, l.accion, l.entidad, l.id_entidad, l.detalle, l.fecha,
       CONCAT(u.apellido, ', ', u.nombre) AS usuario
     FROM log_auditoria l
     JOIN usuario u ON u.id = l.id_usuario`;

/**
 * Lista el log aplicando los filtros recibidos.
 *
 * Los cuatro filtros son opcionales y se combinan con AND. El WHERE se arma
 * dinámicamente: por cada filtro presente se agrega una condición con `?`, así
 * la consulta sigue parametrizada.
 *
 * El rango de fechas es **inclusivo en los dos extremos**. Como `fecha` es un
 * `datetime` y el filtro llega como día suelto ("2026-03-15"), comparar con
 * `<= '2026-03-15'` dejaría afuera todo lo de ese día a partir de las 00:00:01.
 * Por eso el extremo superior compara contra el final del día.
 *
 * @param filtros Filtros ya validados.
 * @returns Las entradas que cumplen, de la más reciente a la más antigua.
 */
export async function listarLogs(filtros: FiltrosAuditoria): Promise<LogAuditoria[]> {
  const condiciones: string[] = [];
  const parametros: unknown[] = [];

  if (filtros.id_usuario !== undefined) {
    condiciones.push("l.id_usuario = ?");
    parametros.push(filtros.id_usuario);
  }

  if (filtros.entidad !== undefined) {
    condiciones.push("l.entidad = ?");
    parametros.push(filtros.entidad);
  }

  if (filtros.desde !== undefined) {
    condiciones.push("l.fecha >= ?");
    parametros.push(`${filtros.desde} 00:00:00`);
  }

  if (filtros.hasta !== undefined) {
    condiciones.push("l.fecha <= ?");
    parametros.push(`${filtros.hasta} 23:59:59`);
  }

  const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(" AND ")}` : "";

  // El desempate por id no es decorativo: `fecha` tiene precisión de segundos
  // y varias acciones seguidas caen en el mismo segundo.
  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_LOG}${where} ORDER BY l.fecha DESC, l.id DESC`,
    parametros,
  );

  return filas as LogAuditoria[];
}
