/**
 * MONTAJE DE RUTAS
 * ================
 *
 * Router principal: junta todos los routers del proyecto y les asigna su
 * prefijo de URL. Es el mapa de la API en un solo archivo.
 *
 * Cómo se arma cada URL: el prefijo que se define acá se concatena con la ruta
 * declarada dentro de cada router.
 *
 *   rutas.use("/auth", rutasAuth)  +  rutasAuth.post("/login", ...)
 *   └───────────────────────────────────────────────────────────┘
 *                          POST /auth/login
 *
 * Por eso adentro de los routers las rutas se escriben "/" o "/login" y no la
 * URL completa: el prefijo ya lo puso este archivo. La ventaja es que cambiar
 * `/coberturas` por `/obras-sociales` se hace tocando una sola línea.
 */

import { Router } from "express";
import { rutasAuth } from "./auth.routes";
import { rutasCobertura } from "./cobertura.routes";
import { rutasHealth } from "./health.routes";
import { rutasSede } from "./sede.routes";
import { rutasTurno } from "./turno.routes";
import { rutasHistorial } from "./historial.routes";
import { rutasNotificacion } from "./notificacion.routes";

/** Router raíz. Lo monta `app.use(rutas)` en src/index.ts. */
export const rutas = Router();

rutas.use("/health", rutasHealth); //      GET  /health
rutas.use("/coberturas", rutasCobertura); // GET  /coberturas
rutas.use("/auth", rutasAuth); //          POST /auth/registro, /auth/login · GET /auth/perfil
rutas.use("/sedes", rutasSede); //         GET  /sedes
rutas.use("/turnos", rutasTurno);
rutas.use("/historial", rutasHistorial);
rutas.use("/notificaciones", rutasNotificacion);