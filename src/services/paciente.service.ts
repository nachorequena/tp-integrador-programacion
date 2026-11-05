/**
 * SERVICE: pacientes
 * ==================
 *
 * Búsqueda de pacientes y edición de los datos propios del paciente.
 *
 * Flujo: `paciente.routes.ts` → `paciente.controller.ts` → este service →
 * tablas `usuario` y `cobertura`.
 *
 * Quién lo usa desde el frontend:
 *   - operador: buscar al paciente al que le asigna un turno;
 *   - médico: buscar al paciente cuyo historial quiere consultar;
 *   - paciente: "Mis datos personales" (`actualizarMisDatos`).
 *
 * El alta de pacientes del operador no pasa por acá: reutiliza
 * `auth.service.registrarPaciente`, igual que el registro público.
 */

import bcrypt from "bcrypt";
import { RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { DatosMisDatos, PacienteEncontrado, UsuarioPublico } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { SALT_ROUNDS } from "./auth.service";
import { existeCobertura } from "./cobertura.service";
import { buscarPublicoPorId } from "./usuario.service";

/** Tope de resultados: es un buscador, no un listado completo. */
const MAXIMO_RESULTADOS = 20;

/**
 * Busca pacientes por DNI o por apellido.
 *
 * - DNI: coincidencia por el principio ("3600" encuentra "36000960"), que es
 *   como se tipea un documento.
 * - Apellido: coincidencia en cualquier parte, sin importar mayúsculas (la
 *   colación de la tabla es `_ci`, case insensitive).
 *
 * Solo devuelve pacientes, y solo datos de identificación y cobertura: ni
 * email, ni teléfono, ni password.
 *
 * @param texto Texto ya validado (al menos 2 caracteres).
 * @returns Hasta 20 pacientes, ordenados por apellido y nombre.
 */
export async function buscarPacientes(texto: string): Promise<PacienteEncontrado[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.nombre, u.apellido, u.dni, u.fecha_nacimiento, u.id_cobertura,
            c.nombre AS cobertura
       FROM usuario u
       LEFT JOIN cobertura c ON c.id = u.id_cobertura
      WHERE u.rol = 'paciente' AND (u.dni LIKE ? OR u.apellido LIKE ?)
      ORDER BY u.apellido, u.nombre
      LIMIT ?`,
    [`${texto}%`, `%${texto}%`, MAXIMO_RESULTADOS],
  );
  return filas as PacienteEncontrado[];
}

/**
 * Actualiza email, teléfono, cobertura y (opcionalmente) contraseña del
 * paciente autenticado.
 *
 * El resto de los datos (nombre, DNI, fecha de nacimiento…) no se puede tocar
 * desde acá: el UPDATE solo nombra estas columnas, así que aunque el
 * validador dejara pasar otro campo, no llegaría a la base.
 *
 * @param idPaciente Id del paciente, tomado del token (nunca del cuerpo).
 * @param datos Datos ya validados.
 * @returns El usuario actualizado, sin la contraseña.
 * @throws `ErrorHttp` 409 si el email ya lo usa otro usuario.
 * @throws `ErrorHttp` 400 si la cobertura no existe.
 */
export async function actualizarMisDatos(
  idPaciente: number,
  datos: DatosMisDatos,
): Promise<UsuarioPublico> {
  // La unicidad del email se valida en la app porque el script de la cátedra
  // no tiene índice UNIQUE. Se excluye al propio paciente: dejar su mismo
  // email no es un duplicado.
  const [duplicados] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM usuario WHERE email = ? AND id <> ? LIMIT 1",
    [datos.email, idPaciente],
  );
  if (duplicados.length > 0) {
    throw new ErrorHttp(409, "El email ya está registrado por otro usuario");
  }

  if (!(await existeCobertura(datos.id_cobertura))) {
    throw new ErrorHttp(400, "La cobertura indicada no existe");
  }

  // Sin contraseña nueva, `COALESCE(NULL, password)` deja la actual.
  const hash = datos.password ? await bcrypt.hash(datos.password, SALT_ROUNDS) : null;

  await pool.query(
    `UPDATE usuario
        SET email = ?, telefono = ?, id_cobertura = ?, password = COALESCE(?, password)
      WHERE id = ? AND rol = 'paciente'`,
    [datos.email, datos.telefono, datos.id_cobertura, hash, idPaciente],
  );

  const actualizado = await buscarPublicoPorId(idPaciente);
  if (!actualizado) {
    throw new ErrorHttp(404, "El usuario del token ya no existe");
  }
  return actualizado;
}
