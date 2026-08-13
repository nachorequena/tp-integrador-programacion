import { RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { Cobertura } from "../types";

/** Coberturas disponibles para elegir en el registro. */
export async function listarCoberturas(): Promise<Cobertura[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT id, nombre FROM cobertura ORDER BY nombre",
  );
  return filas as Cobertura[];
}

/** Valida que el `id_cobertura` recibido en el registro exista en la base. */
export async function existeCobertura(id: number): Promise<boolean> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM cobertura WHERE id = ? LIMIT 1",
    [id],
  );
  return filas.length > 0;
}
