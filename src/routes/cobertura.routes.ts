/**
 * RUTAS: /coberturas
 * ==================
 *
 * Es el único router de la entrega con protección mixta, porque la consigna
 * pide dos cosas que no entran en la misma ruta:
 *
 *   1. "Estos endpoints [del CRUD] solo pueden ser utilizados por el rol
 *      administrador" — y el criterio de aceptación remata: cualquier otro rol
 *      recibe 403.
 *   2. "Armar además un servicio de solo lectura que liste las coberturas
 *      disponibles, reutilizable desde el registro de pacientes" — y el
 *      registro es público, sin token.
 *
 * Si el listado del CRUD fuera público se incumpliría (1); si el registro
 * tuviera que pedir token, se incumpliría (2). Por eso hay dos rutas de
 * lectura: `/coberturas/disponibles` es pública y `/coberturas` es del admin.
 * El nombre sale del propio enunciado ("liste las coberturas disponibles").
 *
 * ⚠️ EL ORDEN DE ESTE ARCHIVO IMPORTA. La ruta pública se declara ANTES del
 * `use` que protege el resto: los middlewares de Express solo afectan a lo que
 * se registra después de ellos. Si se moviera abajo, quedaría protegida y el
 * registro de pacientes dejaría de funcionar.
 */

import { Router } from "express";
import * as coberturaController from "../controllers/cobertura.controller";
import { verificarRol } from "../middlewares/verificarRol";
import { verificarToken } from "../middlewares/verificarToken";

export const rutasCobertura = Router();

// ── Pública ──────────────────────────────────────────────────────────────────
// GET /coberturas/disponibles — la consume el formulario de registro.
rutasCobertura.get("/disponibles", coberturaController.listarDisponibles);

// ── A partir de acá, todo exige token + rol admin ────────────────────────────
rutasCobertura.use(verificarToken, verificarRol("admin"));

rutasCobertura.get("/", coberturaController.listar); //        GET    /coberturas
rutasCobertura.post("/", coberturaController.crear); //        POST   /coberturas
rutasCobertura.put("/:id", coberturaController.actualizar); // PUT    /coberturas/:id
rutasCobertura.delete("/:id", coberturaController.eliminar); // DELETE /coberturas/:id
