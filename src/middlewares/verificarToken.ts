import { NextFunction, Request, Response } from "express";
import { TokenExpiredError } from "jsonwebtoken";
import { ErrorHttp } from "../utils/errorHttp";
import { verificarFirmaToken } from "../utils/jwt";

/**
 * Valida el JWT del header `Authorization: Bearer <token>`.
 * Si falta, es inválido o está vencido → 401.
 * Si es válido, inyecta el payload en `req.usuario`.
 */
export function verificarToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;

  if (!header) {
    next(new ErrorHttp(401, "Falta el token de autenticación"));
    return;
  }

  const [esquema, token] = header.split(" ");
  if (esquema !== "Bearer" || !token) {
    next(
      new ErrorHttp(
        401,
        "Formato de autorización inválido. Se espera: Bearer <token>",
      ),
    );
    return;
  }

  try {
    req.usuario = verificarFirmaToken(token);
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      next(new ErrorHttp(401, "El token expiró"));
      return;
    }
    next(new ErrorHttp(401, "Token inválido"));
  }
}
