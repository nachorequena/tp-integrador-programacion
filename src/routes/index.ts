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
 *
 * Quién lo usa: `src/index.ts` lo monta después del middleware de auditoría y
 * antes del 404 y del manejador de errores.
 *
 * Todos los routers se montan con un prefijo propio, nunca en la raíz: un
 * router montado en "/" con `verificarToken` interceptaría también las URLs
 * inexistentes y respondería 401 donde corresponde un 404.
 */

import { Router } from "express";
import { rutasAgenda } from "./agenda.routes";
import { rutasAuditoria } from "./auditoria.routes";
import { rutasAuth } from "./auth.routes";
import { rutasCobertura } from "./cobertura.routes";
import { rutasEspecialidad } from "./especialidad.routes";
import { rutasHealth } from "./health.routes";
import { rutasReporte } from "./reporte.routes";
import { rutasSede } from "./sede.routes";
import { rutasTurno } from "./turno.routes";
import { rutasHistorial } from "./historial.routes";
import { rutasNotificacion } from "./notificacion.routes";
import { rutasDisponibilidad } from "./disponibilidad.routes";
import { rutasMedico } from "./medico.routes";
import { rutasPaciente } from "./paciente.routes";
import { rutasUsuario } from "./usuario.routes";

/** Router raíz. Lo monta `app.use(rutas)` en src/index.ts. */
export const rutas = Router();

// Semana 1 — autenticación
rutas.use("/health", rutasHealth); //           público
rutas.use("/auth", rutasAuth); //               registro y login públicos, perfil con token

// Semana 2 — CRUD de las entidades base y de la agenda
rutas.use("/coberturas", rutasCobertura); //    /disponibles público, el resto admin
rutas.use("/sedes", rutasSede); //              GET cualquier sesión, el resto admin
rutas.use("/especialidades", rutasEspecialidad); // GET cualquier sesión, el resto admin
rutas.use("/agendas", rutasAgenda); //          medico (la propia), operador (su sede) y admin

// Semana 3 — turnos, historial clínico y notificaciones
rutas.use("/turnos", rutasTurno); //            paciente/operador crean, medico atiende
rutas.use("/historial", rutasHistorial); //     medico registra, paciente consulta el suyo
rutas.use("/notificaciones", rutasNotificacion); // cada uno las propias, cualquier rol

// Semana 4 — auditoría y reportes
rutas.use("/auditoria", rutasAuditoria); //     admin
rutas.use("/reportes", rutasReporte); //        admin

// Etapa frontend — ajustes pedidos por la consigna final
rutas.use("/medicos", rutasMedico); //            cualquier sesión
rutas.use("/disponibilidad", rutasDisponibilidad); // paciente y operador
rutas.use("/pacientes", rutasPaciente); //        búsqueda, alta (operador), mis datos (paciente)
rutas.use("/usuarios", rutasUsuario); //          admin
