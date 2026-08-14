/**
 * RUTAS: /sedes
 * =============
 *
 * CRUD de sucursales. La consigna es tajante: "estos endpoints solo pueden ser
 * utilizados por el rol administrador".
 *
 * En vez de repetir los dos middlewares en cada línea, se aplican al router
 * entero con `use`: así es imposible olvidarse de proteger una ruta nueva que
 * se agregue más abajo.
 */

import { Router } from "express";
import * as sedeController from "../controllers/sede.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasSede = Router();

// Se aplican a TODAS las rutas de este router, en este orden:
// verificarToken deja el usuario en req.usuario, verificarRol lee su rol.
// Sin token → 401; con token de otro rol → 403.
rutasSede.use(verificarToken, verificarRol("admin"));

rutasSede.get("/", sedeController.listar); //        GET    /sedes
rutasSede.post("/", sedeController.crear); //        POST   /sedes
rutasSede.put("/:id", sedeController.actualizar); // PUT    /sedes/:id
rutasSede.delete("/:id", sedeController.eliminar); // DELETE /sedes/:id
