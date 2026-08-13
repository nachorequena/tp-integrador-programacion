import { NextFunction, Request, RequestHandler, Response } from "express";
import { ErrorHttp } from "../utils/errorHttp";

/**
 * Restringe el acceso a los roles indicados. Se monta SIEMPRE después de
 * `verificarToken`, que es quien deja el payload en `req.usuario`.
 * Si el rol no está permitido → 403.
 */
export function verificarRol(...rolesPermitidos: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const usuario = req.usuario;

    if (!usuario) {
      // Defensa por si alguien olvida montar verificarToken antes.
      next(new ErrorHttp(401, "Falta el token de autenticación"));
      return;
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      next(
        new ErrorHttp(
          403,
          "No tenés permisos para acceder a este recurso",
        ),
      );
      return;
    }

    next();
  };
}
