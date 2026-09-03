/**
 * VALIDACIÓN DE DEPENDENCIAS ANTES DE BORRAR
 * ==========================================
 *
 * El criterio de aceptación de la semana 2 es explícito: no se puede eliminar
 * una entidad que tenga dependencias, y el intento debe devolver "un error
 * controlado y no romper la aplicación" (textual: *no un 500*).
 *
 * Sin esta comprobación, el `DELETE` llega a MySQL, choca contra una clave
 * foránea y el driver lanza un error genérico que termina en el manejador de
 * errores como 500. Funcionalmente "no rompe", pero incumple el criterio y no
 * le dice a nadie qué está pasando.
 *
 * ⚠️ IMPORTANTE — la consigna lista MENOS dependencias de las que existen en el
 * script provisto. Estas son las claves foráneas reales:
 *
 *   sede         ← usuario.id_sede, agenda.id_sede
 *   especialidad ← medico_especialidad.id_especialidad, agenda.id_especialidad *
 *   cobertura    ← usuario.id_cobertura, turno.id_cobertura *
 *   agenda       ← turno.id_agenda *
 *
 * Las marcadas con * no figuran en el enunciado. Si solo se validaran las que
 * pide, esos borrados igual explotarían con un error de FK. Por eso se validan
 * todas.
 *
 * Nota de alcance: de la tabla `turno` (semana 3+) solo se hace un `SELECT` de
 * existencia. No se implementa ninguna funcionalidad de turnos.
 */

import { RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";

/**
 * Una relación que puede impedir el borrado.
 */
export interface Dependencia {
  /**
   * Nombre de lo que bloquea, en plural, para armar el mensaje de error:
   * "usuarios", "agendas", "turnos".
   */
  etiqueta: string;
  /** Tabla donde buscar. */
  tabla: string;
  /** Columna que apunta a la entidad que se quiere borrar. */
  columna: string;
}

/**
 * Cuenta cuántas filas dependen de un id, para cada relación indicada.
 *
 * Devuelve solo las que bloquean (las que tienen al menos una fila), ya
 * descritas en texto: `["2 usuarios", "1 agenda"]`.
 *
 * Los nombres de tabla y columna se interpolan en el SQL en lugar de ir como
 * parámetros `?`, porque MySQL no admite identificadores parametrizados. NO es
 * un riesgo de inyección: esos valores son constantes escritas en el código de
 * los services, nunca datos que venga del cliente. El `id`, que sí viene de
 * afuera, va parametrizado.
 *
 * @param id Id de la entidad que se quiere eliminar.
 * @param dependencias Relaciones a comprobar.
 * @returns Descripciones de las relaciones que bloquean. Array vacío = se puede
 *   borrar.
 */
export async function buscarDependencias(
  id: number,
  dependencias: Dependencia[],
): Promise<string[]> {
  const bloqueantes: string[] = [];

  for (const dependencia of dependencias) {
    const [filas] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cantidad FROM ${dependencia.tabla} WHERE ${dependencia.columna} = ?`,
      [id],
    );

    const cantidad = Number(filas[0].cantidad);
    if (cantidad > 0) {
      bloqueantes.push(`${cantidad} ${dependencia.etiqueta}`);
    }
  }

  return bloqueantes;
}
