/**
 * SERVICE: disponibilidad de turnos
 * =================================
 *
 * Calcula, para un médico, una especialidad y una sede:
 *   - en qué fechas tiene agenda con algún horario libre;
 *   - qué horarios quedan libres en una fecha puntual.
 *
 * Flujo: `GET /disponibilidad/fechas` y `GET /disponibilidad/horarios` →
 * `disponibilidad.routes.ts` → `disponibilidad.controller.ts` → este service
 * → tablas `agenda` y `turno`.
 *
 * Lo usa el frontend en la solicitud de turno (paciente y operador): la
 * consigna exige que "solo se ofrezcan las fechas en que el médico tiene
 * agenda y los horarios que siguen libres". También lo usa
 * `turno.service.ts` (vía `esHorarioDeLaGrilla` y `DURACION_TURNO`), para que
 * el alta acepte exactamente los mismos horarios que se ofrecen.
 *
 * ── Cómo se arman los horarios ───────────────────────────────────────────────
 *
 * La tabla `turno` no tiene duración: un turno es un instante. Para poder
 * ofrecer horarios hace falta una grilla, y la consigna deja que el grupo
 * defina la duración: **30 minutos**. Un rango de agenda 08:00–10:00 ofrece
 * 08:00, 08:30, 09:00 y 09:30 (el de las 10:00 no, porque terminaría después
 * de que el médico se va).
 *
 * Un horario de la grilla está libre si no hay un turno `confirmado` a menos
 * de 30 minutos. Se compara por distancia y no por igualdad: si alguien
 * modificó la hora de entrada de una agenda con turnos ya dados, los turnos
 * viejos pueden quedar "corridos" respecto de la grilla nueva, y comparar por
 * igualdad ofrecería un horario superpuesto.
 *
 * Los turnos cancelados no bloquean nada: cancelar libera el horario.
 */

import { RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { ConsultaDisponibilidad } from "../types";
import { aHora, aMinutos, fechaHoy, yaPaso } from "../utils/fechas";

/**
 * Duración de cada turno, en minutos.
 *
 * Es la única fuente de este número en el backend: la usan la consulta de
 * disponibilidad y la validación del alta de turno, que tienen que coincidir
 * (la consigna lo pide: "debe ser coherente con la validación del alta").
 */
export const DURACION_TURNO = 30;

/** Rango de agenda con lo mínimo que hace falta para armar la grilla. */
interface RangoAgenda {
  id: number;
  fecha: string;
  hora_entrada: string;
  hora_salida: string;
}

/** Un horario libre que se le ofrece al usuario. */
export interface HorarioLibre {
  /** Hora de inicio del turno, "HH:MM". */
  hora: string;
  /** Rango de agenda al que pertenece (informativo para el frontend). */
  id_agenda: number;
}

/**
 * Indica si una hora es un inicio de turno válido dentro de un rango.
 *
 * Tiene que cumplir las tres cosas:
 *   - caer dentro del rango (desde la entrada),
 *   - terminar antes o justo a la hora de salida,
 *   - estar alineada a la grilla de 30 minutos contando desde la entrada.
 *
 * @param rango Hora de entrada y de salida del rango de agenda.
 * @param hora Hora pedida, "HH:MM".
 * @returns `true` si es un horario de la grilla.
 */
export function esHorarioDeLaGrilla(
  rango: { hora_entrada: string; hora_salida: string },
  hora: string,
): boolean {
  // Todo se pasa a minutos desde medianoche para poder sumar y restar:
  // "08:00" → 480, "10:00" → 600.
  const inicio = aMinutos(rango.hora_entrada);
  const fin = aMinutos(rango.hora_salida);
  const pedido = aMinutos(hora);
  // Las tres condiciones unidas con && (tienen que cumplirse TODAS).
  // Ejemplo con rango 08:00–10:00:
  return (
    // 1) no empieza antes de la entrada ("07:30" → false);
    pedido >= inicio &&
    // 2) termina dentro del rango: "09:30" + 30 = 10:00 <= 10:00 → ok;
    //    "10:00" + 30 = 10:30 > 10:00 → false;
    pedido + DURACION_TURNO <= fin &&
    // 3) está en la grilla: los minutos desde la entrada son múltiplo de 30.
    //    `%` es el resto de la división: "08:30" → 30 % 30 = 0 → ok;
    //    "08:10" → 10 % 30 = 10 → false.
    (pedido - inicio) % DURACION_TURNO === 0
  );
}

/**
 * Calcula los horarios libres de un rango de agenda.
 *
 * @param rango Rango de agenda.
 * @param horasOcupadas Horas de los turnos confirmados de ese rango.
 * @returns Los inicios de turno libres y futuros, en orden.
 */
function horariosLibresDelRango(rango: RangoAgenda, horasOcupadas: string[]): HorarioLibre[] {
  // Las horas ocupadas pasadas a minutos (["09:00"] → [540]).
  const ocupados = horasOcupadas.map(aMinutos);
  // Acá se van agregando los horarios que quedan libres.
  const libres: HorarioLibre[] = [];
  const fin = aMinutos(rango.hora_salida);

  // El for recorre la grilla de a 30 minutos:
  //   - arranca en la hora de entrada;
  //   - sigue mientras el turno entero entre antes de la salida;
  //   - en cada vuelta suma 30 minutos.
  // Rango 08:00–10:00 → vueltas en 08:00, 08:30, 09:00 y 09:30.
  for (
    let inicio = aMinutos(rango.hora_entrada);
    inicio + DURACION_TURNO <= fin;
    inicio += DURACION_TURNO
  ) {
    // Vuelve a texto: 510 → "08:30".
    const hora = aHora(inicio);
    // Un horario de hoy que ya pasó no se ofrece. `continue` saltea el resto
    // de esta vuelta y pasa a la siguiente.
    if (yaPaso(rango.fecha, hora)) continue;
    // Bloquea cualquier turno confirmado a menos de una duración de distancia.
    // Es la MISMA cuenta que hace `crearTurno` antes de insertar, así lo que se
    // ofrece coincide con lo que el alta acepta.
    const pisado = ocupados.some((ocupado) => Math.abs(ocupado - inicio) < DURACION_TURNO);
    // Si nadie lo pisa, se agrega a la lista de libres.
    if (!pisado) libres.push({ hora, id_agenda: rango.id });
  }
  return libres;
}

/**
 * Trae los rangos de agenda que cumplen la consulta y los turnos confirmados
 * de cada uno, en dos consultas (no una por rango).
 *
 * @param consulta Médico, especialidad y sede.
 * @param fecha Si viene, solo esa fecha; si no, desde hoy en adelante.
 * @returns Cada rango con las horas que ya tiene ocupadas.
 */
async function rangosConOcupados(
  consulta: ConsultaDisponibilidad,
  fecha?: string,
): Promise<{ rango: RangoAgenda; ocupadas: string[] }[]> {
  // CONSULTA 1 — rangos de agenda del médico en esa especialidad y sede.
  // El filtro de fecha cambia según si vino `fecha` (operador ternario `? :`):
  //   - con fecha  → "fecha = ?"  (pantalla de horarios: un día puntual);
  //   - sin fecha  → "fecha >= ?" con hoy (pantalla de fechas: de hoy en adelante).
  // `fecha ?? fechaHoy()` usa la fecha recibida o, si no vino, la de hoy.
  const [rangos] = await pool.query<RowDataPacket[]>(
    `SELECT id, fecha, hora_entrada, hora_salida
       FROM agenda
      WHERE id_medico = ? AND id_especialidad = ? AND id_sede = ?
        AND ${fecha ? "fecha = ?" : "fecha >= ?"}
      ORDER BY fecha, hora_entrada`,
    [consulta.id_medico, consulta.id_especialidad, consulta.id_sede, fecha ?? fechaHoy()],
  );

  // Sin rangos no hay nada que calcular: se devuelve una lista vacía (y se
  // evita la segunda consulta, que con `IN ()` vacío sería SQL inválido).
  if (rangos.length === 0) return [];

  // CONSULTA 2 — horas de los turnos confirmados de TODOS esos rangos juntos
  // (`IN (?)` con el array de ids; mysql2 lo expande a "IN (3, 7, 9)").

  // Solo la hora: este servicio no devuelve NADA de los turnos ocupados (ni
  // paciente ni nota). La consigna pide no exponer datos de otros pacientes.
  const [turnos] = await pool.query<RowDataPacket[]>(
    `SELECT id_agenda, hora
       FROM turno
      WHERE estado = 'confirmado' AND hora IS NOT NULL AND id_agenda IN (?)`,
    [rangos.map((rango) => rango.id)],
  );

  // Arma el resultado: por cada rango, sus datos (convertidos a número/texto)
  // y la lista de horas ocupadas que le pertenecen (`filter` se queda con los
  // turnos de ese id_agenda y `map` toma solo la hora).
  return rangos.map((fila) => ({
    rango: {
      id: Number(fila.id),
      fecha: String(fila.fecha),
      hora_entrada: String(fila.hora_entrada),
      hora_salida: String(fila.hora_salida),
    },
    ocupadas: turnos
      .filter((turno) => Number(turno.id_agenda) === Number(fila.id))
      .map((turno) => String(turno.hora)),
  }));
}

/**
 * Fechas, desde hoy, en las que el médico tiene agenda con algún horario libre.
 *
 * Una fecha con agenda pero todos los horarios tomados no se ofrece: elegirla
 * llevaría al paciente a un paso de horarios vacío.
 *
 * @param consulta Médico, especialidad y sede.
 * @returns Fechas "YYYY-MM-DD", ordenadas y sin repetir.
 */
export async function listarFechasDisponibles(
  consulta: ConsultaDisponibilidad,
): Promise<string[]> {
  // Un Set no admite repetidos: si el médico tiene dos rangos el mismo día,
  // la fecha queda una sola vez.
  const fechas = new Set<string>();
  // Recorre cada rango (desde hoy) con sus horas ocupadas...
  for (const { rango, ocupadas } of await rangosConOcupados(consulta)) {
    // ...y solo agrega la fecha si ese rango tiene al menos un horario libre.
    if (horariosLibresDelRango(rango, ocupadas).length > 0) fechas.add(rango.fecha);
  }
  // El Set conserva el orden de inserción, y los rangos ya vienen por fecha.
  return [...fechas];
}

/**
 * Horarios libres de una fecha puntual.
 *
 * Si el médico tiene varios rangos ese día (la consigna lo permite), se
 * juntan los horarios de todos.
 *
 * @param consulta Médico, especialidad y sede.
 * @param fecha Fecha "YYYY-MM-DD".
 * @returns Los horarios libres en orden cronológico.
 */
export async function listarHorariosDisponibles(
  consulta: ConsultaDisponibilidad,
  fecha: string,
): Promise<HorarioLibre[]> {
  const horarios: HorarioLibre[] = [];
  // Por cada rango de ESA fecha, se calculan sus libres y se agregan todos a
  // la lista (`...` "desparrama" el array dentro de push).
  for (const { rango, ocupadas } of await rangosConOcupados(consulta, fecha)) {
    horarios.push(...horariosLibresDelRango(rango, ocupadas));
  }
  // Ordena por hora ("08:00" antes que "14:00"): con dos dígitos, comparar
  // texto da el orden cronológico. Es lo que muestra el paso "Horario".
  return horarios.sort((a, b) => a.hora.localeCompare(b.hora));
}
