/**
 * SERVICE: especialidad
 * =====================
 *
 * CRUD completo de la tabla `especialidad` (Traumatología, Cardiología...).
 *
 * Todos sus endpoints están restringidos al rol `admin` desde las rutas.
 *
 * Atención al nombre de la columna: es `descripcion`, no `nombre` como en sede
 * y cobertura. Está así en el script de la cátedra y no se cambia.
 */

import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { DatosEspecialidad, Especialidad } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { buscarDependencias, Dependencia } from "./dependencias.service";

/**
 * Relaciones que impiden borrar una especialidad.
 *
 * La consigna solo menciona `medico_especialidad`, pero `agenda` también tiene
 * una clave foránea a esta tabla: sin la segunda comprobación, borrar una
 * especialidad que esté en uso en alguna agenda daría un error de FK → 500.
 */
const DEPENDENCIAS_ESPECIALIDAD: Dependencia[] = [
  {
    etiqueta: "médicos asociados",
    tabla: "medico_especialidad",
    columna: "id_especialidad",
  },
  { etiqueta: "agendas cargadas", tabla: "agenda", columna: "id_especialidad" },
];

/**
 * Devuelve todas las especialidades.
 *
 * @returns Array de especialidades, ordenadas por descripción.
 */
export async function listarEspecialidades(): Promise<Especialidad[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT id, descripcion FROM especialidad ORDER BY descripcion",
  );
  return filas as Especialidad[];
}

/**
 * Busca una especialidad por id.
 *
 * @param id Id de la especialidad.
 * @returns La especialidad, o `null` si no existe.
 */
export async function buscarEspecialidadPorId(
  id: number,
): Promise<Especialidad | null> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT id, descripcion FROM especialidad WHERE id = ? LIMIT 1",
    [id],
  );
  return (filas[0] as Especialidad | undefined) ?? null;
}

/**
 * Comprueba que exista una especialidad con ese id.
 *
 * La usan el alta y la modificación de agenda, donde `id_especialidad` es una
 * clave foránea.
 *
 * @param id Id a comprobar.
 * @returns `true` si existe.
 */
export async function existeEspecialidad(id: number): Promise<boolean> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM especialidad WHERE id = ? LIMIT 1",
    [id],
  );
  return filas.length > 0;
}

/**
 * Da de alta una especialidad.
 *
 * @param datos Descripción ya validada.
 * @returns La especialidad creada, con su id.
 * @throws `ErrorHttp` 500 si no se puede releer la fila recién insertada.
 */
export async function crearEspecialidad(
  datos: DatosEspecialidad,
): Promise<Especialidad> {
  const [resultado] = await pool.query<ResultSetHeader>(
    "INSERT INTO especialidad (descripcion) VALUES (?)",
    [datos.descripcion],
  );

  const especialidad = await buscarEspecialidadPorId(resultado.insertId);
  if (!especialidad) {
    throw new ErrorHttp(500, "No se pudo recuperar la especialidad recién creada");
  }
  return especialidad;
}

/**
 * Modifica una especialidad existente.
 *
 * @param id Id de la especialidad a modificar.
 * @param datos Datos nuevos, ya validados.
 * @returns La especialidad actualizada.
 * @throws `ErrorHttp` 404 si no existe una especialidad con ese id.
 */
export async function actualizarEspecialidad(
  id: number,
  datos: DatosEspecialidad,
): Promise<Especialidad> {
  if (!(await buscarEspecialidadPorId(id))) {
    throw new ErrorHttp(404, "La especialidad indicada no existe");
  }

  await pool.query("UPDATE especialidad SET descripcion = ? WHERE id = ?", [
    datos.descripcion,
    id,
  ]);

  const actualizada = await buscarEspecialidadPorId(id);
  if (!actualizada) {
    throw new ErrorHttp(500, "No se pudo recuperar la especialidad actualizada");
  }
  return actualizada;
}

/**
 * Elimina una especialidad, previa validación de dependencias.
 *
 * @param id Id de la especialidad a eliminar.
 * @throws `ErrorHttp` 404 si no existe.
 * @throws `ErrorHttp` 409 si algún médico la tiene asociada o si aparece en
 *   alguna agenda.
 */
export async function eliminarEspecialidad(id: number): Promise<void> {
  if (!(await buscarEspecialidadPorId(id))) {
    throw new ErrorHttp(404, "La especialidad indicada no existe");
  }

  const bloqueantes = await buscarDependencias(id, DEPENDENCIAS_ESPECIALIDAD);
  if (bloqueantes.length > 0) {
    throw new ErrorHttp(
      409,
      `No se puede eliminar la especialidad porque tiene ${bloqueantes.join(" y ")}`,
    );
  }

  await pool.query("DELETE FROM especialidad WHERE id = ?", [id]);
}
