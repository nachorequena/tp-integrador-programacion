/**
 * VALIDADORES DE AGENDA
 * =====================
 *
 * Valida el cuerpo del alta/modificación de una agenda y los filtros del
 * listado.
 *
 * Acá solo se controla la FORMA de los datos (que las horas sean horas, que la
 * fecha exista, que los ids sean enteros). Las reglas que necesitan consultar
 * la base —que el médico exista y sea médico, que la sede exista, que el rango
 * no se solape con otro— viven en `agenda.service.ts`, porque un validador no
 * debería hacer queries.
 */

import { DatosAgenda, FiltrosAgenda } from "../types";
import {
  comoObjeto,
  esFechaValida,
  esHoraValida,
  lanzarSiHayErrores,
  textoLimpio,
  validarIdCuerpo,
} from "./comunes";

/**
 * Valida el cuerpo del alta o la modificación de una agenda.
 *
 * @param cuerpo `req.body`, sin verificar.
 * @returns Los datos de la agenda, listos para el service.
 * @throws `ErrorHttp` 400 con todos los errores encontrados.
 */
export function validarAgenda(cuerpo: unknown): DatosAgenda {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  // Las columnas son varchar(5), no `time`: se guardan como texto "HH:MM".
  const horaEntrada = textoLimpio(datos.hora_entrada);
  if (!horaEntrada) errores.push("hora_entrada es obligatoria");
  else if (!esHoraValida(horaEntrada))
    errores.push("hora_entrada debe tener formato HH:MM (entre 00:00 y 23:59)");

  const horaSalida = textoLimpio(datos.hora_salida);
  if (!horaSalida) errores.push("hora_salida es obligatoria");
  else if (!esHoraValida(horaSalida))
    errores.push("hora_salida debe tener formato HH:MM (entre 00:00 y 23:59)");

  // Comparación de textos "HH:MM": al tener siempre el mismo largo y dos
  // dígitos por parte, el orden alfabético coincide con el cronológico
  // ("09:00" < "15:30"). Solo se compara si las dos horas son válidas, para no
  // agregar un error confuso encima de otro que ya se reportó.
  if (
    horaEntrada &&
    horaSalida &&
    esHoraValida(horaEntrada) &&
    esHoraValida(horaSalida) &&
    horaEntrada >= horaSalida
  ) {
    errores.push("hora_entrada debe ser anterior a hora_salida");
  }

  const fecha = textoLimpio(datos.fecha);
  if (!fecha) errores.push("fecha es obligatoria");
  else if (!esFechaValida(fecha))
    errores.push("fecha debe tener formato YYYY-MM-DD y ser una fecha real");

  // No se restringe que la fecha sea futura: la consigna no lo pide y hay que
  // poder corregir agendas ya pasadas.
  const idMedico = validarIdCuerpo(datos.id_medico, "id_medico", errores);
  const idEspecialidad = validarIdCuerpo(
    datos.id_especialidad,
    "id_especialidad",
    errores,
  );
  const idSede = validarIdCuerpo(datos.id_sede, "id_sede", errores);

  lanzarSiHayErrores(errores);

  return {
    hora_entrada: horaEntrada,
    hora_salida: horaSalida,
    fecha,
    id_medico: idMedico,
    id_especialidad: idEspecialidad,
    id_sede: idSede,
  };
}

/**
 * Valida los filtros del listado (`GET /agendas?id_medico=&id_sede=&fecha=`).
 *
 * Los tres son opcionales y se combinan entre sí. Un filtro ausente no se
 * incluye en el resultado, así el service sabe que no tiene que agregar esa
 * condición al WHERE.
 *
 * Se validan igual que el resto: un `?id_sede=abc` tiene que dar un 400 claro y
 * no un listado vacío inexplicable.
 *
 * @param query `req.query` de Express.
 * @returns Solo los filtros que vinieron, ya convertidos.
 * @throws `ErrorHttp` 400 si algún filtro presente tiene formato inválido.
 */
export function validarFiltrosAgenda(query: unknown): FiltrosAgenda {
  const datos = comoObjeto(query);
  const errores: string[] = [];
  const filtros: FiltrosAgenda = {};

  if (datos.id_medico !== undefined && datos.id_medico !== "") {
    const id = Number(datos.id_medico);
    if (!Number.isInteger(id) || id <= 0)
      errores.push("id_medico debe ser un número entero positivo");
    else filtros.id_medico = id;
  }

  if (datos.id_sede !== undefined && datos.id_sede !== "") {
    const id = Number(datos.id_sede);
    if (!Number.isInteger(id) || id <= 0)
      errores.push("id_sede debe ser un número entero positivo");
    else filtros.id_sede = id;
  }

  if (datos.fecha !== undefined && datos.fecha !== "") {
    const fecha = textoLimpio(datos.fecha);
    if (!esFechaValida(fecha))
      errores.push("fecha debe tener formato YYYY-MM-DD y ser una fecha real");
    else filtros.fecha = fecha;
  }

  lanzarSiHayErrores(errores);

  return filtros;
}
