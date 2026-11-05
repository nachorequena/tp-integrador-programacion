/**
 * PRUEBAS: middleware manejadorErrores
 *
 * Toda respuesta de error sale con el formato uniforme { codigo, estado,
 * datos: null }, y los errores de MySQL conocidos se traducen a un mensaje
 * entendible.
 */

import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { manejadorErrores } from "../src/middlewares/manejadorErrores";
import { ErrorHttp } from "../src/utils/errorHttp";

/** Respuesta falsa que guarda el status y el JSON enviados. */
function respuestaFalsa() {
  const enviada: { status?: number; cuerpo?: { codigo: number; estado: string; datos: unknown } } = {};
  const res = {
    status(codigo: number) {
      enviada.status = codigo;
      return this;
    },
    json(cuerpo: typeof enviada.cuerpo) {
      enviada.cuerpo = cuerpo;
      return this;
    },
  } as unknown as Response;
  return { res, enviada };
}

function manejar(error: unknown) {
  const { res, enviada } = respuestaFalsa();
  manejadorErrores(error, {} as Request, res, (() => undefined) as NextFunction);
  return enviada;
}

describe("manejadorErrores", () => {
  it("usa el código y el mensaje de un ErrorHttp", () => {
    const r = manejar(new ErrorHttp(409, "Ese horario ya fue tomado"));
    assert.equal(r.status, 409);
    assert.deepEqual(r.cuerpo, { codigo: 409, estado: "Ese horario ya fue tomado", datos: null });
  });

  it("traduce una clave foránea en uso a 409", () => {
    const r = manejar({ code: "ER_ROW_IS_REFERENCED_2" });
    assert.equal(r.status, 409);
  });

  it("explica cuando una tabla llegó al tope del id tinyint", () => {
    const silencio = mock.method(console, "error", () => undefined);
    const r = manejar({
      code: "ER_DUP_ENTRY",
      sqlMessage: "Duplicate entry '127' for key 'turno.PRIMARY'",
    });
    silencio.mock.restore();
    assert.equal(r.status, 500);
    assert.match(r.cuerpo!.estado, /tabla "turno"/);
  });

  it("no expone el detalle de un error inesperado", () => {
    const silencio = mock.method(console, "error", () => undefined);
    const r = manejar(new Error("detalle interno"));
    silencio.mock.restore();
    assert.equal(r.status, 500);
    assert.equal(r.cuerpo!.estado, "Error interno del servidor");
  });
});
