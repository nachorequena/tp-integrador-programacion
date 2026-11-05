/**
 * PRUEBAS: grilla de turnos (services/disponibilidad.service.ts)
 *
 * `esHorarioDeLaGrilla` decide qué horas acepta el alta de turno. Tiene que
 * coincidir con lo que se ofrece en "Solicitar turno": turnos de 30 minutos
 * contados desde la hora de entrada y que terminen antes de la salida.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DURACION_TURNO, esHorarioDeLaGrilla } from "../src/services/disponibilidad.service";

const rango = { hora_entrada: "08:00", hora_salida: "10:00" };

describe("esHorarioDeLaGrilla", () => {
  it("la duración de cada turno es 30 minutos", () => {
    assert.equal(DURACION_TURNO, 30);
  });

  it("acepta los inicios de la grilla dentro del rango", () => {
    for (const hora of ["08:00", "08:30", "09:00", "09:30"]) {
      assert.equal(esHorarioDeLaGrilla(rango, hora), true, hora);
    }
  });

  it("rechaza un turno que terminaría después de la salida", () => {
    assert.equal(esHorarioDeLaGrilla(rango, "10:00"), false);
  });

  it("rechaza una hora anterior a la entrada", () => {
    assert.equal(esHorarioDeLaGrilla(rango, "07:30"), false);
  });

  it("rechaza una hora fuera de la grilla de 30 minutos", () => {
    assert.equal(esHorarioDeLaGrilla(rango, "08:10"), false);
  });

  it("cuenta la grilla desde la hora de entrada, no desde la hora en punto", () => {
    const corrido = { hora_entrada: "08:15", hora_salida: "10:00" };
    assert.equal(esHorarioDeLaGrilla(corrido, "08:45"), true);
    assert.equal(esHorarioDeLaGrilla(corrido, "09:00"), false);
  });
});
