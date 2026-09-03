/**
 * VALIDADORES DE REPORTES
 * =======================
 *
 * Valida el rango de fechas que comparten los cuatro reportes.
 *
 * La consigna pide que "todos los indicadores puedan filtrarse por rango de
 * fechas", así que la validación es una sola y se reutiliza en los cuatro
 * endpoints: si mañana cambia el formato, se toca en un solo lugar.
 */

import { RangoFechas } from "../types";
import { comoObjeto, lanzarSiHayErrores } from "./comunes";
import { validarExtremo } from "./auditoria.validators";

/**
 * Valida `?desde=&hasta=`.
 *
 * Los dos son opcionales e inclusivos: sin ninguno, el reporte abarca todo el
 * histórico, que es el comportamiento razonable para un tablero.
 *
 * @param query `req.query` de Express.
 * @returns El rango, con los extremos que hayan venido.
 * @throws `ErrorHttp` 400 si alguna fecha es inválida o el rango está invertido.
 */
export function validarRangoFechas(query: unknown): RangoFechas {
  const datos = comoObjeto(query);
  const errores: string[] = [];
  const rango: RangoFechas = {};

  const desde = validarExtremo(datos.desde, "desde", errores);
  const hasta = validarExtremo(datos.hasta, "hasta", errores);

  if (desde) rango.desde = desde;
  if (hasta) rango.hasta = hasta;

  if (desde && hasta && desde > hasta) {
    errores.push("desde no puede ser posterior a hasta");
  }

  lanzarSiHayErrores(errores);

  return rango;
}
