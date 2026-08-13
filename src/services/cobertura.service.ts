/**
 * SERVICE: cobertura
 * ==================
 *
 * Acceso a la tabla `cobertura` (las obras sociales).
 *
 * La consigna de la semana 1 pide expresamente "un servicio que recupere las
 * coberturas disponibles", porque el formulario de registro necesita mostrarlas
 * para que el paciente elija una. Por eso esta tabla entra en el alcance de la
 * semana aunque el enunciado solo mencione `usuario` y `sede`.
 */

import { RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { Cobertura } from "../types";

/**
 * Devuelve todas las coberturas disponibles.
 *
 * Se ordenan por nombre para que el desplegable del formulario salga alfabético
 * y el orden no dependa de en qué momento se cargó cada fila.
 *
 * @returns Array de coberturas. Vacío si la tabla no tiene filas.
 */
export async function listarCoberturas(): Promise<Cobertura[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT id, nombre FROM cobertura ORDER BY nombre",
  );
  return filas as Cobertura[];
}

/**
 * Comprueba que exista una cobertura con ese id.
 *
 * La usa el registro antes de insertar: `usuario.id_cobertura` es una clave
 * foránea, así que un id inexistente haría fallar el INSERT con un error del
 * motor. Chequearlo antes permite devolver un 400 con un mensaje claro en vez
 * de un 500.
 *
 * @param id Id de cobertura recibido en el registro.
 * @returns `true` si existe.
 */
export async function existeCobertura(id: number): Promise<boolean> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM cobertura WHERE id = ? LIMIT 1",
    [id],
  );
  return filas.length > 0;
}
