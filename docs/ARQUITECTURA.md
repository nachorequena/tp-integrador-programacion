# Arquitectura del backend

Mapa del código para entender (y defender) qué hace cada parte y con qué se conecta. El detalle de cada función está en su JSDoc; acá está el recorrido completo.

## 1. Recorrido de una petición

```
Cliente (frontend Angular / Postman)
   │  HTTP + JSON, header Authorization: Bearer <token>
   ▼
src/index.ts ─ arma Express y monta, en este orden:
   │
   ├─ cors()                      solo el origen del frontend (CORS_ORIGEN)
   ├─ express.json()              parsea el cuerpo; JSON roto → 400 en el manejador
   ├─ /docs                       Swagger UI con src/docs/openapi.ts
   ├─ auditar                     middlewares/auditoria.ts: envuelve res.json
   ├─ rutas                       routes/index.ts: prefijo → router de cada recurso
   │     │
   │     ├─ verificarToken        middlewares/verificarToken.ts → 401
   │     ├─ verificarRol(...)     middlewares/verificarRol.ts   → 403
   │     └─ controller            controllers/*.controller.ts
   │            ├─ validator      validators/*.validators.ts    → 400
   │            └─ service        services/*.service.ts         → SQL con mysql2 (database/conexion.ts)
   │                   └─ ErrorHttp(4xx) si una regla de negocio no se cumple
   │            └─ responder()    utils/respuesta.ts → { codigo, estado, datos }
   ├─ 404                         ninguna ruta coincidió
   └─ manejadorErrores            middlewares/manejadorErrores.ts: ErrorHttp → su código; resto → 500
```

Después de que el controller responde, `auditar` mira el status: si la operación salió bien y figura en `RUTAS_AUDITADAS`, escribe una fila en `log_auditoria` (sin demorar la respuesta).

## 2. Qué hay en cada carpeta

| Carpeta | Responsabilidad | La usa |
| ------- | --------------- | ------ |
| `config/env.ts` | Lee y valida las variables del `.env` | `index.ts`, `conexion.ts`, `jwt.ts` |
| `database/conexion.ts` | Pool de conexiones `mysql2` (`dateStrings: true`) | todos los services |
| `routes/` | URL + método → middlewares → controller | `routes/index.ts` los monta |
| `controllers/` | Leen `req`, llaman al validator y al service, responden | las rutas |
| `validators/` | Forma de los datos (tipos, largos, formatos); acumulan errores en un solo 400 | los controllers |
| `services/` | Reglas de negocio y SQL parametrizado | los controllers (y otros services) |
| `middlewares/` | Token, rol, auditoría y manejador de errores | `index.ts` y las rutas |
| `utils/` | `responder`, `ErrorHttp`, JWT y fechas locales | todo el proyecto |
| `types/index.ts` | Interfaces con los nombres exactos de las columnas | todo el proyecto |
| `docs/openapi.ts` | Especificación OpenAPI que sirve `/docs` | `index.ts` |

## 3. Endpoint → controller → service → rol

| Endpoint | Controller | Service | Roles |
| -------- | ---------- | ------- | ----- |
| `GET /health` | `health` | `conexion.probarConexion` | público |
| `POST /auth/registro` | `auth.registro` | `auth.registrarPaciente` → `usuario` | público |
| `POST /auth/login` | `auth.login` | `auth.login` | público |
| `GET /auth/perfil` | `auth.perfil` | `auth.obtenerPerfil` | cualquier sesión |
| `GET /coberturas/disponibles` | `cobertura.listarDisponibles` | `cobertura` | público |
| `GET/POST/PUT/DELETE /coberturas` | `cobertura.*` | `cobertura` (+ `dependencias`) | admin |
| `GET /sedes` | `sede.listar` | `sede` | cualquier sesión |
| `POST/PUT/DELETE /sedes` | `sede.*` | `sede` (+ `dependencias`) | admin |
| `GET /especialidades` | `especialidad.listar` | `especialidad` | cualquier sesión |
| `POST/PUT/DELETE /especialidades` | `especialidad.*` | `especialidad` (+ `dependencias`) | admin |
| `GET/POST/PUT/DELETE /agendas` | `agenda.*` | `agenda` (+ `medico.tieneEspecialidad`) | medico (propia), operador (su sede), admin |
| `POST /turnos` | `turno.crear` | `turno.crearTurno` (+ `disponibilidad`, `notificacion`) | paciente, operador |
| `GET /turnos/mios` | `turno.misTurnos` | `turno.listarTurnosPaciente` | paciente |
| `GET /turnos/medico` | `turno.turnosMedico` | `turno.listarTurnosMedico` | medico |
| `GET /turnos/sede` | `turno.turnosSede` | `turno.listarTurnosSede` | operador |
| `PATCH /turnos/:id/cancelar` | `turno.cancelar` | `turno.cancelarTurno` | paciente, operador, medico |
| `PATCH /turnos/:id/atender` | `turno.atender` | `turno.atenderTurno` | medico |
| `POST /historial/:idTurno` | `historial.registrar` | `historial.registrarHistorial` | medico |
| `GET /historial/mio` | `historial.miHistorial` | `historial.listarHistorialPaciente` | paciente |
| `GET /historial/paciente/:id` | `historial.historialPacienteMedico` | `historial.listarHistorialMedico` | medico |
| `GET /notificaciones` | `notificacion.listar` | `notificacion` | cualquier sesión |
| `PATCH /notificaciones/:id/leida` | `notificacion.marcarLeida` | `notificacion` | cualquier sesión |
| `GET /auditoria` | `auditoria.listar` | `auditoria.listarLogs` | admin |
| `GET /reportes/*` | `reporte.*` | `reporte` | admin |
| `GET /medicos` | `medico.listar` | `medico.listarMedicos` | cualquier sesión |
| `GET /disponibilidad/fechas` | `disponibilidad.fechas` | `disponibilidad.listarFechasDisponibles` | paciente, operador |
| `GET /disponibilidad/horarios` | `disponibilidad.horarios` | `disponibilidad.listarHorariosDisponibles` | paciente, operador |
| `GET /pacientes` | `paciente.buscar` | `paciente.buscarPacientes` | operador, medico, admin |
| `POST /pacientes` | `paciente.crear` | `auth.registrarPaciente` | operador |
| `PUT /pacientes/mis-datos` | `paciente.actualizarMisDatos` | `paciente.actualizarMisDatos` | paciente |
| `GET/POST/PUT /usuarios` | `usuario.*` | `gestion-usuario` | admin |

## 4. Reglas de negocio y dónde viven

| Regla | Dónde |
| ----- | ----- |
| Solo el rol correcto entra a cada endpoint | `verificarRol` en cada archivo de `routes/` |
| El médico solo toca su agenda; el operador solo la de su sede | `agenda.service.ts` → `validarPertenencia` |
| No eliminar ni recortar un rango con turnos confirmados | `agenda.service.ts` → `validarTurnosConfirmados`, `eliminarAgenda` |
| Turnos de 30 minutos; solo horarios futuros y libres | `disponibilidad.service.ts` (`DURACION_TURNO`, `esHorarioDeLaGrilla`) |
| Dos pedidos al mismo horario → el segundo recibe 409 | `turno.service.ts` → transacción con `SELECT ... FOR UPDATE` |
| La cobertura del turno sale del paciente, no del cuerpo | `turno.service.ts` → `obtenerCoberturaPaciente` |
| El médico ve solo el historial de los turnos que atendió | `historial.service.ts` → `listarHistorialMedico` (filtra por `id_medico`) |
| El paciente solo modifica email, contraseña, teléfono y cobertura | `paciente.validators.ts` + `paciente.service.ts` |
| Notificaciones al confirmar, cancelar o atender | `turno.service.ts` → `notificarEvento` |
| Auditoría automática de altas, bajas y modificaciones | `middlewares/auditoria.ts` (`RUTAS_AUDITADAS`) |
| Bajas con dependencias → 409, nunca 500 | `dependencias.service.ts` y cada service de entidad |

## 5. Base de datos

El esquema es el de la cátedra (`docs/clinica_ampliada.sql`), sin modificar. Para probar se cargan además `scripts/usuarios-prueba.sql` (contraseñas reales) y `scripts/datos-prueba.sql` (datos de la entrega final). Ojo con los ids `tinyint`: hay un tope de 127 filas por tabla (ver README, auditoría).
