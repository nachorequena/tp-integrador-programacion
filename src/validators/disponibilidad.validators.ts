/**
 * VALIDADORES DE DISPONIBILIDAD
 * =============================
 *
 * Valida la query de `GET /disponibilidad/fechas` y
 * `GET /disponibilidad/horarios` (los usa `disponibilidad.controller.ts`).
 */

import { ConsultaDisponibilidad } from "../types";
import {
  comoObjeto,
  esFechaValida,
  lanzarSiHayErrores,
  textoLimpio,
  validarIdCuerpo,
} from "./comunes";

/**
 * Valida médico, especialidad y sede, los tres obligatorios.
 *
 * Se reutiliza `validarIdCuerpo` aunque vengan por query: el control es el
 * mismo (entero positivo, obligatorio) y acumula los errores igual.
 *
 * @param query `req.query` de Express.
 * @returns La consulta con los tres ids ya convertidos.
 * @throws `ErrorHttp` 400 si falta alguno o está mal formado.
 */
export function validarConsultaDisponibilidad(query: unknown): ConsultaDisponibilidad {
  const datos = comoObjeto(query);
  const errores: string[] = [];

  const consulta: ConsultaDisponibilidad = {
    id_medico: validarIdCuerpo(datos.id_medico, "id_medico", errores),
    id_especialidad: validarIdCuerpo(datos.id_especialidad, "id_especialidad", errores),
    id_sede: validarIdCuerpo(datos.id_sede, "id_sede", errores),
  };

  lanzarSiHayErrores(errores);
  return consulta;
}

/**
 * Valida la consulta de horarios: lo mismo que la de fechas, más la fecha.
 *
 * @param query `req.query` de Express.
 * @returns La consulta y la fecha "YYYY-MM-DD".
 * @throws `ErrorHttp` 400 si falta algún dato o la fecha no es real.
 */
export function validarConsultaHorarios(
  query: unknown,
): { consulta: ConsultaDisponibilidad; fecha: string } {
  const consulta = validarConsultaDisponibilidad(query);
  const errores: string[] = [];

  const fecha = textoLimpio(comoObjeto(query).fecha);
  if (!fecha) errores.push("fecha es obligatoria");
  else if (!esFechaValida(fecha))
    errores.push("fecha debe tener formato YYYY-MM-DD y ser una fecha real");

  lanzarSiHayErrores(errores);
  return { consulta, fecha };
}
