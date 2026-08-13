/**
 * SERVICE: sede
 * =============
 *
 * Acceso a la tabla `sede` (las sucursales de la clínica).
 *
 * En la semana 1 se usa para un solo fin: darle contenido real al endpoint
 * `GET /sedes`, que es el que demuestra que `verificarRol` funciona. La
 * consigna pide "al menos un endpoint de prueba protegido por cada middleware",
 * y `sede` es una de las tablas que sí están dentro del alcance de la semana.
 */

import { RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { Sede } from "../types";

/**
 * Devuelve todas las sedes de la clínica.
 *
 * Se listan las columnas explícitamente (en vez de `SELECT *`) para que la
 * respuesta no cambie sola si algún día se agrega una columna a la tabla.
 *
 * @returns Array de sedes, ordenadas por nombre.
 */
export async function listarSedes(): Promise<Sede[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT id, nombre, direccion, telefono FROM sede ORDER BY nombre",
  );
  return filas as Sede[];
}
