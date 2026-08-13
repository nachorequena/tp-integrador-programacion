/**
 * CONTROLLER: health
 * ==================
 *
 * Endpoint de diagnóstico. La consigna pide "probar la conexión con un endpoint
 * simple antes de avanzar", y es lo primero que conviene mirar cuando algo no
 * anda: separa "el servidor no está levantado" de "el servidor está bien pero
 * no llega a la base", que son dos problemas con soluciones muy distintas.
 */

import { NextFunction, Request, Response } from "express";
import { probarConexion } from "../database/conexion";
import { responder } from "../utils/respuesta";

/**
 * `GET /health` — estado del servidor y de la base de datos.
 *
 * Es el único controller que NO usa `next(error)`: maneja su propio fallo. Y es
 * a propósito, porque acá el error no es una excepción, es EL DATO que se está
 * pidiendo. Si la base no responde, eso no es un 500 (el servidor funciona
 * perfectamente y contesta) sino un **503 (Service Unavailable)**: el servicio
 * no está disponible porque una dependencia externa está caída.
 *
 * En los dos casos se devuelve el detalle en `datos`, así se ve de un vistazo
 * cuál de las dos partes falló.
 *
 * @param _req Sin uso: el endpoint no recibe parámetros.
 * @param res Respuesta de Express.
 * @param next Sin uso, pero se mantiene en la firma por consistencia con el
 *   resto de los controllers.
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
    // El detalle real (credenciales, host, motor apagado) va solo al log: al
    // cliente no se le cuenta nada de la infraestructura.
    console.error("[health] fallo la conexión a la base:", error);
    responder(res, 503, "No se pudo conectar a la base de datos", {
      servidor: "ok",
      base_de_datos: "error",
    });
  }
}
