/**
 * VALIDACIONES COMPARTIDAS
 * ========================
 *
 * Helpers que usan todos los validadores del proyecto. Existen para no repetir
 * la misma expresión regular ni la misma comprobación de fecha en cinco
 * archivos: si mañana hay que ajustar el formato de hora, se toca acá y vale
 * para todos.
 *
 * Convención de los validadores del proyecto: acumulan los errores en un array
 * y al final llaman a `lanzarSiHayErrores`, para que el cliente reciba TODOS
 * los problemas en un solo 400 y no los descubra de a uno.
 */

import { ErrorHttp } from "../utils/errorHttp";

/** Solo dígitos del 0 al 9, al menos uno. */
export const SOLO_DIGITOS = /^\d+$/;

/** Formato de fecha que espera una columna `date` de MySQL: YYYY-MM-DD. */
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Hora en formato HH:MM de 24 horas, con dos dígitos en cada parte.
 * Acepta de 00:00 a 23:59; el regex ya descarta 25:00 o 12:75.
 */
const HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Normaliza un valor de entrada a texto sin espacios sobrantes.
 *
 * Devuelve cadena vacía si no es un string, así un `null`, un número o un
 * objeto se tratan igual que un campo faltante.
 *
 * @param valor Valor crudo del body, de tipo desconocido.
 * @returns El texto recortado, o "" si no era un string.
 */
export function textoLimpio(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Verifica que un texto sea una fecha REAL con formato YYYY-MM-DD.
 *
 * El regex solo controla la forma: "2024-02-31" lo pasaría aunque febrero no
 * tenga 31 días. Por eso además se construye la fecha y se comprueba que los
 * tres componentes hayan sobrevivido: JavaScript "acomoda" los valores
 * inválidos (el 31 de febrero pasa a ser el 2 o 3 de marzo), así que si lo que
 * sale no coincide con lo que entró, la fecha no existía.
 *
 * Se usa `Date.UTC` para que el resultado no dependa de la zona horaria de la
 * máquina donde corre el servidor.
 *
 * @param valor Texto a validar.
 * @returns `true` si es una fecha existente y bien formateada.
 */
export function esFechaValida(valor: string): boolean {
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
 * Verifica que un texto sea una hora válida en formato HH:MM.
 *
 * @param valor Texto a validar (ej. "15:00").
 * @returns `true` si es una hora existente entre 00:00 y 23:59.
 */
export function esHoraValida(valor: string): boolean {
  return HORA_HHMM.test(valor);
}

/**
 * Valida el `:id` que viene en la URL de un PUT o un DELETE.
 *
 * Todo lo que llega por la ruta es texto, así que `/sedes/abc` entregaría un
 * `NaN` que terminaría en una query sin sentido. Acá se corta antes.
 *
 * El parámetro se recibe como `unknown` y no como `string` porque Express 5
 * tipa `req.params.id` como `string | string[]`: su enrutador admite
 * parámetros repetidos, que devolverían un array. Un array no es un id válido,
 * así que se rechaza igual que cualquier otro valor mal formado.
 *
 * @param valor El parámetro tal como lo entrega Express (`req.params.id`).
 * @returns El id convertido a número.
 * @throws `ErrorHttp` 400 si no es un entero positivo.
 */
export function validarIdRuta(valor: unknown): number {
  const texto = typeof valor === "string" ? valor.trim() : "";
  const id = Number(texto);

  if (texto === "" || !Number.isInteger(id) || id <= 0) {
    throw new ErrorHttp(400, "El id de la ruta debe ser un número entero positivo");
  }
  return id;
}

/**
 * Valida un id que viene dentro del cuerpo de la petición.
 *
 * A diferencia de `validarIdRuta`, no lanza: acumula el error en el array del
 * validador que la llama, para poder devolver todos los problemas juntos.
 *
 * @param valor Valor crudo recibido.
 * @param nombreCampo Nombre del campo, para el mensaje de error.
 * @param errores Array donde se acumulan los errores encontrados.
 * @returns El id convertido, o `NaN` si era inválido (el error ya quedó
 *   registrado en `errores`, así que el validador no va a seguir adelante).
 */
export function validarIdCuerpo(
  valor: unknown,
  nombreCampo: string,
  errores: string[],
): number {
  if (valor === undefined || valor === null || valor === "") {
    errores.push(`${nombreCampo} es obligatorio`);
    return NaN;
  }

  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    errores.push(`${nombreCampo} debe ser un número entero positivo`);
    return NaN;
  }

  return id;
}

/**
 * Valida un campo de texto obligatorio con un largo máximo.
 *
 * El máximo replica el de la columna en `docs/clinica_ampliada.sql`: si se deja
 * pasar, MySQL rechaza el INSERT o trunca el dato en silencio.
 *
 * @param valor Valor crudo recibido.
 * @param nombreCampo Nombre del campo, para el mensaje de error.
 * @param maximo Largo máximo permitido, según la columna.
 * @param errores Array donde se acumulan los errores encontrados.
 * @returns El texto ya recortado.
 */
export function validarTextoObligatorio(
  valor: unknown,
  nombreCampo: string,
  maximo: number,
  errores: string[],
): string {
  const texto = textoLimpio(valor);

  if (!texto) {
    errores.push(`${nombreCampo} es obligatorio`);
  } else if (texto.length > maximo) {
    errores.push(`${nombreCampo} no puede superar ${maximo} caracteres`);
  }

  return texto;
}

/**
 * Valida un campo de texto OPCIONAL con un largo máximo.
 *
 * La diferencia con `validarTextoObligatorio` es qué significa que falte: acá
 * un campo ausente o vacío es válido y se traduce a `undefined`, para que el
 * service lo mande como `NULL` a una columna que lo admite.
 *
 * @param valor Valor crudo recibido.
 * @param nombreCampo Nombre del campo, para el mensaje de error.
 * @param maximo Largo máximo permitido, según la columna.
 * @param errores Array donde se acumulan los errores encontrados.
 * @returns El texto recortado, o `undefined` si no vino.
 */
export function validarTextoOpcional(
  valor: unknown,
  nombreCampo: string,
  maximo: number,
  errores: string[],
): string | undefined {
  if (valor === undefined || valor === null || valor === "") return undefined;

  const texto = textoLimpio(valor);

  if (!texto) return undefined;

  if (texto.length > maximo) {
    errores.push(`${nombreCampo} no puede superar ${maximo} caracteres`);
  }

  return texto;
}

/**
 * Comprueba que el cuerpo recibido sea un objeto antes de leerle propiedades.
 *
 * Cubre el body ausente y los JSON que son un número, un texto o `null`.
 *
 * @param cuerpo `req.body`, sin verificar.
 * @returns El cuerpo como diccionario de claves desconocidas.
 * @throws `ErrorHttp` 400 si no es un objeto.
 */
export function comoObjeto(cuerpo: unknown): Record<string, unknown> {
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) {
    throw new ErrorHttp(400, "El cuerpo de la petición debe ser un objeto JSON");
  }
  return cuerpo as Record<string, unknown>;
}

/**
 * Cierra un validador: si se acumuló algún error, los lanza todos juntos.
 *
 * @param errores Errores acumulados durante la validación.
 * @throws `ErrorHttp` 400 con los mensajes separados por "; ".
 */
export function lanzarSiHayErrores(errores: string[]): void {
  if (errores.length > 0) {
    throw new ErrorHttp(400, errores.join("; "));
  }
}
