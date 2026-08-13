/**
 * FIRMA Y VERIFICACIÓN DE JWT
 * ===========================
 *
 * Envuelve la librería `jsonwebtoken` para que el resto del proyecto no tenga
 * que conocer sus detalles ni repetir el secreto en cada llamada.
 *
 * ¿Qué es un JWT? Un texto con tres partes separadas por puntos:
 *
 *   cabecera.payload.firma
 *
 * - **cabecera**: qué algoritmo se usó (acá HS256).
 * - **payload**: los datos (nuestro `PayloadJWT`: id, rol, id_sede).
 * - **firma**: el resultado de firmar cabecera+payload con `JWT_SECRET`.
 *
 * Las dos primeras partes son base64, NO cifrado: cualquiera puede leerlas.
 * Lo que aporta el JWT no es secreto sino INTEGRIDAD: si alguien edita el
 * payload para ponerse `rol: "admin"`, la firma deja de coincidir y
 * `jwt.verify` lo rechaza, porque para generar una firma válida haría falta el
 * secreto, que solo está en el `.env` del servidor.
 */

import jwt, { SignOptions } from "jsonwebtoken";
import { entorno } from "../config/env";
import { PayloadJWT } from "../types";

/**
 * Genera un token firmado para un usuario que ya se autenticó correctamente.
 *
 * La librería agrega sola dos campos al payload: `iat` (momento de emisión) y
 * `exp` (momento de vencimiento, calculado a partir de `expiresIn`).
 *
 * @param payload Datos del usuario a incluir. Solo información no sensible.
 * @returns El JWT como string, listo para mandar al cliente.
 */
export function firmarToken(payload: PayloadJWT): string {
  const opciones: SignOptions = {
    // El casteo es necesario porque los tipos de jsonwebtoken esperan un
    // formato de tiempo concreto ("1d", "2h", un número de segundos...) y lo
    // que viene del .env es un string genérico.
    expiresIn: entorno.jwtExpiraEn as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, entorno.jwtSecret, opciones);
}

/**
 * Verifica un token: comprueba la firma y que no esté vencido.
 *
 * Esta función LANZA en vez de devolver `null` en caso de fallo, y es a
 * propósito: obliga a quien la llama a decidir explícitamente qué hacer. El
 * middleware `verificarToken` aprovecha eso para distinguir un token vencido
 * (`TokenExpiredError`) de uno inválido y dar un mensaje distinto en cada caso.
 *
 * @param token El JWT recibido, ya sin el prefijo "Bearer ".
 * @returns El payload decodificado.
 * @throws `TokenExpiredError` si venció; `JsonWebTokenError` si la firma no
 *   coincide o el formato está roto.
 */
export function verificarFirmaToken(token: string): PayloadJWT {
  return jwt.verify(token, entorno.jwtSecret) as PayloadJWT;
}
