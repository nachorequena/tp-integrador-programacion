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

En [postman/](postman/) hay dos, una por entrega:

| Archivo | Contenido |
| ------- | --------- |
| `Clinica-Backend-Semana1.postman_collection.json` | Autenticación: registro, login, perfil (14 requests) |
| `Clinica-Backend-Semana2.postman_collection.json` | CRUD de sedes, especialidades, coberturas y agenda (52 requests) |

Importarlas en Postman (**Import** → arrastrar el archivo) y ejecutar las carpetas **en orden**.

**Semana 2** — la carpeta `0. Autenticación` guarda los tokens de los cinco usuarios en variables de colección; el resto de las carpetas los usa. Es **idempotente**: todo lo que crea lo borra al final, así que se puede correr las veces que haga falta y siempre da verde.

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
