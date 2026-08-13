import { NextFunction, Request, Response } from "express";
import * as authService from "../services/auth.service";
import { ErrorHttp } from "../utils/errorHttp";
import { responder } from "../utils/respuesta";
import { validarLogin, validarRegistro } from "../validators/auth.validators";

/** POST /auth/registro — alta de paciente. */
export async function registro(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const datos = validarRegistro(req.body);
    const usuario = await authService.registrarPaciente(datos);
    responder(res, 201, "ok", usuario);
  } catch (error) {
    next(error);
  }
}

/** POST /auth/login — devuelve el JWT. */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const datos = validarLogin(req.body);
    const resultado = await authService.login(datos);
    responder(res, 200, "ok", resultado);
  } catch (error) {
    next(error);
  }
}

/** GET /auth/perfil — datos del usuario logueado, tomados del token. */
export async function perfil(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.usuario) {
      throw new ErrorHttp(401, "Falta el token de autenticación");
    }
    const usuario = await authService.obtenerPerfil(req.usuario.id);
    responder(res, 200, "ok", usuario);
  } catch (error) {
    next(error);
  }
}
