import { NextFunction, Request, Response } from "express";
import * as sedeService from "../services/sede.service";
import { responder } from "../utils/respuesta";

export async function listar(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sedes = await sedeService.listarSedes();
    responder(res, 200, "ok", sedes);
  } catch (error) {
    next(error);
  }
}
