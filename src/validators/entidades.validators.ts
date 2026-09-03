/**
 * VALIDADORES DE LAS ENTIDADES BASE
 * =================================
 *
 * Sede, especialidad y cobertura. Son tres CRUD chicos y con la misma forma, así
 * que sus validadores viven juntos en un archivo en vez de en tres de cinco
 * líneas cada uno.
 *
 * Los largos máximos salen de `docs/clinica_ampliada.sql`:
 *
 *   sede.nombre           varchar(50)
 *   sede.direccion        varchar(100)
 *   sede.telefono         varchar(15)
 *   especialidad.descripcion varchar(30)
 *   cobertura.nombre      varchar(30)
 *
 * Todas las columnas son NOT NULL, así que los tres campos de sede y el único
 * de especialidad/cobertura son obligatorios.
 *
 * El mismo validador sirve para el alta y para la modificación: como el PUT
 * reemplaza la fila completa, exige exactamente los mismos campos que el POST.
 */

import { DatosCobertura, DatosEspecialidad, DatosSede } from "../types";
import {
  comoObjeto,
  lanzarSiHayErrores,
  SOLO_DIGITOS,
  validarTextoObligatorio,
} from "./comunes";

/**
 * Valida el cuerpo del alta o la modificación de una sede.
 *
 * @param cuerpo `req.body`, sin verificar.
 * @returns Los datos de la sede, ya recortados.
 * @throws `ErrorHttp` 400 con todos los errores encontrados.
 */
export function validarSede(cuerpo: unknown): DatosSede {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  const nombre = validarTextoObligatorio(datos.nombre, "nombre", 50, errores);
  const direccion = validarTextoObligatorio(
    datos.direccion,
    "direccion",
    100,
    errores,
  );

  // `sede.telefono` es varchar(15): más largo que el de `usuario` (10), porque
  // acá puede incluir característica de la ciudad.
  const telefono = validarTextoObligatorio(datos.telefono, "telefono", 15, errores);
  if (telefono && !SOLO_DIGITOS.test(telefono)) {
    errores.push("telefono debe contener solo números");
  }

  lanzarSiHayErrores(errores);

  return { nombre, direccion, telefono };
}

/**
 * Valida el cuerpo del alta o la modificación de una especialidad.
 *
 * Ojo con el nombre del campo: en esta tabla es `descripcion`, no `nombre`.
 *
 * @param cuerpo `req.body`, sin verificar.
 * @returns Los datos de la especialidad.
 * @throws `ErrorHttp` 400 si falta o excede el largo.
 */
export function validarEspecialidad(cuerpo: unknown): DatosEspecialidad {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  const descripcion = validarTextoObligatorio(
    datos.descripcion,
    "descripcion",
    30,
    errores,
  );

  lanzarSiHayErrores(errores);

  return { descripcion };
}

/**
 * Valida el cuerpo del alta o la modificación de una cobertura.
 *
 * @param cuerpo `req.body`, sin verificar.
 * @returns Los datos de la cobertura.
 * @throws `ErrorHttp` 400 si falta o excede el largo.
 */
export function validarCobertura(cuerpo: unknown): DatosCobertura {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  const nombre = validarTextoObligatorio(datos.nombre, "nombre", 30, errores);

  lanzarSiHayErrores(errores);

  return { nombre };
}
