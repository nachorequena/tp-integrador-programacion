import mysql from "mysql2/promise";
import { entorno } from "../config/env";

/**
 * Pool de conexiones a MySQL/MariaDB.
 *
 * - `charset: utf8mb4` → las tablas del script vienen en utf8mb3; forzamos
 *   utf8mb4 en la conexión para que los acentos no se rompan (Martín, García).
 * - `dateStrings: true` → las columnas `date` llegan como "YYYY-MM-DD" en vez
 *   de objetos Date, evitando corrimientos de zona horaria en
 *   `fecha_nacimiento`.
 */
export const pool = mysql.createPool({
  host: entorno.db.host,
  port: entorno.db.puerto,
  user: entorno.db.usuario,
  password: entorno.db.password,
  database: entorno.db.nombre,
  charset: "utf8mb4",
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/** Pide una conexión al pool y le hace ping. Lo usa `GET /health`. */
export async function probarConexion(): Promise<void> {
  const conexion = await pool.getConnection();
  try {
    await conexion.ping();
  } finally {
    conexion.release();
  }
}
