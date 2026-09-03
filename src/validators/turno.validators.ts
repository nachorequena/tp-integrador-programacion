/**
 * VALIDADORES DE TURNO
 * ====================
 *
 * Valida el cuerpo del alta de turno y la fecha de los listados.
 *
 * Como en el resto del proyecto, acá solo se controla la FORMA de los datos.
 * Las reglas que necesitan consultar la base —que el horario caiga dentro de
 * un rango de la agenda del médico, que no haya otro turno confirmado a esa
 * misma hora, de qué cobertura es el paciente— viven en `turno.service.ts`.
 *
 * Sin este archivo, `req.body` llegaba crudo al service: un `id_medico`
 * faltante se convertía en `undefined` dentro de una query parametrizada y
 * mysql2 cortaba con "Bind parameters must not contain undefined", que el
 * manejador de errores traduce a un 500. El criterio de aceptación de la
 * semana pide justo lo contrario: error controlado con el código adecuado.
 */

import { DatosNuevoTurno } from "../types";
import {
  comoObjeto,
  esFechaValida,
  esHoraValida,
  lanzarSiHayErrores,
  textoLimpio,
  validarIdCuerpo,
} from "./comunes";

/**
 * Largo de `turno.nota` en `docs/clinica_ampliada.sql`.
 *
 * La columna es `varchar(40)`, bastante corta. Sin este control, una nota más
 * larga hace fallar el INSERT con el error 1406 de MySQL ("Data too long") y
 * termina en un 500.
 */
const MAXIMO_NOTA = 40;

/**
 * Valida el cuerpo de `POST /turnos`.
 *
 * `id_cobertura` no se lee del cuerpo a propósito, ni siquiera para ignorarlo:
 * la consigna exige que la cobertura salga de la registrada por el paciente y
 * que no pueda pisarse desde este endpoint. Al no estar en `DatosNuevoTurno`,
 * el service no tiene forma de tomarla de acá.
 *
 * @param cuerpo `req.body`, sin verificar.
 * @returns Los datos del turno, listos para el service.
 * @throws `ErrorHttp` 400 con todos los errores encontrados, juntos.
 */
export function validarNuevoTurno(cuerpo: unknown): DatosNuevoTurno {
  const datos = comoObjeto(cuerpo);
  const errores: string[] = [];

  const idEspecialidad = validarIdCuerpo(
    datos.id_especialidad,
    "id_especialidad",
    errores,
  );
  const idSede = validarIdCuerpo(datos.id_sede, "id_sede", errores);
  const idMedico = validarIdCuerpo(datos.id_medico, "id_medico", errores);

  const fecha = textoLimpio(datos.fecha);
  if (!fecha) errores.push("fecha es obligatoria");
  else if (!esFechaValida(fecha))
    errores.push("fecha debe tener formato YYYY-MM-DD y ser una fecha real");

  // El formato importa más de lo que parece: la agenda guarda las horas como
  // varchar(5) y el service las compara como texto. Esa comparación solo
  // coincide con el orden cronológico si la hora viene con dos dígitos. Un
  // "9:00" sin cero delante daría mayor que "12:00" y el turno se rechazaría
  // por "horario no disponible" aunque el médico estuviera atendiendo.
  const hora = textoLimpio(datos.hora);
  if (!hora) errores.push("hora es obligatoria");
  else if (!esHoraValida(hora))
    errores.push("hora debe tener formato HH:MM (entre 00:00 y 23:59)");

  // La consigna la marca explícitamente como obligatoria.
  const nota = textoLimpio(datos.nota);
  if (!nota) errores.push("nota es obligatoria");
  else if (nota.length > MAXIMO_NOTA)
    errores.push(`nota no puede superar ${MAXIMO_NOTA} caracteres`);

  // Opcional acá porque solo lo manda el operador. Que sea obligatorio para
  // ese rol se decide en el controller, que es quien conoce quién pide.
  let idPaciente: number | undefined;
  if (datos.id_paciente !== undefined && datos.id_paciente !== null) {
    idPaciente = validarIdCuerpo(datos.id_paciente, "id_paciente", errores);
  }

  lanzarSiHayErrores(errores);

  return {
    id_especialidad: idEspecialidad,
    id_sede: idSede,
    id_medico: idMedico,
    fecha,
    hora,
    nota,
    id_paciente: idPaciente,
  };
}

/**
 * Valida la `fecha` obligatoria de los listados por día.
 *
 * La usan `GET /turnos/medico` y `GET /turnos/sede`, que la consigna define
 * como "turnos ... para una fecha determinada".
 *
 * @param query `req.query` de Express.
 * @returns La fecha ya validada, en formato YYYY-MM-DD.
 * @throws `ErrorHttp` 400 si falta o no es una fecha real.
 */
export function validarFechaObligatoria(query: unknown): string {
  const datos = comoObjeto(query);
  const errores: string[] = [];

  const fecha = textoLimpio(datos.fecha);
  if (!fecha) errores.push("fecha es obligatoria");
  else if (!esFechaValida(fecha))
    errores.push("fecha debe tener formato YYYY-MM-DD y ser una fecha real");

  lanzarSiHayErrores(errores);

  return fecha;
}
