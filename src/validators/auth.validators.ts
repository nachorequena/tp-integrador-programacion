/**
 * VALIDADORES DE AUTENTICACIÓN
 * ============================
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
 * POR QUÉ IMPORTAN LOS LARGOS: los límites replican los de
 * `docs/clinica_ampliada.sql`. Si se dejan pasar, MySQL rechaza el INSERT (y se
 * ve un 500 feo) o, peor, trunca el dato en silencio y queda mal guardado.
 *
 * Los helpers genéricos (recorte de texto, validación de fecha, cierre con
 * error 400) viven en `comunes.ts` y los comparten todos los validadores.
 */

import { DatosLogin, DatosRegistro } from "../types";
import {
  comoObjeto,
  esFechaValida,
  lanzarSiHayErrores,
  SOLO_DIGITOS,
  textoLimpio,
} from "./comunes";

/** Formato mínimo de email: algo + @ + algo + punto + algo, sin espacios. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida y normaliza el cuerpo de `POST /auth/registro`.
 *
 * @param cuerpo `req.body`, sin verificar. Tipado como `unknown` porque un
 *   cliente puede mandar literalmente cualquier cosa.
 * @returns Los datos ya validados, recortados y con el email en minúsculas.
 * @throws `ErrorHttp` 400 con todos los errores encontrados, separados por "; ".
 */
export function validarRegistro(cuerpo: unknown): DatosRegistro {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  const nombre = textoLimpio(datos.nombre);
  if (!nombre) errores.push("nombre es obligatorio");
  else if (nombre.length > 30) errores.push("nombre no puede superar 30 caracteres");

  const apellido = textoLimpio(datos.apellido);
  if (!apellido) errores.push("apellido es obligatorio");
  else if (apellido.length > 30)
    errores.push("apellido no puede superar 30 caracteres");

  // La columna es varchar(8). Se piden 7 u 8 dígitos: los DNI argentinos
  // vigentes tienen 8, y 7 cubre los documentos más viejos.
  const dni = textoLimpio(datos.dni);
  if (!dni) errores.push("dni es obligatorio");
  else if (!SOLO_DIGITOS.test(dni)) errores.push("dni debe contener solo números");
  else if (dni.length < 7 || dni.length > 8)
    errores.push("dni debe tener entre 7 y 8 dígitos");

  // Se pasa a minúsculas para que "Juan@Mail.com" y "juan@mail.com" cuenten
  // como el mismo email y la validación de duplicados no se pueda esquivar
  // cambiando mayúsculas.
  const email = textoLimpio(datos.email).toLowerCase();
  if (!email) errores.push("email es obligatorio");
  else if (!EMAIL_REGEX.test(email)) errores.push("email no tiene un formato válido");
  else if (email.length > 30) errores.push("email no puede superar 30 caracteres");

  // La columna `telefono` es NOT NULL y no tiene valor por defecto: sin este
  // campo, el INSERT falla con "Error 1364: Field 'telefono' doesn't have a
  // default value". Por eso se pide como obligatorio aunque la consigna no lo
  // liste. Ver CLAUDE.md, sección 7, gotcha 1.
  const telefono = textoLimpio(datos.telefono);
  if (!telefono) errores.push("telefono es obligatorio");
  else if (!SOLO_DIGITOS.test(telefono))
    errores.push("telefono debe contener solo números");
  else if (telefono.length > 10)
    errores.push("telefono no puede superar 10 dígitos");

  // La contraseña NO se recorta con trim: los espacios son caracteres válidos y
  // sacarlos cambiaría silenciosamente lo que el usuario eligió.
  const password = typeof datos.password === "string" ? datos.password : "";
  if (!password) errores.push("password es obligatoria");
  else if (password.length < 6)
    errores.push("password debe tener al menos 6 caracteres");
  // bcrypt ignora todo lo que pase de 72 bytes. Sin este control, dos
  // contraseñas larguísimas que compartan los primeros 72 bytes servirían las
  // dos para entrar. Se miden BYTES y no caracteres porque una tilde o una
  // eñe ocupan dos.
  else if (Buffer.byteLength(password, "utf8") > 72)
    errores.push("password no puede superar los 72 bytes (límite de bcrypt)");

  const fechaNacimiento = textoLimpio(datos.fecha_nacimiento);
  if (!fechaNacimiento) errores.push("fecha_nacimiento es obligatoria");
  else if (!esFechaValida(fechaNacimiento))
    errores.push("fecha_nacimiento debe tener formato YYYY-MM-DD y ser una fecha real");
  // Comparación de strings en formato YYYY-MM-DD: al tener todos el mismo
  // largo y ordenarse de mayor a menor unidad, el orden alfabético coincide
  // con el cronológico y no hace falta convertir a Date.
  else if (fechaNacimiento > new Date().toISOString().slice(0, 10))
    errores.push("fecha_nacimiento no puede ser futura");

  const idCobertura = Number(datos.id_cobertura);
  if (datos.id_cobertura === undefined || datos.id_cobertura === null || datos.id_cobertura === "")
    errores.push("id_cobertura es obligatoria");
  // `Number.isInteger` descarta decimales y también el NaN que devuelve
  // `Number("abc")`. Que la cobertura EXISTA se comprueba después, en el
  // service, porque eso requiere consultar la base.
  else if (!Number.isInteger(idCobertura) || idCobertura <= 0)
    errores.push("id_cobertura debe ser un número entero positivo");

  lanzarSiHayErrores(errores);

  return {
    nombre,
    apellido,
    dni,
    email,
    password,
    telefono,
    fecha_nacimiento: fechaNacimiento,
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
