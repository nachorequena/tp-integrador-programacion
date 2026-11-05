/**
 * UTILIDADES DE FECHA Y HORA
 * ==========================
 *
 * Helpers para trabajar con el "ahora" de la clínica en los mismos formatos
 * que guarda la base: fechas "YYYY-MM-DD" y horas "HH:MM" (las columnas de
 * hora de `agenda` y `turno` son `varchar(5)`, no `time`).
 *
 * Los usan la consulta de disponibilidad (`disponibilidad.service.ts`), que no
 * debe ofrecer horarios que ya pasaron, y el alta de turno
 * (`turno.service.ts`), que no debe aceptarlos.
 *
 * POR QUÉ NO `toISOString()`: devuelve la hora en UTC. En Argentina (UTC-3),
 * a las 22:00 del 10 de marzo ya sería "2026-03-11" en UTC, y el sistema
 * creería que el día de hoy ya terminó. Se arma el texto con los getters
 * locales (`getFullYear`, `getHours`…), que respetan la zona del servidor,
 * que es la misma que la de la clínica.
 */

/** Completa con un cero adelante: 7 → "07". */
function dosDigitos(numero: number): string {
  return String(numero).padStart(2, "0");
}

/**
 * Fecha de hoy en la zona horaria del servidor.
 *
 * @returns La fecha en formato "YYYY-MM-DD".
 */
export function fechaHoy(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
}

/**
 * Hora actual en la zona horaria del servidor.
 *
 * @returns La hora en formato "HH:MM".
 */
export function horaActual(): string {
  const ahora = new Date();
  return `${dosDigitos(ahora.getHours())}:${dosDigitos(ahora.getMinutes())}`;
}

/**
 * Convierte una hora "HH:MM" en minutos desde la medianoche.
 *
 * Trabajar en minutos permite sumar la duración de un turno o calcular
 * diferencias con aritmética común, cosa que con el texto no se puede.
 *
 * @param hora Hora en formato "HH:MM" (ya validada).
 * @returns Minutos desde las 00:00 (ej. "08:30" → 510).
 */
export function aMinutos(hora: string): number {
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

/**
 * Convierte minutos desde la medianoche en una hora "HH:MM".
 *
 * @param minutos Minutos desde las 00:00 (ej. 510).
 * @returns La hora con dos dígitos por parte (ej. "08:30").
 */
export function aHora(minutos: number): string {
  return `${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;
}

/**
 * Pasa una fecha de la base al formato que se muestra al usuario.
 *
 * Se usa en el texto de las notificaciones: la consigna pide fechas en
 * formato local (día/mes/año) y el mensaje llega al frontend ya armado.
 *
 * @param fecha Fecha "YYYY-MM-DD".
 * @returns La fecha "DD/MM/YYYY".
 */
export function aFechaLocal(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * Indica si un momento (fecha + hora) ya pasó.
 *
 * Compara como texto "YYYY-MM-DD HH:MM": al tener todas las partes largo fijo
 * y de mayor a menor unidad, el orden alfabético es el cronológico.
 *
 * @param fecha Fecha "YYYY-MM-DD".
 * @param hora Hora "HH:MM".
 * @returns `true` si ese momento es anterior o igual a ahora.
 */
export function yaPaso(fecha: string, hora: string): boolean {
  return `${fecha} ${hora}` <= `${fechaHoy()} ${horaActual()}`;
}
