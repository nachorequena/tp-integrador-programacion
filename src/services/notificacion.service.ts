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
 * Se ordenan desde la más reciente hasta la más antigua.
 */
export async function listarPorUsuario(
  idUsuario: number,
): Promise<Notificacion[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT id, id_usuario, tipo, mensaje, leida, fecha
     FROM notificacion
     WHERE id_usuario = ?
     ORDER BY fecha DESC`,
    [idUsuario],
  );

  return filas as Notificacion[];
}

/**
 * Marca como leída una notificación del propio usuario.
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