/**
 * VALIDADORES DE AUTENTICACIÓN Y DATOS PERSONALES
 * ===============================================
 *
 * Primera línea de defensa: comprueban que lo que mandó el cliente sea usable
 * ANTES de que llegue a la base. Nada de lo que sale de acá se vuelve a
 * validar más adelante; por eso los services pueden confiar en sus datos.
 *
 * Los validadores hacen tres cosas:
 *
 *   1. **Verifican** que los campos estén y tengan sentido.
 *   2. **Normalizan** (recortan espacios, pasan el email a minúsculas).
 *   3. **Tipan**: devuelven un `DatosRegistro`/`DatosLogin`, así que a partir
 *      de ahí TypeScript sabe que los campos existen y son strings.
 *
 * Quién usa este archivo:
 *   - `auth.controller.ts`: registro público y login.
 *   - `paciente.controller.ts`: alta de pacientes por el operador (mismo
 *     validador que el registro, como pide la consigna final) y "mis datos".
 *   - `usuario.validators.ts`: alta y edición de usuarios por el admin, que
 *     reutiliza las validaciones campo por campo exportadas acá abajo.
 *
 * POR QUÉ IMPORTAN LOS LARGOS: los límites replican los de
 * `docs/clinica_ampliada.sql`. Si se dejan pasar, MySQL rechaza el INSERT (y se
 * ve un 500 feo) o, peor, trunca el dato en silencio y queda mal guardado.
 *
 * Los helpers genéricos (recorte de texto, validación de fecha, cierre con
 * error 400) viven en `comunes.ts` y los comparten todos los validadores.
 */

import { DatosLogin, DatosRegistro } from "../types";
import { fechaHoy } from "../utils/fechas";
import {
  comoObjeto,
  esFechaValida,
  lanzarSiHayErrores,
  SOLO_DIGITOS,
  textoLimpio,
} from "./comunes";

/** Formato mínimo de email: algo + @ + algo + punto + algo, sin espacios. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Datos personales comunes a todos los usuarios, ya validados. */
export interface DatosPersonales {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  fecha_nacimiento: string;
}

/**
 * Valida y normaliza el email.
 *
 * Se pasa a minúsculas para que "Juan@Mail.com" y "juan@mail.com" cuenten
 * como el mismo email y la validación de duplicados no se pueda esquivar
 * cambiando mayúsculas.
 *
 * @param valor Valor crudo recibido.
 * @param errores Array donde se acumulan los errores.
 * @returns El email en minúsculas y sin espacios.
 */
export function validarEmail(valor: unknown, errores: string[]): string {
  const email = textoLimpio(valor).toLowerCase();
  if (!email) errores.push("email es obligatorio");
  else if (!EMAIL_REGEX.test(email)) errores.push("email no tiene un formato válido");
  else if (email.length > 30) errores.push("email no puede superar 30 caracteres");
  return email;
}

/**
 * Valida el teléfono.
 *
 * La columna `telefono` es NOT NULL y no tiene valor por defecto: sin este
 * campo, el INSERT falla con "Error 1364: Field 'telefono' doesn't have a
 * default value". Por eso se pide como obligatorio aunque la consigna de la
 * semana 1 no lo liste. Ver CLAUDE.md, sección 7, gotcha 1.
 *
 * @param valor Valor crudo recibido.
 * @param errores Array donde se acumulan los errores.
 * @returns El teléfono recortado.
 */
export function validarTelefono(valor: unknown, errores: string[]): string {
  const telefono = textoLimpio(valor);
  if (!telefono) errores.push("telefono es obligatorio");
  else if (!SOLO_DIGITOS.test(telefono)) errores.push("telefono debe contener solo números");
  else if (telefono.length > 10) errores.push("telefono no puede superar 10 dígitos");
  return telefono;
}

/**
 * Valida una contraseña.
 *
 * NO se recorta con trim: los espacios son caracteres válidos y sacarlos
 * cambiaría silenciosamente lo que el usuario eligió.
 *
 * bcrypt ignora todo lo que pase de 72 bytes. Sin ese tope, dos contraseñas
 * larguísimas que compartan los primeros 72 bytes servirían las dos para
 * entrar. Se miden BYTES y no caracteres porque una tilde o una eñe ocupan dos.
 *
 * @param valor Valor crudo recibido.
 * @param errores Array donde se acumulan los errores.
 * @param obligatoria `false` en las ediciones: si no viene, se conserva la
 *   contraseña actual.
 * @returns La contraseña, o `undefined` si era opcional y no vino.
 */
export function validarPassword(
  valor: unknown,
  errores: string[],
  obligatoria: boolean,
): string | undefined {
  const password = typeof valor === "string" ? valor : "";
  if (!password) {
    if (obligatoria) errores.push("password es obligatoria");
    return undefined;
  }
  if (password.length < 6) errores.push("password debe tener al menos 6 caracteres");
  else if (Buffer.byteLength(password, "utf8") > 72)
    errores.push("password no puede superar los 72 bytes (límite de bcrypt)");
  return password;
}

/**
 * Valida un `id_cobertura` obligatorio.
 *
 * `Number.isInteger` descarta decimales y también el NaN que devuelve
 * `Number("abc")`. Que la cobertura EXISTA se comprueba después, en el
 * service, porque eso requiere consultar la base.
 *
 * @param valor Valor crudo recibido.
 * @param errores Array donde se acumulan los errores.
 * @returns El id convertido a número.
 */
export function validarIdCobertura(valor: unknown, errores: string[]): number {
  const idCobertura = Number(valor);
  if (valor === undefined || valor === null || valor === "")
    errores.push("id_cobertura es obligatoria");
  else if (!Number.isInteger(idCobertura) || idCobertura <= 0)
    errores.push("id_cobertura debe ser un número entero positivo");
  return idCobertura;
}

/**
 * Valida los datos personales que comparten todos los usuarios: nombre,
 * apellido, DNI, email, teléfono y fecha de nacimiento.
 *
 * Existe para que el registro público, el alta de pacientes del operador y el
 * alta/edición de usuarios del admin apliquen exactamente las mismas reglas:
 * un DNI de 6 dígitos no puede ser inválido en una pantalla y válido en otra.
 *
 * @param datos Cuerpo de la petición, ya verificado como objeto.
 * @param errores Array donde se acumulan los errores.
 * @returns Los datos recortados y normalizados.
 */
export function validarDatosPersonales(
  datos: Record<string, unknown>,
  errores: string[],
): DatosPersonales {
  const nombre = textoLimpio(datos.nombre);
  if (!nombre) errores.push("nombre es obligatorio");
  else if (nombre.length > 30) errores.push("nombre no puede superar 30 caracteres");

  const apellido = textoLimpio(datos.apellido);
  if (!apellido) errores.push("apellido es obligatorio");
  else if (apellido.length > 30) errores.push("apellido no puede superar 30 caracteres");

  // La columna es varchar(8). Se piden 7 u 8 dígitos: los DNI argentinos
  // vigentes tienen 8, y 7 cubre los documentos más viejos.
  const dni = textoLimpio(datos.dni);
  if (!dni) errores.push("dni es obligatorio");
  else if (!SOLO_DIGITOS.test(dni)) errores.push("dni debe contener solo números");
  else if (dni.length < 7 || dni.length > 8) errores.push("dni debe tener entre 7 y 8 dígitos");

  const email = validarEmail(datos.email, errores);
  const telefono = validarTelefono(datos.telefono, errores);

  const fechaNacimiento = textoLimpio(datos.fecha_nacimiento);
  if (!fechaNacimiento) errores.push("fecha_nacimiento es obligatoria");
  else if (!esFechaValida(fechaNacimiento))
    errores.push("fecha_nacimiento debe tener formato YYYY-MM-DD y ser una fecha real");
  // Comparación de strings en formato YYYY-MM-DD: al tener todos el mismo
  // largo y ordenarse de mayor a menor unidad, el orden alfabético coincide
  // con el cronológico y no hace falta convertir a Date. Se usa la fecha
  // LOCAL (`fechaHoy`) y no `toISOString()`, que es UTC y de noche ya da el
  // día siguiente.
  else if (fechaNacimiento > fechaHoy()) errores.push("fecha_nacimiento no puede ser futura");

  return { nombre, apellido, dni, email, telefono, fecha_nacimiento: fechaNacimiento };
}

/**
 * Valida y normaliza el cuerpo de `POST /auth/registro` (y de
 * `POST /pacientes`, el alta de pacientes del operador, que usa los mismos
 * datos y validaciones).
 *
 * @param cuerpo `req.body`, sin verificar. Tipado como `unknown` porque un
 *   cliente puede mandar literalmente cualquier cosa.
 * @returns Los datos ya validados, recortados y con el email en minúsculas.
 * @throws `ErrorHttp` 400 con todos los errores encontrados, separados por "; ".
 */
export function validarRegistro(cuerpo: unknown): DatosRegistro {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  const personales = validarDatosPersonales(datos, errores);
  const password = validarPassword(datos.password, errores, true);
  const idCobertura = validarIdCobertura(datos.id_cobertura, errores);

  lanzarSiHayErrores(errores);

  return {
    ...personales,
    // `lanzarSiHayErrores` ya cortó si faltaba: acá siempre hay contraseña.
    password: password as string,
    id_cobertura: idCobertura,
  };
}

/**
 * Valida el cuerpo de `POST /auth/login`.
 *
 * Se controla solo que los campos estén presentes, NO su formato. Es
 * deliberado: si el login rechazara un DNI de 5 dígitos con "el dni debe tener
 * entre 7 y 8", le estaría contando a un atacante cómo son los DNI válidos. Con
 * credenciales incorrectas siempre se responde el mismo 401 genérico.
 *
 * @param cuerpo `req.body`, sin verificar.
 * @returns DNI y contraseña listos para el service.
 * @throws `ErrorHttp` 400 si falta alguno de los dos campos.
 */
export function validarLogin(cuerpo: unknown): DatosLogin {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  const dni = textoLimpio(datos.dni);
  if (!dni) errores.push("dni es obligatorio");

  const password = typeof datos.password === "string" ? datos.password : "";
  if (!password) errores.push("password es obligatoria");

  lanzarSiHayErrores(errores);
  return { dni, password };
}
