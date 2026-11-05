/**
 * VALIDADORES DE PACIENTES
 * ========================
 *
 * Valida la búsqueda de pacientes y la edición de los datos propios del
 * paciente. Los usa `paciente.controller.ts`.
 *
 * El alta de pacientes del operador no tiene validador propio: reutiliza
 * `validarRegistro` (de `auth.validators.ts`), porque la consigna pide que
 * tenga "los mismos datos y validaciones que el registro".
 */

import { DatosMisDatos } from "../types";
import { validarEmail, validarIdCobertura, validarPassword, validarTelefono } from "./auth.validators";
import { comoObjeto, lanzarSiHayErrores, textoLimpio } from "./comunes";

/** Mínimo de caracteres para buscar: con uno solo se traería media base. */
const MINIMO_BUSQUEDA = 2;

/**
 * Únicos campos que el paciente puede modificar de sí mismo (consigna final:
 * "solo email, contraseña, teléfono y cobertura").
 */
const CAMPOS_EDITABLES = ["email", "password", "telefono", "id_cobertura"];

/**
 * Valida el texto de `GET /pacientes?busqueda=`.
 *
 * @param query `req.query` de Express.
 * @returns El texto a buscar (DNI o apellido), recortado.
 * @throws `ErrorHttp` 400 si falta o es demasiado corto.
 */
export function validarBusquedaPacientes(query: unknown): string {
  const datos = comoObjeto(query);
  const errores: string[] = [];

  const busqueda = textoLimpio(datos.busqueda);
  if (busqueda.length < MINIMO_BUSQUEDA) {
    errores.push(`busqueda debe tener al menos ${MINIMO_BUSQUEDA} caracteres (DNI o apellido)`);
  } else if (busqueda.length > 30) {
    errores.push("busqueda no puede superar 30 caracteres");
  }

  lanzarSiHayErrores(errores);
  return busqueda;
}

/**
 * Valida el cuerpo de `PUT /pacientes/mis-datos`.
 *
 * Si llega cualquier otro campo (nombre, DNI, rol…), se rechaza con 400 en
 * vez de ignorarlo en silencio: así quien consume la API se entera de que ese
 * dato no se puede cambiar, en lugar de creer que se guardó.
 *
 * @param cuerpo `req.body`, sin verificar.
 * @returns Email, teléfono, cobertura y, si vino, la contraseña nueva.
 * @throws `ErrorHttp` 400 con todos los errores encontrados.
 */
export function validarMisDatos(cuerpo: unknown): DatosMisDatos {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  const sobrantes = Object.keys(datos).filter((campo) => !CAMPOS_EDITABLES.includes(campo));
  if (sobrantes.length > 0) {
    errores.push(
      `Solo se pueden modificar email, password, telefono e id_cobertura (no: ${sobrantes.join(", ")})`,
    );
  }

  const email = validarEmail(datos.email, errores);
  const telefono = validarTelefono(datos.telefono, errores);
  const idCobertura = validarIdCobertura(datos.id_cobertura, errores);
  // Opcional: sin contraseña nueva, se conserva la actual.
  const password = validarPassword(datos.password, errores, false);

  lanzarSiHayErrores(errores);
  return { email, telefono, id_cobertura: idCobertura, password };
}
