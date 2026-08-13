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
 * Validar acá convierte eso en un 400 con un mensaje entendible.
 *
 * CRITERIO DE ERRORES: se juntan TODOS los problemas y se devuelven en un solo
 * 400, en vez de cortar en el primero. Así quien consume la API los corrige de
 * una vez y no descubre uno nuevo en cada intento.
 */

import { DatosLogin, DatosRegistro } from "../types";
import { ErrorHttp } from "../utils/errorHttp";

/** Formato mínimo de email: algo + @ + algo + punto + algo, sin espacios. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Solo dígitos del 0 al 9, al menos uno. Para DNI y teléfono. */
const SOLO_DIGITOS = /^\d+$/;

/** Formato de fecha que espera una columna `date` de MySQL: YYYY-MM-DD. */
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Verifica que un texto sea una fecha REAL con formato YYYY-MM-DD.
 *
 * El regex solo controla la forma: "2024-02-31" lo pasaría sin problema aunque
 * febrero no tenga 31 días. Por eso además se construye la fecha y se comprueba
 * que los tres componentes hayan sobrevivido: JavaScript "acomoda" los valores
 * inválidos (el 31 de febrero se convierte en el 2 o 3 de marzo), así que si lo
 * que sale no coincide con lo que entró, la fecha no existía.
 *
 * Se usa `Date.UTC` y no `new Date(a, m, d)` para que el resultado no dependa de
 * la zona horaria de la máquina donde corre el servidor.
 *
 * @param valor Texto a validar.
 * @returns `true` si es una fecha existente y bien formateada.
 */
function esFechaValida(valor: string): boolean {
  if (!FECHA_ISO.test(valor)) return false;

  const [anio, mes, dia] = valor.split("-").map(Number);
  // Los meses en JavaScript van de 0 (enero) a 11 (diciembre): de ahí el -1.
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/**
 * Normaliza un valor de entrada a texto sin espacios sobrantes.
 *
 * Devuelve cadena vacía si no es un string: así un `null`, un número o un
 * objeto se tratan igual que un campo faltante, y alcanza con comprobar `if
 * (!valor)` en cada validación.
 *
 * @param valor Valor crudo del body, de tipo desconocido.
 * @returns El texto recortado, o "" si no era un string.
 */
function textoLimpio(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Valida y normaliza el cuerpo de `POST /auth/registro`.
 *
 * @param cuerpo `req.body`, sin verificar. Tipado como `unknown` porque un
 *   cliente puede mandar literalmente cualquier cosa.
 * @returns Los datos ya validados, recortados y con el email en minúsculas.
 * @throws `ErrorHttp` 400 con todos los errores encontrados, separados por "; ".
 */
export function validarRegistro(cuerpo: unknown): DatosRegistro {
  // Cubre los casos de body ausente, o de un JSON que es un número o un array.
  if (typeof cuerpo !== "object" || cuerpo === null) {
    throw new ErrorHttp(400, "El cuerpo de la petición debe ser un objeto JSON");
  }

  // `Record<string, unknown>` = objeto con claves de texto y valores por
  // conocer. Permite leer propiedades sin que TypeScript asuma que existen.
  const datos = cuerpo as Record<string, unknown>;
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

  if (errores.length > 0) {
    throw new ErrorHttp(400, errores.join("; "));
  }

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
  if (typeof cuerpo !== "object" || cuerpo === null) {
    throw new ErrorHttp(400, "El cuerpo de la petición debe ser un objeto JSON");
  }

  const datos = cuerpo as Record<string, unknown>;
  const errores: string[] = [];

  const dni = textoLimpio(datos.dni);
  if (!dni) errores.push("dni es obligatorio");

  const password = typeof datos.password === "string" ? datos.password : "";
  if (!password) errores.push("password es obligatoria");

  if (errores.length > 0) {
    throw new ErrorHttp(400, errores.join("; "));
  }

  return { dni, password };
}
