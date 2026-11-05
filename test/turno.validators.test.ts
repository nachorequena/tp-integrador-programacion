/**
 * PRUEBAS: validador del alta de turno (validators/turno.validators.ts)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ErrorHttp } from "../src/utils/errorHttp";
import { validarNuevoTurno } from "../src/validators/turno.validators";

const valido = {
  id_especialidad: 1,
  id_sede: 1,
  id_medico: 3,
  fecha: "2030-05-10",
  hora: "09:30",
  nota: "Control anual",
};

/** Ejecuta el validador y devuelve el ErrorHttp que lanza. */
function errorDe(cuerpo: unknown): ErrorHttp {
  try {
    validarNuevoTurno(cuerpo);
  } catch (error) {
    assert.ok(error instanceof ErrorHttp);
    return error;
  }
  assert.fail("se esperaba un ErrorHttp");
}

describe("validarNuevoTurno", () => {
  it("devuelve los datos limpios si todo es válido", () => {
    const datos = validarNuevoTurno({ ...valido, nota: "  Control anual  " });
    assert.equal(datos.nota, "Control anual");
    assert.equal(datos.id_paciente, undefined);
  });

  it("junta TODOS los errores en un solo 400", () => {
    const error = errorDe({});
    assert.equal(error.codigo, 400);
    for (const campo of ["id_especialidad", "id_sede", "id_medico", "fecha", "hora", "nota"]) {
      assert.match(error.message, new RegExp(campo));
    }
  });

  it("rechaza una fecha que no existe", () => {
    assert.match(errorDe({ ...valido, fecha: "2030-02-31" }).message, /fecha/);
  });

  it("exige la hora con dos dígitos (HH:MM)", () => {
    assert.match(errorDe({ ...valido, hora: "9:30" }).message, /hora/);
  });

  it("rechaza una nota de solo espacios o de más de 40 caracteres", () => {
    assert.match(errorDe({ ...valido, nota: "   " }).message, /nota es obligatoria/);
    assert.match(errorDe({ ...valido, nota: "x".repeat(41) }).message, /40/);
  });

  it("valida id_paciente solo si viene (lo manda el operador)", () => {
    assert.equal(validarNuevoTurno({ ...valido, id_paciente: 7 }).id_paciente, 7);
    assert.match(errorDe({ ...valido, id_paciente: -2 }).message, /id_paciente/);
  });

  it("rechaza un cuerpo que no es un objeto", () => {
    assert.equal(errorDe("texto").codigo, 400);
  });
});
