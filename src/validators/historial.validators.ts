/**
 * VALIDADORES DE HISTORIAL CLÍNICO
 * ================================
 *
 * Valida el cuerpo de `POST /historial/:idTurno`.
 *
 * Las reglas que dependen de la base —que el turno exista, que esté atendido,
 * que lo haya atendido este médico, que no tenga ya un historial cargado—
 * viven en `historial.service.ts`.
 */

import { DatosHistorial } from "../types";
import {
  comoObjeto,
  lanzarSiHayErrores,
  validarTextoObligatorio,
  validarTextoOpcional,
} from "./comunes";

/**
 * Largo de las tres columnas de texto de `historial_clinico`.
 *
 * Las tres son `varchar(255)`. Se controla en la app porque MySQL en modo
 * estricto rechaza el INSERT con el error 1406 y eso terminaría en un 500.
 */
const MAXIMO_TEXTO = 255;

/**
 * Valida el cuerpo del alta de historial clínico.
 *
 * `diagnostico` es `NOT NULL` en la base, así que es obligatorio. `tratamiento`
 * y `observaciones` admiten NULL: si no vienen, se devuelven como `undefined`
 * y el service los inserta como NULL.
 *
 * @param cuerpo `req.body`, sin verificar.
 * @returns Los datos del historial, listos para el service.
 * @throws `ErrorHttp` 400 con todos los errores encontrados, juntos.
 */
export function validarHistorial(cuerpo: unknown): DatosHistorial {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  const diagnostico = validarTextoObligatorio(
    datos.diagnostico,
    "diagnostico",
    MAXIMO_TEXTO,
    errores,
  );

  const tratamiento = validarTextoOpcional(
    datos.tratamiento,
    "tratamiento",
    MAXIMO_TEXTO,
    errores,
  );

  const observaciones = validarTextoOpcional(
    datos.observaciones,
    "observaciones",
    MAXIMO_TEXTO,
    errores,
  );

  lanzarSiHayErrores(errores);

  return { diagnostico, tratamiento, observaciones };
}
