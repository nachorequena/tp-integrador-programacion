import { NextFunction, Request, Response } from "express";
import * as coberturaService from "../services/cobertura.service";
import { responder } from "../utils/respuesta";

export async function listar(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const coberturas = await coberturaService.listarCoberturas();
    responder(res, 200, "ok", coberturas);
  } catch (error) {
    next(error);
  }
}
