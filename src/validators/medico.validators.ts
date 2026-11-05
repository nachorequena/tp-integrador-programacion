/**
 * VALIDADORES DE MÉDICOS
 * ======================
 *
 * Valida los filtros de `GET /medicos` (los usa `medico.controller.ts`).
 *
 * Como en el resto del proyecto, solo se controla la FORMA: que los ids sean
 * enteros positivos. Si la especialidad o la sede no existen, el listado
 * simplemente sale vacío, que es la respuesta correcta a "médicos de una
 * especialidad que no existe".
 */

import { FiltrosMedico } from "../types";
import { comoObjeto, lanzarSiHayErrores, validarIdOpcional } from "./comunes";

/**
 * Valida los filtros opcionales del listado de médicos.
 *
 * @param query `req.query` de Express.
 * @returns Los filtros presentes, ya convertidos a número.
 * @throws `ErrorHttp` 400 si algún id vino mal formado.
 */
export function validarFiltrosMedico(query: unknown): FiltrosMedico {
  const datos = comoObjeto(query);
  const errores: string[] = [];

  const filtros: FiltrosMedico = {
    id_especialidad: validarIdOpcional(datos.id_especialidad, "id_especialidad", errores),
    id_sede: validarIdOpcional(datos.id_sede, "id_sede", errores),
  };

  lanzarSiHayErrores(errores);
  return filtros;
}
