import jwt, { SignOptions } from "jsonwebtoken";
import { entorno } from "../config/env";
import { PayloadJWT } from "../types";

/** Firma un JWT con el secreto y la expiración configurados en el `.env`. */
export function firmarToken(payload: PayloadJWT): string {
  const opciones: SignOptions = {
    expiresIn: entorno.jwtExpiraEn as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, entorno.jwtSecret, opciones);
}

/**
 * Verifica firma y vencimiento. Lanza si el token es inválido o expiró;
 * el que llama decide qué responder.
 */
export function verificarFirmaToken(token: string): PayloadJWT {
  return jwt.verify(token, entorno.jwtSecret) as PayloadJWT;
}
