# TP Integrador — Sistema de Gestión de Turnos Médicos (Backend)

Programación 2 — Etapa backend.

- **Semana 1** ✅ — setup, conexión a la base y autenticación con JWT.
- **Semana 2** ✅ — CRUD de sedes, especialidades, coberturas y agenda médica (rama `entrega-backend-2`).

Stack: Node.js + Express 5 + TypeScript + MySQL/MariaDB (`mysql2` con SQL crudo, sin ORM), JWT y bcrypt.

---

## Puesta en marcha

### 1. Crear e importar la base

El script `docs/clinica_ampliada.sql` **solo crea las tablas**: no incluye `CREATE DATABASE` ni `USE`. Hay que crear la base primero.

```sql
CREATE DATABASE clinica CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

Después, importar el script sobre esa base:

```bash
mysql -u root -p clinica < docs/clinica_ampliada.sql
```

(o importarlo desde phpMyAdmin / Adminer con la base `clinica` ya seleccionada).

### 2. Cargar los usuarios de prueba

```bash
mysql -u root -p clinica < scripts/usuarios-prueba.sql
```

**Sin este paso no se puede probar casi nada.** Los cuatro usuarios que trae el script de la cátedra tienen hashes de contraseña falsos (`$2b$10$hashdeejemplo1`), así que ninguno puede iniciar sesión y sin sesión no hay forma de demostrar los permisos por rol. El script les pone contraseñas reales y agrega un segundo médico. Es idempotente y **no modifica el `.sql` de la cátedra**.

### 3. Configurar el entorno

```bash
cp .env.example .env
```

Completar `.env` con las credenciales reales:

| Variable         | Descripción                                    |
| ---------------- | ---------------------------------------------- |
| `PORT`           | Puerto del servidor (default 3000)             |
| `DB_HOST`        | Host de MySQL/MariaDB                          |
| `DB_PORT`        | Puerto de la base (default 3306)               |
| `DB_USER`        | Usuario de la base                             |
| `DB_PASSWORD`    | Contraseña (puede ir vacía)                    |
| `DB_NAME`        | Nombre de la base (`clinica`)                  |
| `JWT_SECRET`     | Secreto para firmar los tokens                 |
| `JWT_EXPIRES_IN` | Vencimiento del token (default `1d`)           |

> `.env` está en `.gitignore` y **no se versiona**. El que sí se versiona es `.env.example`.

### 4. Instalar y levantar

```bash
npm install
npm run dev
```

Verificar antes que nada:

```bash
curl http://localhost:3000/health
```

```json
{ "codigo": 200, "estado": "ok", "datos": { "servidor": "ok", "base_de_datos": "ok" } }
```

Scripts disponibles:

| Script          | Qué hace                                        |
| --------------- | ----------------------------------------------- |
| `npm run dev`   | Servidor en modo desarrollo con recarga (`tsx`) |
| `npm run build` | Compila TypeScript a `dist/`                    |
| `npm start`     | Ejecuta la versión compilada                    |

---

## Formato de respuesta

**Todos** los endpoints —éxito y error— responden con la misma estructura:

```json
{ "codigo": 200, "estado": "ok", "datos": { } }
```

- `codigo`: código HTTP numérico.
- `estado`: `"ok"` si salió bien; si falló, un mensaje descriptivo del error.
- `datos`: los datos solicitados, o `null` cuando no hay retorno.

Ejemplo de error:

```json
{ "codigo": 409, "estado": "El DNI ya está registrado", "datos": null }
```

---

## Endpoints

### Autenticación y salud (semana 1)

| Método | Ruta             | Protección       | Descripción                       |
| ------ | ---------------- | ---------------- | --------------------------------- |
| GET    | `/health`        | pública          | Estado del servidor y de la base  |
| POST   | `/auth/registro` | pública          | Alta de paciente                  |
| POST   | `/auth/login`    | pública          | Devuelve el JWT                   |
| GET    | `/auth/perfil`   | `verificarToken` | Datos del usuario logueado        |

### Sedes, especialidades y coberturas (semana 2)

| Método | Ruta                      | Protección | Descripción                              |
| ------ | ------------------------- | ---------- | ---------------------------------------- |
| GET    | `/coberturas/disponibles` | **pública** | Listado de solo lectura para el registro |
| GET    | `/sedes`                  | `admin`    | Listado                                  |
| POST   | `/sedes`                  | `admin`    | Alta: `nombre`, `direccion`, `telefono`  |
| PUT    | `/sedes/:id`              | `admin`    | Modificación                             |
| DELETE | `/sedes/:id`              | `admin`    | Baja (valida dependencias)               |
| GET    | `/especialidades`         | `admin`    | Listado                                  |
| POST   | `/especialidades`         | `admin`    | Alta: `descripcion`                      |
| PUT    | `/especialidades/:id`     | `admin`    | Modificación                             |
| DELETE | `/especialidades/:id`     | `admin`    | Baja (valida dependencias)               |
| GET    | `/coberturas`             | `admin`    | Listado del CRUD                         |
| POST   | `/coberturas`             | `admin`    | Alta: `nombre`                           |
| PUT    | `/coberturas/:id`         | `admin`    | Modificación                             |
| DELETE | `/coberturas/:id`         | `admin`    | Baja (valida dependencias)               |

> **¿Por qué `/coberturas` y `/coberturas/disponibles`?** El criterio de aceptación exige que los endpoints de coberturas sean accesibles *únicamente* por admin (403 para el resto), pero la consigna también pide un servicio de solo lectura reutilizable desde el registro de pacientes, que es público y no lleva token. Las dos cosas no entran en la misma ruta. En la semana 1 el listado público era `/coberturas`; ahora es `/coberturas/disponibles`.

### Agenda médica (semana 2)

| Método | Ruta           | Protección                     | Descripción                              |
| ------ | -------------- | ------------------------------ | ---------------------------------------- |
| GET    | `/agendas`     | `medico`, `operador`, `admin`  | Listado filtrable                        |
| POST   | `/agendas`     | `medico`, `operador`, `admin`  | Alta de un rango horario                 |
| PUT    | `/agendas/:id` | `medico`, `operador`, `admin`  | Modificación                             |
| DELETE | `/agendas/:id` | `medico`, `operador`, `admin`  | Baja (valida turnos asociados)           |

### Turnos, historial clínico y notificaciones (semana 3)

| Método | Ruta                          | Protección              | Descripción                                        |
| ------ | ----------------------------- | ----------------------- | -------------------------------------------------- |
| POST   | `/turnos`                     | `paciente`, `operador`  | Alta. El paciente para sí; el operador en su nombre |
| GET    | `/turnos/mios`                | `paciente`              | Sus turnos, del más próximo al menos próximo        |
| GET    | `/turnos/medico?fecha=`       | `medico`                | Turnos programados del médico para esa fecha        |
| GET    | `/turnos/sede?fecha=`         | `operador`              | Turnos de su sede para esa fecha                    |
| PATCH  | `/turnos/:id/cancelar`        | `paciente`, `operador`, `medico` | Pasa el turno a `cancelado`               |
| PATCH  | `/turnos/:id/atender`         | `medico`                | Pasa el turno a `atendido`                          |
| POST   | `/historial/:idTurno`         | `medico`                | Registra diagnóstico, tratamiento y observaciones   |
| GET    | `/historial/mio`              | `paciente`              | La totalidad de su historial                        |
| GET    | `/historial/paciente/:id`     | `medico`                | Solo los registros que cargó ese médico             |
| GET    | `/notificaciones`             | `verificarToken`        | Las propias, de más reciente a más antigua          |
| PATCH  | `/notificaciones/:id/leida`   | `verificarToken`        | Marca una notificación propia como leída            |

Detalles que vale la pena tener a mano:

- **La cobertura del turno no se recibe por el body.** Se toma de la registrada por el paciente, para que nadie pueda pedir un turno con una cobertura que no le corresponde. El campo ni siquiera existe en el tipo que valida la petición.
- **El horario tiene que caer dentro de un rango de la agenda del médico.** Si no, la respuesta es un 400 que lo dice. El límite superior es exclusivo: un rango que termina a las 12:00 no admite un turno a las 12:00.
- **No hay endpoint para crear notificaciones.** Se generan solas al confirmar, cancelar o atender un turno, siempre con `leida = 0`. Un endpoint de alta permitiría falsificarlas.
- **Se usa PATCH y no PUT** en cancelar, atender y marcar como leída, porque no se reemplaza el recurso: se cambia un solo campo.
- **La carga del historial es un paso posterior a la atención** —la consigna admite las dos variantes—; los dos registros quedan asociados por `historial_clinico.id_turno`.
- **El rol `admin` no participa de esta entrega.** La consigna enumera qué rol usa cada endpoint y no lo menciona en ninguno, así que no se le dio acceso.

### Auditoría y reportes (semana 4)

| Método | Ruta                                  | Protección | Descripción                                       |
| ------ | ------------------------------------- | ---------- | ------------------------------------------------- |
| GET    | `/auditoria`                          | `admin`    | Log filtrable por usuario, entidad y rango de fechas |
| GET    | `/reportes/turnos-por-especialidad`   | `admin`    | Conteo agrupado                                   |
| GET    | `/reportes/turnos-por-sede`           | `admin`    | Conteo agrupado                                   |
| GET    | `/reportes/ranking-medicos`           | `admin`    | Médicos por turnos atendidos, la lista completa   |
| GET    | `/reportes/tasa-cancelacion`          | `admin`    | Cancelados sobre el total del período             |
| GET    | `/docs`                               | **pública** | Documentación Swagger de toda la API             |

Los cuatro reportes aceptan `?desde=&hasta=` (opcional, inclusivo en ambos extremos, sobre `turno.fecha`). Sin rango, abarcan todo el histórico.

#### Cómo funciona la auditoría

El criterio de aceptación pide que cada alta, baja o modificación quede registrada **"automáticamente, sin código repetido en cada endpoint"**. Por eso no hay una sola línea de auditoría en los controllers ni en los services: lo resuelve [auditoria.ts](src/middlewares/auditoria.ts), un middleware montado una única vez en [index.ts](src/index.ts).

Envuelve `res.json`. Cuando un controller responde, el wrapper mira el status y el cuerpo, y si la operación salió bien y figura en la tabla de rutas auditadas, escribe la entrada. Responde primero y audita después, sin `await`: la auditoría no le agrega latencia a la respuesta.

Se auditan `usuario`, `sede`, `especialidad`, `cobertura`, `agenda` y `turno`. Las cuatro primeras las nombra el entregable; agenda y turnos se sumaron porque son los movimientos más frecuentes de la clínica y su ausencia dejaría el log ciego justo donde más pasa.

**No** se auditan las lecturas (no modifican nada), el login, el historial clínico ni el marcado de notificaciones como leídas.

La tabla de rutas es explícita en vez de deducir la acción del verbo HTTP, porque el verbo no alcanza: los turnos se cancelan y se atienden con `PATCH`, que son acciones distintas, y `PATCH /notificaciones/:id/leida` también es `PATCH` y no debe registrarse.

> ⚠️ **`log_auditoria.id` es `tinyint`: tope de 127 filas.** Se decidió no tocar el esquema de la cátedra, así que la escritura del log es **no fatal**: si falla, avisa por consola y la operación de negocio termina bien igual. Un ciclo completo de las cuatro colecciones consume ~20 entradas. Para resetear:
>
> ```sql
> DELETE FROM log_auditoria WHERE id > 1;
> ALTER TABLE log_auditoria AUTO_INCREMENT = 2;
> ```

#### Documentación de la API

`GET /docs` sirve la especificación OpenAPI 3 con **Swagger UI**. Cubre los 37 endpoints de las cuatro semanas, cada uno con método, ruta, parámetros, cuerpo esperado, respuestas de éxito y de error, y el rol que puede usarlo.

Es pública a propósito: si pidiera token, quien tiene que aprender a consumir la API necesitaría saber consumirla antes para conseguirlo. No expone datos, solo la forma de los endpoints.

La spec vive en [openapi.ts](src/docs/openapi.ts) como objeto TypeScript y no como YAML: así no hace falta una dependencia extra para parsearla y el compilador verifica que esté bien formada.

El listado acepta tres filtros combinables por query string:

```
GET /agendas?id_medico=3&id_sede=1&fecha=2025-10-20
```

Cuerpo del alta y la modificación:

```json
{
  "hora_entrada": "08:00",
  "hora_salida": "12:00",
  "fecha": "2026-12-15",
  "id_medico": 3,
  "id_especialidad": 1,
  "id_sede": 1
}
```

**Reglas de acceso.** El rol `paciente` recibe 403 en los cuatro endpoints. El `operador` y el `admin` gestionan la agenda de cualquier médico y sede. El `medico` solo la propia:

- si intenta crear una agenda con otro `id_medico` → **403**;
- si intenta modificar o borrar una agenda ajena → **403**;
- en el listado se le fuerza el filtro a su propio id, aunque pida otro por query.

**Validaciones.** Horas en formato `HH:MM` con entrada anterior a salida · fecha `YYYY-MM-DD` real · el `id_medico` debe existir y tener rol `medico` · especialidad y sede deben existir · el rango **no puede solaparse** con otro del mismo médico ese día (409). Sí se permiten varios rangos por día que no se pisen, e incluso contiguos (08:00-12:00 y 12:00-16:00).

### Middlewares

- **`verificarToken`** — valida firma y vencimiento del JWT del header `Authorization: Bearer <token>`. Si falta, es inválido o expiró → **401**. Deja el payload en `req.usuario`.
- **`verificarRol(...roles)`** — valida que `req.usuario.rol` esté entre los permitidos → si no, **403**. Se monta siempre después de `verificarToken`.

La pertenencia de cada fila de agenda **no** la resuelve `verificarRol` (un middleware de rol no sabe de quién es cada registro): eso se valida en `agenda.service.ts`.

---

## Borrado con dependencias

No se puede eliminar una entidad que esté en uso: el intento devuelve **409** con el detalle de qué la está usando, nunca un 500.

| DELETE de      | Bloqueado por                                                    |
| -------------- | ---------------------------------------------------------------- |
| `sede`         | `usuario.id_sede`, `agenda.id_sede`                              |
| `especialidad` | `medico_especialidad.id_especialidad`, `agenda.id_especialidad` * |
| `cobertura`    | `usuario.id_cobertura`, `turno.id_cobertura` *                   |
| `agenda`       | `turno.id_agenda` *                                              |

Las marcadas con `*` no figuran en la consigna, pero son claves foráneas reales del script: sin validarlas, esos borrados fallarían con un error del motor y terminarían en un 500, que es justo lo que el criterio de aceptación prohíbe.

---

## Credenciales de prueba

Disponibles después de correr `scripts/usuarios-prueba.sql`:

| DNI        | Contraseña    | Rol        | Usuario         |
| ---------- | ------------- | ---------- | --------------- |
| `18222333` | `admin123`    | `admin`    | Marcos Gomez    |
| `15200548` | `operador123` | `operador` | Juan Perez      |
| `20111222` | `medico123`   | `medico`   | Ana Lopez       |
| `25333444` | `medico123`   | `medico`   | Carlos Ruiz     |
| `36000960` | `paciente123` | `paciente` | Franco Friggeri |

Carlos Ruiz no viene en el script de la cátedra: lo agrega `usuarios-prueba.sql`. Con un solo médico sería imposible demostrar que un médico no puede modificar la agenda de otro, porque no habría "otro".

También se puede crear un paciente nuevo con `POST /auth/registro`; queda siempre con rol `paciente`.

---

## Colecciones de Postman

En [postman/](postman/) hay una por entrega:

| Archivo | Contenido |
| ------- | --------- |
| `Clinica-Backend-Semana1.postman_collection.json` | Autenticación: registro, login, perfil (14 requests) |
| `Clinica-Backend-Semana2.postman_collection.json` | CRUD de sedes, especialidades, coberturas y agenda (52 requests) |
| `Clinica-Backend-Semana3.postman_collection.json` | Turnos, historial clínico y notificaciones (56 requests) |
| `Clinica-Backend-Semana4.postman_collection.json` | Auditoría, reportes y consistencia (50 requests) |

Importarlas en Postman (**Import** → arrastrar el archivo) y ejecutar las carpetas **en orden**.

**Semana 2** — la carpeta `0. Autenticación` guarda los tokens de los cinco usuarios en variables de colección; el resto de las carpetas los usa. Es **idempotente**: todo lo que crea lo borra al final, así que se puede correr las veces que haga falta y siempre da verde.

**Semana 4** — verifica que la auditoría se dispare sola, que las lecturas y los intentos fallidos **no** dejen rastro, y que cancelar o atender un turno mueva los reportes en la consulta siguiente. Los reportes se consultan filtrados por una fecha exclusiva de cada corrida, así los conteos son deterministas sin importar qué haya acumulado la base.

**Semana 3** — arranca creando su propia agenda con los endpoints de la semana 2, porque el alta de turno valida contra ella. Cada corrida usa una **fecha distinta**, generada en el pre-request de esa primera llamada, así que es idempotente sin necesidad de limpiar nada entre corridas.

Los tres casos que pide la consigna están señalados con un comentario en el test:

| Caso | Dónde |
| ---- | ----- |
| Turno rechazado por horario no disponible | carpeta `2. Alta de turno` |
| Turno cancelado que genera notificación   | carpeta `4. Cancelación de turno` |
| Turno atendido con su historial asociado  | carpeta `5. Atención de turno e historial clínico` |

**Semana 1** — el primer request da de alta el paciente `40123456`. Para una corrida completa repetida hay que borrarlo antes:

```sql
DELETE FROM usuario WHERE dni = '40123456';
```

Las dos se pueden correr desde la terminal sin instalar nada en el proyecto:

```bash
npx newman run postman/Clinica-Backend-Semana2.postman_collection.json
```

---

## Estructura del proyecto

```
src/
├── config/env.ts              # carga y valida las variables de entorno
├── database/conexion.ts       # pool de mysql2 + ping para /health
├── controllers/               # reciben req/res y delegan en los services
├── services/                  # lógica de negocio + SQL parametrizado
│   └── dependencias.service.ts  # chequeo de FKs antes de un DELETE
├── middlewares/               # verificarToken, verificarRol, manejadorErrores
├── routes/                    # definición y montaje de rutas
├── validators/                # validación de los cuerpos de las peticiones
│   └── comunes.ts               # helpers compartidos por todos
├── utils/                     # respuesta uniforme, JWT, ErrorHttp
├── types/                     # interfaces de las entidades
└── index.ts                   # arranque de Express
scripts/
└── usuarios-prueba.sql        # contraseñas reales para poder loguearse
```

Convenciones: identificadores en español, replicando la nomenclatura de la base. Queries siempre parametrizadas con `?`. Controladores finos, lógica en los services. Todo el código documentado (ver `CLAUDE.md`, sección 4.1).
