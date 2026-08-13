import { RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { Sede } from "../types";

export async function listarSedes(): Promise<Sede[]> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT id, nombre, direccion, telefono FROM sede ORDER BY nombre",
  );
  return filas as Sede[];
}
