/**
 * RUTAS: /sedes
 * =============
 *
 * CRUD de sucursales.
 *
 * Flujo: esta ruta → `sede.controller.ts` → `sede.service.ts` → tabla `sede`.
 *
 * Protección (cambió para la etapa del frontend):
 *   - `GET /sedes` → cualquier usuario con sesión. El frontend lo necesita
 *     para cargar los selectores de sede del paciente (solicitar turno), del
 *     médico (su agenda) y del operador (filtro de agenda). La consigna final
 *     pide que esos listados salgan de la API y no estén escritos a mano.
 *   - Alta, modificación y baja → solo `admin`, como pedía la semana 2.
 *
 * El orden de las líneas es lo que implementa esa diferencia: `verificarToken`
 * se aplica a todo el router, el GET se registra antes de sumar
 * `verificarRol("admin")`, y todo lo que se registra después del segundo `use`
 * queda solo para el administrador. Express recorre los middlewares en el
 * orden en que se montan.
 */

import { Router } from "express";
import * as sedeController from "../controllers/sede.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasSede = Router();

// Sin token → 401, para todo el router.
rutasSede.use(verificarToken);

rutasSede.get("/", sedeController.listar); //        GET    /sedes  (cualquier rol)

// De acá para abajo, solo admin: con token de otro rol → 403.
rutasSede.use(verificarRol("admin"));

rutasSede.post("/", sedeController.crear); //        POST   /sedes
rutasSede.put("/:id", sedeController.actualizar); // PUT    /sedes/:id
rutasSede.delete("/:id", sedeController.eliminar); // DELETE /sedes/:id
