/**
 * SERVICE: cobertura
 * ==================
 *
 * CRUD completo de la tabla `cobertura` (las obras sociales).
 *
 * Esta tabla tiene una particularidad respecto de sede y especialidad: además
 * del CRUD restringido a `admin`, expone un listado PÚBLICO. El registro de
 * pacientes (semana 1) necesita mostrar las coberturas para que el usuario
 * elija una, y quien se está por registrar todavía no tiene token.
 *
 * Ambos listados usan la misma función `listarCoberturas`: lo que cambia es la
 * protección de la ruta desde la que se la llama, no la consulta.
 */

import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { Cobertura, DatosCobertura } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { buscarDependencias, Dependencia } from "./dependencias.service";

/**
 * Relaciones que impiden borrar una cobertura.
 *
 * La consigna solo menciona los usuarios, pero `turno` también tiene una clave
 * foránea a esta tabla: sin la segunda comprobación, borrar una cobertura usada
 * en algún turno daría un error de FK → 500.
 *
 * De `turno` (semana 3+) solo se cuenta: no se implementa nada de turnos.
 */
const DEPENDENCIAS_COBERTURA: Dependencia[] = [
  { etiqueta: "usuarios afiliados", tabla: "usuario", columna: "id_cobertura" },
  { etiqueta: "turnos registrados", tabla: "turno", columna: "id_cobertura" },
];

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
 * Busca una cobertura por id.
 *
 * @param id Id de la cobertura.
 * @returns La cobertura, o `null` si no existe.
 */
export async function buscarCoberturaPorId(id: number): Promise<Cobertura | null> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT id, nombre FROM cobertura WHERE id = ? LIMIT 1",
    [id],
  );
  return (filas[0] as Cobertura | undefined) ?? null;
}

/**
 * Comprueba que exista una cobertura con ese id.
 *
 * La usa el registro antes de insertar: `usuario.id_cobertura` es una clave
 * foránea, así que un id inexistente haría fallar el INSERT con un error del
 * motor. Chequearlo antes permite devolver un 400 con un mensaje claro.
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

/**
 * Da de alta una cobertura.
 *
 * @param datos Nombre ya validado.
 * @returns La cobertura creada, con su id.
 * @throws `ErrorHttp` 500 si no se puede releer la fila recién insertada.
 */
export async function crearCobertura(datos: DatosCobertura): Promise<Cobertura> {
  const [resultado] = await pool.query<ResultSetHeader>(
    "INSERT INTO cobertura (nombre) VALUES (?)",
    [datos.nombre],
  );

  const cobertura = await buscarCoberturaPorId(resultado.insertId);
  if (!cobertura) {
    throw new ErrorHttp(500, "No se pudo recuperar la cobertura recién creada");
  }
  return cobertura;
}

/**
 * Modifica una cobertura existente.
 *
 * @param id Id de la cobertura a modificar.
 * @param datos Datos nuevos, ya validados.
 * @returns La cobertura actualizada.
 * @throws `ErrorHttp` 404 si no existe una cobertura con ese id.
 */
export async function actualizarCobertura(
  id: number,
  datos: DatosCobertura,
): Promise<Cobertura> {
  if (!(await buscarCoberturaPorId(id))) {
    throw new ErrorHttp(404, "La cobertura indicada no existe");
  }

  await pool.query("UPDATE cobertura SET nombre = ? WHERE id = ?", [
    datos.nombre,
    id,
  ]);

  const actualizada = await buscarCoberturaPorId(id);
  if (!actualizada) {
    throw new ErrorHttp(500, "No se pudo recuperar la cobertura actualizada");
  }
  return actualizada;
}

/**
 * Elimina una cobertura, previa validación de dependencias.
 *
 * @param id Id de la cobertura a eliminar.
 * @throws `ErrorHttp` 404 si no existe.
 * @throws `ErrorHttp` 409 si algún usuario la tiene asignada o si aparece en
 *   algún turno.
 */
export async function eliminarCobertura(id: number): Promise<void> {
  if (!(await buscarCoberturaPorId(id))) {
    throw new ErrorHttp(404, "La cobertura indicada no existe");
  }

  const bloqueantes = await buscarDependencias(id, DEPENDENCIAS_COBERTURA);
  if (bloqueantes.length > 0) {
    throw new ErrorHttp(
      409,
      `No se puede eliminar la cobertura porque tiene ${bloqueantes.join(" y ")}`,
    );
  }

  await pool.query("DELETE FROM cobertura WHERE id = ?", [id]);
}
