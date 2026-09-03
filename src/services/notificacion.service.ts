/**
 * SERVICE: notificacion
 * =====================
 *
 * Maneja las notificaciones internas del sistema.
 *
 * No existe un endpoint público para crear notificaciones. Se generan
 * automáticamente cuando un turno es confirmado, cancelado o atendido.
 */

import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { Notificacion } from "../types";
import { ErrorHttp } from "../utils/errorHttp";

/**
 * Crea una notificación para un usuario.
 *
 * No se expone por ningún endpoint: la consigna pide que las notificaciones se
 * generen internamente ante cada cambio de estado de un turno. Por eso la
 * llaman los services de turno y nunca un controller.
 *
 * `leida` se fuerza a 0 en el INSERT en lugar de confiar en el DEFAULT de la
 * columna, para que la regla quede escrita donde se lee el código.
 *
 * @param idUsuario Destinatario.
 * @param tipo Evento: `turno_confirmado`, `turno_cancelado` o `turno_atendido`.
 * @param mensaje Texto descriptivo, con la fecha y hora del turno.
 * @returns El id de la notificación creada.
 */
export async function crearNotificacion(
  idUsuario: number,
  tipo: string,
  mensaje: string,
): Promise<number> {
  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO notificacion
      (id_usuario, tipo, mensaje, leida)
     VALUES (?, ?, ?, 0)`,
    [idUsuario, tipo, mensaje],
  );

  return resultado.insertId;
}

/**
 * Lista las notificaciones del usuario autenticado.
 *
 * Se ordenan desde la más reciente hasta la más antigua. El desempate por
 * `id` no es decorativo: `fecha` es un datetime con precisión de segundos, y
 * las tres notificaciones de un mismo flujo pueden caer en el mismo segundo.
 * Sin el segundo criterio, el orden entre ellas sería arbitrario.
 */
export async function listarPorUsuario(
  idUsuario: number,
): Promise<Notificacion[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT id, id_usuario, tipo, mensaje, leida, fecha
     FROM notificacion
     WHERE id_usuario = ?
     ORDER BY fecha DESC, id DESC`,
    [idUsuario],
  );

  return filas as Notificacion[];
}

/**
 * Marca como leída una notificación del propio usuario.
 *
 * El `id_usuario` va en el WHERE y no en una comprobación aparte: así, marcar
 * la notificación de otro no afecta ninguna fila y sale por el 404, sin
 * revelar si esa notificación existe.
 *
 * @param idNotificacion Notificación a marcar.
 * @param idUsuario Dueño, tomado del token.
 * @throws `ErrorHttp` 404 si no existe o no es de este usuario.
 */
export async function marcarComoLeida(
  idNotificacion: number,
  idUsuario: number,
): Promise<void> {
  const [resultado] = await pool.query<ResultSetHeader>(
    `UPDATE notificacion
     SET leida = 1
     WHERE id = ? AND id_usuario = ?`,
    [idNotificacion, idUsuario],
  );

  if (resultado.affectedRows === 0) {
    throw new ErrorHttp(404, "La notificación no existe");
  }
}