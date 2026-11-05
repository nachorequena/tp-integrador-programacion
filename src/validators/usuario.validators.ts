/**
 * VALIDADORES DE GESTIÓN DE USUARIOS (rol administrador)
 * ======================================================
 *
 * Valida el listado, el alta y la edición de usuarios que hace el
 * administrador. Los usa `usuario.controller.ts`.
 *
 * Los datos personales se validan con las MISMAS funciones que el registro
 * (`auth.validators.ts`): un DNI o un email válido lo es igual en el registro
 * público que en la pantalla del administrador.
 *
 * Reglas por rol que vienen de la consigna final:
 *   - operador y médico tienen sede (obligatoria);
 *   - el administrador NO tiene sede: opera sobre todas;
 *   - el médico tiene una o más especialidades (`medico_especialidad`);
 *   - el paciente tiene cobertura (obligatoria) y no tiene sede.
 */

import { DatosUsuarioAdmin, FiltrosUsuarios, Paginacion, Rol, ROLES } from "../types";
import { validarDatosPersonales, validarIdCobertura, validarPassword } from "./auth.validators";
import {
  comoObjeto,
  lanzarSiHayErrores,
  textoLimpio,
  validarIdCuerpo,
  validarIdOpcional,
  validarPaginacion,
} from "./comunes";

/**
 * Roles que el administrador puede dar de alta. El paciente NO está: se
 * registra solo (o lo da de alta el operador), con su cobertura.
 */
const ROLES_ALTA: Rol[] = ["admin", "operador", "medico"];

/**
 * Valida un rol contra una lista de permitidos.
 *
 * @param valor Valor crudo recibido.
 * @param permitidos Roles aceptados en este caso.
 * @param errores Array donde se acumulan los errores.
 * @returns El rol, o `undefined` si no era válido.
 */
function validarRol(valor: unknown, permitidos: readonly Rol[], errores: string[]): Rol | undefined {
  const rol = textoLimpio(valor).toLowerCase();
  if (!rol) {
    errores.push("rol es obligatorio");
    return undefined;
  }
  if (!permitidos.includes(rol as Rol)) {
    errores.push(`rol debe ser uno de: ${permitidos.join(", ")}`);
    return undefined;
  }
  return rol as Rol;
}

/**
 * Valida la lista de especialidades de un médico.
 *
 * @param valor Valor crudo recibido (se espera un array de ids).
 * @param errores Array donde se acumulan los errores.
 * @returns Los ids sin repetir.
 */
function validarEspecialidades(valor: unknown, errores: string[]): number[] {
  if (!Array.isArray(valor) || valor.length === 0) {
    errores.push("especialidades es obligatorio para un médico (al menos una)");
    return [];
  }
  const ids = valor.map(Number);
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    errores.push("especialidades debe contener ids enteros positivos");
    return [];
  }
  // Un Set descarta los repetidos: [1, 1, 2] → [1, 2].
  return [...new Set(ids)];
}

/**
 * Valida el cuerpo del alta (`POST /usuarios`) o de la edición
 * (`PUT /usuarios/:id`) de un usuario.
 *
 * En la edición se acepta cualquier rol (incluido paciente), porque la
 * consigna pide "edición de cualquier tipo de usuario". Que el rol coincida
 * con el que el usuario ya tiene lo controla el service, que es el que lee la
 * fila.
 *
 * @param cuerpo `req.body`, sin verificar.
 * @param esAlta `true` para el alta (contraseña obligatoria, sin pacientes).
 * @returns Los datos listos para el service, con sede/cobertura/especialidades
 *   ya ajustados al rol (`null`/vacío donde no corresponden).
 * @throws `ErrorHttp` 400 con todos los errores encontrados.
 */
export function validarUsuarioAdmin(cuerpo: unknown, esAlta: boolean): DatosUsuarioAdmin {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  const personales = validarDatosPersonales(datos, errores);
  const rol = validarRol(datos.rol, esAlta ? ROLES_ALTA : ROLES, errores);
  const password = validarPassword(datos.password, errores, esAlta);

  // Cada dato dependiente del rol se valida solo si ese rol lo usa, y en los
  // demás casos se fuerza a null/vacío: así un admin nunca queda con sede ni
  // un operador con especialidades por un dato que vino de más.
  const conSede = rol === "operador" || rol === "medico";
  const idSede = conSede ? validarIdCuerpo(datos.id_sede, "id_sede", errores) : null;
  const idCobertura = rol === "paciente" ? validarIdCobertura(datos.id_cobertura, errores) : null;
  const especialidades = rol === "medico" ? validarEspecialidades(datos.especialidades, errores) : [];

  lanzarSiHayErrores(errores);

  return {
    ...personales,
    rol: rol as Rol,
    password,
    id_sede: idSede,
    id_cobertura: idCobertura,
    especialidades,
  };
}

/**
 * Valida filtros y paginación de `GET /usuarios`.
 *
 * Los cuatro filtros que pide la consigna (nombre, apellido, tipo de usuario y
 * sede) son opcionales y se combinan con AND.
 *
 * @param query `req.query` de Express.
 * @returns Los filtros presentes y la página pedida.
 * @throws `ErrorHttp` 400 si algún filtro vino mal formado.
 */
export function validarFiltrosUsuarios(
  query: unknown,
): { filtros: FiltrosUsuarios; paginacion: Paginacion } {
  const datos = comoObjeto(query);
  const errores: string[] = [];
  const filtros: FiltrosUsuarios = {};

  const nombre = textoLimpio(datos.nombre);
  if (nombre) filtros.nombre = nombre.slice(0, 30);

  const apellido = textoLimpio(datos.apellido);
  if (apellido) filtros.apellido = apellido.slice(0, 30);

  if (datos.rol !== undefined && datos.rol !== "") {
    filtros.rol = validarRol(datos.rol, ROLES, errores);
  }

  filtros.id_sede = validarIdOpcional(datos.id_sede, "id_sede", errores);

  const paginacion = validarPaginacion(datos, errores);

  lanzarSiHayErrores(errores);
  return { filtros, paginacion };
}
