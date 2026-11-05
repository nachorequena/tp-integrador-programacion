/**
 * PRUEBAS: middleware verificarToken
 *
 * Además de la firma, el middleware compara el token con el usuario ACTUAL
 * de la base: si el admin le cambió la sede o el rol (por ejemplo, trasladó a
 * un operador), la sesión vieja deja de servir. La base se reemplaza por una
 * versión falsa de `pool.query`.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { pool } from "../src/database/conexion";
import { verificarToken } from "../src/middlewares/verificarToken";
import { PayloadJWT } from "../src/types";
import { ErrorHttp } from "../src/utils/errorHttp";
import { firmarToken } from "../src/utils/jwt";

const operador: PayloadJWT = { id: 2, rol: "operador", id_sede: 1 };

/** Simula que la base devuelve estas filas para el SELECT del usuario. */
function baseDevuelve(filas: object[]): void {
  mock.method(pool, "query", async () => [filas, []]);
}

/** Corre el middleware y devuelve lo que recibió `next` y la petición. */
async function ejecutar(authorization?: string) {
  const req = { headers: { authorization } } as Request;
  let recibido: unknown = "sin llamar";
  const next = ((error?: unknown) => {
    recibido = error;
  }) as NextFunction;
  await verificarToken(req, {} as Response, next);
  return { req, recibido };
}

describe("verificarToken", () => {
  afterEach(() => mock.restoreAll());

  it("401 si falta el header", async () => {
    const { recibido } = await ejecutar();
    assert.ok(recibido instanceof ErrorHttp);
    assert.equal(recibido.codigo, 401);
  });

  it("401 si el token está manipulado", async () => {
    const { recibido } = await ejecutar(`Bearer ${firmarToken(operador)}x`);
    assert.ok(recibido instanceof ErrorHttp);
    assert.equal(recibido.message, "Token inválido");
  });

  it("deja pasar si el usuario sigue con el mismo rol y sede", async () => {
    baseDevuelve([{ rol: "operador", id_sede: 1 }]);
    const { req, recibido } = await ejecutar(`Bearer ${firmarToken(operador)}`);
    assert.equal(recibido, undefined); // next() sin error
    assert.equal(req.usuario?.id_sede, 1);
  });

  it("401 si el admin trasladó al operador a otra sede", async () => {
    baseDevuelve([{ rol: "operador", id_sede: 2 }]);
    const { recibido } = await ejecutar(`Bearer ${firmarToken(operador)}`);
    assert.ok(recibido instanceof ErrorHttp);
    assert.equal(recibido.codigo, 401);
    assert.match(recibido.message, /cambiaron/);
  });

  it("401 si le cambiaron el rol", async () => {
    baseDevuelve([{ rol: "medico", id_sede: 1 }]);
    const { recibido } = await ejecutar(`Bearer ${firmarToken(operador)}`);
    assert.ok(recibido instanceof ErrorHttp);
    assert.equal(recibido.codigo, 401);
  });

  it("401 si el usuario ya no existe", async () => {
    baseDevuelve([]);
    const { recibido } = await ejecutar(`Bearer ${firmarToken(operador)}`);
    assert.ok(recibido instanceof ErrorHttp);
    assert.equal(recibido.codigo, 401);
  });
});
