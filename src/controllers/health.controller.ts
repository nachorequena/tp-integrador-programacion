import { NextFunction, Request, Response } from "express";
import { probarConexion } from "../database/conexion";
import { responder } from "../utils/respuesta";

/**
 * Verifica que el servidor responda y que la conexión a la base funcione.
 * Si la base no responde se informa 503 (servicio no disponible), no 500:
 * el servidor está vivo, la dependencia es la que falla.
 */
export async function verificarEstado(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await probarConexion();
    responder(res, 200, "ok", { servidor: "ok", base_de_datos: "ok" });
  } catch (error) {
    console.error("[health] fallo la conexión a la base:", error);
    responder(res, 503, "No se pudo conectar a la base de datos", {
      servidor: "ok",
      base_de_datos: "error",
    });
  }
}
