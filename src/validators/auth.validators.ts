import { DatosLogin, DatosRegistro } from "../types";
import { ErrorHttp } from "../utils/errorHttp";

/**
 * Validaciones de los cuerpos de `/auth/registro` y `/auth/login`.
 *
 * Los límites de longitud replican los de `docs/clinica_ampliada.sql`: si se
 * dejan pasar, MySQL trunca el dato o rechaza el INSERT.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOLO_DIGITOS = /^\d+$/;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Verifica que sea una fecha real y con formato YYYY-MM-DD (columna `date`). */
function esFechaValida(valor: string): boolean {
  if (!FECHA_ISO.test(valor)) return false;

  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

function textoLimpio(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Valida y normaliza el cuerpo del registro. Junta TODOS los errores y los
 * devuelve en un solo 400, en vez de obligar a descubrirlos de a uno.
 */
export function validarRegistro(cuerpo: unknown): DatosRegistro {
  if (typeof cuerpo !== "object" || cuerpo === null) {
    throw new ErrorHttp(400, "El cuerpo de la petición debe ser un objeto JSON");
  }

  const datos = cuerpo as Record<string, unknown>;
  const errores: string[] = [];

  const nombre = textoLimpio(datos.nombre);
  if (!nombre) errores.push("nombre es obligatorio");
  else if (nombre.length > 30) errores.push("nombre no puede superar 30 caracteres");

  const apellido = textoLimpio(datos.apellido);
  if (!apellido) errores.push("apellido es obligatorio");
  else if (apellido.length > 30)
    errores.push("apellido no puede superar 30 caracteres");

  const dni = textoLimpio(datos.dni);
  if (!dni) errores.push("dni es obligatorio");
  else if (!SOLO_DIGITOS.test(dni)) errores.push("dni debe contener solo números");
  else if (dni.length < 7 || dni.length > 8)
    errores.push("dni debe tener entre 7 y 8 dígitos");

  const email = textoLimpio(datos.email).toLowerCase();
  if (!email) errores.push("email es obligatorio");
  else if (!EMAIL_REGEX.test(email)) errores.push("email no tiene un formato válido");
  else if (email.length > 30) errores.push("email no puede superar 30 caracteres");

  // La columna `telefono` es NOT NULL y no tiene default: sin este campo el
  // INSERT falla. Ver CLAUDE.md, sección 7, gotcha 1.
  const telefono = textoLimpio(datos.telefono);
  if (!telefono) errores.push("telefono es obligatorio");
  else if (!SOLO_DIGITOS.test(telefono))
    errores.push("telefono debe contener solo números");
  else if (telefono.length > 10)
    errores.push("telefono no puede superar 10 dígitos");

  const password = typeof datos.password === "string" ? datos.password : "";
  if (!password) errores.push("password es obligatoria");
  else if (password.length < 6)
    errores.push("password debe tener al menos 6 caracteres");
  else if (Buffer.byteLength(password, "utf8") > 72)
    errores.push("password no puede superar los 72 bytes (límite de bcrypt)");

  const fechaNacimiento = textoLimpio(datos.fecha_nacimiento);
  if (!fechaNacimiento) errores.push("fecha_nacimiento es obligatoria");
  else if (!esFechaValida(fechaNacimiento))
    errores.push("fecha_nacimiento debe tener formato YYYY-MM-DD y ser una fecha real");
  else if (fechaNacimiento > new Date().toISOString().slice(0, 10))
    errores.push("fecha_nacimiento no puede ser futura");

  const idCobertura = Number(datos.id_cobertura);
  if (datos.id_cobertura === undefined || datos.id_cobertura === null || datos.id_cobertura === "")
    errores.push("id_cobertura es obligatoria");
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
