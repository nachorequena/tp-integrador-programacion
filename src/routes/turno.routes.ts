/**
 * RUTAS: /turnos
 * ==============
 *
 * Alta, cancelación, atención y listados de turnos.
 *
 * A diferencia de los routers de la semana 2, acá los middlewares NO se aplican
 * con `use` al router entero: cada endpoint admite roles distintos, así que la
 * lista va ruta por ruta.
 *
 *   POST   /              paciente (para sí) · operador (en representación)
 *   GET    /mios          paciente
 *   GET    /medico        medico
 *   GET    /sede          operador
 *   PATCH  /:id/cancelar  paciente (el suyo) · operador y medico (su sede)
 *   PATCH  /:id/atender   medico
 *
 * `verificarRol` resuelve solo la mitad: qué rol puede llamar. La otra mitad
 * —de quién es el turno concreto— la valida `turno.service.ts`, porque un
 * middleware de rol no sabe a quién pertenece cada fila.
 *
 * ⚠️ EL ORDEN IMPORTA: `/mios`, `/medico` y `/sede` se declaran antes que
 * cualquier ruta con parámetro. Hoy no chocarían (`/:id/cancelar` tiene dos
 * segmentos), pero si mañana se agrega un `GET /:id`, esas tres pasarían a
 * interpretarse como un id y dejarían de funcionar.
 *
 * Se usa PATCH y no PUT en cancelar y atender porque no se reemplaza el turno:
 * se modifica un solo campo, el estado.
 */

import { Router } from "express";
import * as turnoController from "../controllers/turno.controller";
import { verificarToken } from "../middlewares/verificarToken";
import { verificarRol } from "../middlewares/verificarRol";

export const rutasTurno = Router();

rutasTurno.post(
  "/",
  verificarToken,
  verificarRol("paciente", "operador"),
  turnoController.crear,
);

rutasTurno.get(
  "/mios",
  verificarToken,
  verificarRol("paciente"),
  turnoController.misTurnos,
);

rutasTurno.get(
  "/medico",
  verificarToken,
  verificarRol("medico"),
  turnoController.turnosMedico,
);

rutasTurno.get(
  "/sede",
  verificarToken,
  verificarRol("operador"),
  turnoController.turnosSede,
);

rutasTurno.patch(
  "/:id/cancelar",
  verificarToken,
  verificarRol("paciente", "operador", "medico"),
  turnoController.cancelar,
);

rutasTurno.patch(
  "/:id/atender",
  verificarToken,
  verificarRol("medico"),
  turnoController.atender,
);
