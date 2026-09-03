/**
 * RUTAS: /agendas
 * ===============
 *
 * CRUD de la agenda médica.
 *
 * La consigna reparte el acceso así: el `medico` solo gestiona la suya, el
 * `operador` la de cualquier médico y sede, y el `paciente` no tiene acceso.
 * Sobre el `admin` no dice nada; se decidió darle lo mismo que al operador,
 * porque sería incoherente que administre sedes y especialidades pero no pueda
 * ver una agenda.
 *
 * `verificarRol` cubre la mitad del requisito: deja afuera al paciente (403).
 * La otra mitad —que el médico solo toque SUS filas— no se puede resolver acá,
 * porque un middleware de rol no sabe de quién es cada registro. Esa validación
 * vive en `agenda.service.ts`.
 */

import { Router } from "express";
import * as agendaController from "../controllers/agenda.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasAgenda = Router();

// Sin token → 401. Con token de paciente → 403.
rutasAgenda.use(verificarToken, verificarRol("medico", "operador", "admin"));

rutasAgenda.get("/", agendaController.listar); //        GET    /agendas?id_medico=&id_sede=&fecha=
rutasAgenda.post("/", agendaController.crear); //        POST   /agendas
rutasAgenda.put("/:id", agendaController.actualizar); // PUT    /agendas/:id
rutasAgenda.delete("/:id", agendaController.eliminar); // DELETE /agendas/:id
