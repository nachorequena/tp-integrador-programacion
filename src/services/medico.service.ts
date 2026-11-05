/**
 * SERVICE: médicos
 * ================
 *
 * Listado (para cualquier usuario con sesión) de los médicos con sus
 * especialidades, y consultas auxiliares sobre `medico_especialidad`.
 *
 * Flujo: `GET /medicos` → `medico.routes.ts` → `medico.controller.ts` → este
 * service → tablas `usuario`, `medico_especialidad`, `especialidad` y
 * `agenda`.
 *
 * Quién lo usa desde el frontend:
 *   - el paciente y el operador, en el paso "médico" de la solicitud de turno
 *     (filtrando por especialidad y sede);
 *   - el operador, para elegir a qué médico cargarle una agenda nueva;
 *   - el médico, para conocer sus propias especialidades al cargar su agenda.
 *
 * También lo usa `agenda.service.ts` (vía `tieneEspecialidad`) para no aceptar
 * un rango horario en una especialidad que el médico no tiene.
 */

import { RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { EspecialidadDeMedico, FiltrosMedico, MedicoListado } from "../types";

/**
 * Lista los médicos, opcionalmente filtrados por especialidad y sede.
 *
 * Criterio del filtro por sede: un médico "atiende en una sede" si es su sede
 * asignada **o** si tiene agenda desde hoy en adelante en esa sede. Lo segundo
 * hace falta porque la consigna final permite que un médico atienda en más de
 * una sede: la sede de cada rango horario es la que dice la agenda, no la del
 * usuario.
 *
 * Las especialidades se traen con UNA sola consulta extra para todos los
 * médicos (con `IN (...)`) y se reparten en memoria. Hacer una consulta por
 * médico sería el clásico problema "N+1": con 30 médicos, 31 viajes a la base.
 *
 * Solo se devuelven nombre, apellido, sede y especialidades: la consigna pide
 * explícitamente que este listado no exponga otros datos personales (DNI,
 * email, teléfono), porque lo ven incluso los pacientes.
 *
 * @param filtros Filtros ya validados (`id_especialidad`, `id_sede`).
 * @returns Los médicos ordenados por apellido y nombre, con sus especialidades.
 */
export async function listarMedicos(filtros: FiltrosMedico): Promise<MedicoListado[]> {
  const condiciones: string[] = ["u.rol = 'medico'"];
  const parametros: unknown[] = [];

  if (filtros.id_especialidad !== undefined) {
    condiciones.push(
      `EXISTS (SELECT 1 FROM medico_especialidad me
                WHERE me.id_medico = u.id AND me.id_especialidad = ?)`,
    );
    parametros.push(filtros.id_especialidad);
  }

  if (filtros.id_sede !== undefined) {
    // CURDATE() es la fecha del servidor MySQL: las agendas viejas no cuentan
    // para decir que el médico atiende en esa sede.
    condiciones.push(
      `(u.id_sede = ? OR EXISTS (SELECT 1 FROM agenda a
                                   WHERE a.id_medico = u.id AND a.id_sede = ?
                                     AND a.fecha >= CURDATE()))`,
    );
    parametros.push(filtros.id_sede, filtros.id_sede);
  }

  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.nombre, u.apellido, u.id_sede
       FROM usuario u
      WHERE ${condiciones.join(" AND ")}
      ORDER BY u.apellido, u.nombre`,
    parametros,
  );

  const medicos: MedicoListado[] = filas.map((fila) => ({
    id: Number(fila.id),
    nombre: String(fila.nombre),
    apellido: String(fila.apellido),
    id_sede: fila.id_sede === null ? null : Number(fila.id_sede),
    especialidades: [],
  }));

  if (medicos.length === 0) return medicos;

  // Una sola consulta para las especialidades de todos los médicos listados.
  // mysql2 expande el array del `IN (?)` a "IN (1, 2, 3)" de forma segura.
  const [especialidades] = await pool.query<RowDataPacket[]>(
    `SELECT me.id_medico, e.id, e.descripcion
       FROM medico_especialidad me
       JOIN especialidad e ON e.id = me.id_especialidad
      WHERE me.id_medico IN (?)
      ORDER BY e.descripcion`,
    [medicos.map((medico) => medico.id)],
  );

  // Índice por id para repartir cada especialidad a su médico sin recorrer
  // la lista entera por cada fila.
  const porId = new Map<number, MedicoListado>(medicos.map((m) => [m.id, m]));
  for (const fila of especialidades) {
    const especialidad: EspecialidadDeMedico = {
      id: Number(fila.id),
      descripcion: String(fila.descripcion),
    };
    porId.get(Number(fila.id_medico))?.especialidades.push(especialidad);
  }

  return medicos;
}

/**
 * Indica si un médico tiene asignada una especialidad (`medico_especialidad`).
 *
 * La usa el alta y modificación de agenda: un rango horario de Cardiología
 * para un traumatólogo dejaría a los pacientes sacando turno con alguien que
 * no atiende esa especialidad.
 *
 * @param idMedico Id del médico.
 * @param idEspecialidad Id de la especialidad.
 * @returns `true` si la tiene asignada.
 */
export async function tieneEspecialidad(
  idMedico: number,
  idEspecialidad: number,
): Promise<boolean> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM medico_especialidad WHERE id_medico = ? AND id_especialidad = ? LIMIT 1",
    [idMedico, idEspecialidad],
  );
  return filas.length > 0;
}
