import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { DatosRegistro, Usuario, UsuarioPublico } from "../types";

/**
 * Columnas que se pueden exponer hacia afuera. Se listan explícitamente para
 * que la `password` no salga nunca por descuido en un `SELECT *`.
 */
const COLUMNAS_PUBLICAS =
  "id, nombre, apellido, dni, email, telefono, fecha_nacimiento, rol, id_sede, id_cobertura";

/** Busca por DNI incluyendo el hash: lo usa el login para comparar. */
export async function buscarPorDni(dni: string): Promise<Usuario | null> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM usuario WHERE dni = ? LIMIT 1",
    [dni],
  );
  return (filas[0] as Usuario | undefined) ?? null;
}

export async function buscarPublicoPorId(
  id: number,
): Promise<UsuarioPublico | null> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUMNAS_PUBLICAS} FROM usuario WHERE id = ? LIMIT 1`,
    [id],
  );
  return (filas[0] as UsuarioPublico | undefined) ?? null;
}

/**
 * La base no tiene índices UNIQUE en `dni` ni `email` (ver CLAUDE.md, sección
 * 7), así que la unicidad se valida acá antes de insertar.
 */
export async function existeDni(dni: string): Promise<boolean> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM usuario WHERE dni = ? LIMIT 1",
    [dni],
  );
  return filas.length > 0;
}

export async function existeEmail(email: string): Promise<boolean> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM usuario WHERE email = ? LIMIT 1",
    [email],
  );
  return filas.length > 0;
}

/**
 * Inserta un paciente. El rol se fuerza a "paciente" y `id_sede` queda en
 * NULL: el registro público no puede crear otros roles.
 */
export async function crearPaciente(
  datos: DatosRegistro,
  passwordHasheada: string,
): Promise<number> {
  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO usuario
       (apellido, nombre, fecha_nacimiento, password, rol, email, telefono, dni, id_sede, id_cobertura)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      datos.apellido,
      datos.nombre,
      datos.fecha_nacimiento,
      passwordHasheada,
      "paciente",
      datos.email,
      datos.telefono,
      datos.dni,
      datos.id_cobertura,
    ],
  );
  return resultado.insertId;
}
