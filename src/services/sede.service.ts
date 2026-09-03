/**
 * SERVICE: sede
 * =============
 *
 * CRUD completo de la tabla `sede` (las sucursales de la clínica).
 *
 * Todos los endpoints que lo usan están restringidos al rol `admin` desde las
 * rutas, así que acá no hay comprobaciones de permisos: cuando el service se
 * ejecuta, `verificarRol` ya dejó pasar la petición.
 *
 * El listado existía desde la semana 1 (era el endpoint de prueba de
 * `verificarRol`); la semana 2 le suma alta, modificación y baja.
 */

import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { DatosSede, Sede } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { buscarDependencias, Dependencia } from "./dependencias.service";

/**
 * Relaciones que impiden borrar una sede.
 *
 * La consigna pide validar "que no tenga médicos, operadores ni agenda
 * asociada". Médicos y operadores son filas de `usuario` con `id_sede`
 * apuntando a esta sede, así que una sola comprobación cubre a los dos.
 */
const DEPENDENCIAS_SEDE: Dependencia[] = [
  { etiqueta: "usuarios asignados", tabla: "usuario", columna: "id_sede" },
  { etiqueta: "agendas cargadas", tabla: "agenda", columna: "id_sede" },
];

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

/**
 * Busca una sede por id.
 *
 * @param id Id de la sede.
 * @returns La sede, o `null` si no existe.
 */
export async function buscarSedePorId(id: number): Promise<Sede | null> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT id, nombre, direccion, telefono FROM sede WHERE id = ? LIMIT 1",
    [id],
  );
  return (filas[0] as Sede | undefined) ?? null;
}

/**
 * Comprueba que exista una sede con ese id.
 *
 * La usan el alta y la modificación de agenda, donde `id_sede` es una clave
 * foránea: sin este chequeo el INSERT fallaría con un error del motor.
 *
 * @param id Id a comprobar.
 * @returns `true` si existe.
 */
export async function existeSede(id: number): Promise<boolean> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM sede WHERE id = ? LIMIT 1",
    [id],
  );
  return filas.length > 0;
}

/**
 * Da de alta una sede.
 *
 * @param datos Nombre, dirección y teléfono ya validados.
 * @returns La sede creada, con el id que asignó la base.
 * @throws `ErrorHttp` 500 si no se puede releer la fila recién insertada.
 */
export async function crearSede(datos: DatosSede): Promise<Sede> {
  const [resultado] = await pool.query<ResultSetHeader>(
    "INSERT INTO sede (nombre, direccion, telefono) VALUES (?, ?, ?)",
    [datos.nombre, datos.direccion, datos.telefono],
  );

  // Se relee para devolver la fila tal como quedó guardada, con su id.
  const sede = await buscarSedePorId(resultado.insertId);
  if (!sede) {
    throw new ErrorHttp(500, "No se pudo recuperar la sede recién creada");
  }
  return sede;
}

/**
 * Modifica una sede existente.
 *
 * Primero comprueba que exista, y así puede distinguir "no está" (404) de
 * "estaba y se actualizó". Si se mirara `affectedRows` del UPDATE no se podría:
 * MySQL informa 0 tanto cuando la fila no existe como cuando los valores
 * enviados son idénticos a los que ya estaban.
 *
 * @param id Id de la sede a modificar.
 * @param datos Datos nuevos, ya validados.
 * @returns La sede con los datos actualizados.
 * @throws `ErrorHttp` 404 si no existe una sede con ese id.
 */
export async function actualizarSede(id: number, datos: DatosSede): Promise<Sede> {
  if (!(await buscarSedePorId(id))) {
    throw new ErrorHttp(404, "La sede indicada no existe");
  }

  await pool.query(
    "UPDATE sede SET nombre = ?, direccion = ?, telefono = ? WHERE id = ?",
    [datos.nombre, datos.direccion, datos.telefono, id],
  );

  const actualizada = await buscarSedePorId(id);
  if (!actualizada) {
    throw new ErrorHttp(500, "No se pudo recuperar la sede actualizada");
  }
  return actualizada;
}

/**
 * Elimina una sede, previa validación de dependencias.
 *
 * @param id Id de la sede a eliminar.
 * @throws `ErrorHttp` 404 si la sede no existe.
 * @throws `ErrorHttp` 409 si tiene usuarios o agendas asociadas, con el detalle
 *   de qué la está usando.
 */
export async function eliminarSede(id: number): Promise<void> {
  if (!(await buscarSedePorId(id))) {
    throw new ErrorHttp(404, "La sede indicada no existe");
  }

  const bloqueantes = await buscarDependencias(id, DEPENDENCIAS_SEDE);
  if (bloqueantes.length > 0) {
    throw new ErrorHttp(
      409,
      `No se puede eliminar la sede porque tiene ${bloqueantes.join(" y ")}`,
    );
  }

  await pool.query("DELETE FROM sede WHERE id = ?", [id]);
}
