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
 * Por eso adentro de los routers las rutas se escriben "/" o "/:id" y no la URL
 * completa: el prefijo ya lo puso este archivo. La ventaja es que cambiar
 * `/agendas` por `/agenda` se hace tocando una sola línea.
 */

import { Router } from "express";
import { rutasAgenda } from "./agenda.routes";
import { rutasAuth } from "./auth.routes";
import { rutasCobertura } from "./cobertura.routes";
import { rutasEspecialidad } from "./especialidad.routes";
import { rutasHealth } from "./health.routes";
import { rutasSede } from "./sede.routes";
import { rutasTurno } from "./turno.routes";
import { rutasHistorial } from "./historial.routes";
import { rutasNotificacion } from "./notificacion.routes";

/** Router raíz. Lo monta `app.use(rutas)` en src/index.ts. */
export const rutas = Router();

// Semana 1 — autenticación
rutas.use("/health", rutasHealth); //           público
rutas.use("/auth", rutasAuth); //               registro y login públicos, perfil con token

// Semana 2 — CRUD de las entidades base y de la agenda
rutas.use("/coberturas", rutasCobertura); //    /disponibles público, el resto admin
rutas.use("/sedes", rutasSede); //              admin
rutas.use("/especialidades", rutasEspecialidad); // admin
rutas.use("/agendas", rutasAgenda); //          medico (la propia), operador y admin

// Semana 3 — turnos, historial clínico y notificaciones
rutas.use("/turnos", rutasTurno); //            paciente/operador crean, medico atiende
rutas.use("/historial", rutasHistorial); //     medico registra, paciente consulta el suyo
rutas.use("/notificaciones", rutasNotificacion); // cada uno las propias, cualquier rol
