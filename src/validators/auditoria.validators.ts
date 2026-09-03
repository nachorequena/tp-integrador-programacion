/**
 * VALIDADORES DE AUDITORÍA
 * ========================
 *
 * Valida los filtros de `GET /auditoria`.
 */

import { AccionAuditoria, FiltrosAuditoria } from "../types";
import {
  comoObjeto,
  esFechaValida,
  lanzarSiHayErrores,
  textoLimpio,
} from "./comunes";

/**
 * Entidades que el log puede contener.
 *
 * Se valida contra esta lista en vez de aceptar cualquier texto para que un
 * `?entidad=sedes` en plural devuelva un 400 que lo explique, en lugar de un
 * listado vacío que parece un problema de datos.
 */
const ENTIDADES = ["usuario", "sede", "especialidad", "cobertura", "agenda", "turno"];

/** Valores válidos de la columna `accion`. */
const ACCIONES: AccionAuditoria[] = ["ALTA", "BAJA", "MODIFICACION"];

/**
 * Valida los filtros del listado de auditoría.
 *
 * Los cuatro son opcionales. Un filtro ausente no aparece en el resultado, así
 * el service sabe que no tiene que agregar esa condición al WHERE.
 *
 * @param query `req.query` de Express.
 * @returns Solo los filtros que vinieron, ya convertidos.
 * @throws `ErrorHttp` 400 si alguno tiene formato inválido.
 */
export function validarFiltrosAuditoria(query: unknown): FiltrosAuditoria {
  const datos = comoObjeto(query);
  const errores: string[] = [];
  const filtros: FiltrosAuditoria = {};

  if (datos.id_usuario !== undefined && datos.id_usuario !== "") {
    const id = Number(datos.id_usuario);
    if (!Number.isInteger(id) || id <= 0)
      errores.push("id_usuario debe ser un número entero positivo");
    else filtros.id_usuario = id;
  }

  if (datos.entidad !== undefined && datos.entidad !== "") {
    const entidad = textoLimpio(datos.entidad).toLowerCase();
    if (!ENTIDADES.includes(entidad))
      errores.push(`entidad debe ser una de: ${ENTIDADES.join(", ")}`);
    else filtros.entidad = entidad;
  }

  const desde = validarExtremo(datos.desde, "desde", errores);
  const hasta = validarExtremo(datos.hasta, "hasta", errores);

  if (desde) filtros.desde = desde;
  if (hasta) filtros.hasta = hasta;

  // Un rango invertido devolvería siempre vacío sin explicar por qué.
  if (desde && hasta && desde > hasta) {
    errores.push("desde no puede ser posterior a hasta");
  }

  lanzarSiHayErrores(errores);

  return filtros;
}

/**
 * Valida uno de los dos extremos de un rango de fechas.
 *
 * @param valor Valor crudo del query string.
 * @param nombreCampo Nombre del campo, para el mensaje de error.
 * @param errores Array donde se acumulan los errores.
 * @returns La fecha validada, o `undefined` si no vino.
 */
export function validarExtremo(
  valor: unknown,
  nombreCampo: string,
  errores: string[],
): string | undefined {
  if (valor === undefined || valor === null || valor === "") return undefined;

  const fecha = textoLimpio(valor);
  if (!esFechaValida(fecha)) {
    errores.push(`${nombreCampo} debe tener formato YYYY-MM-DD y ser una fecha real`);
    return undefined;
  }

  return fecha;
}

/** Acciones válidas, expuestas para la documentación de la API. */
export { ACCIONES, ENTIDADES };
