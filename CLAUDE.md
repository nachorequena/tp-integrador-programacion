# CLAUDE.md — TP Integrador: Sistema de Gestión de Turnos Médicos

> Archivo de contexto para Claude Code. **Leelo completo antes de escribir una sola línea.**
> Este documento manda por encima de cualquier suposición. Si algo del enunciado semanal
> contradice esto, avisá antes de proceder.

---

## 1. Contexto del proyecto

- **Materia:** Programación 2 — Proyecto integrador final de la carrera.
- **Qué es:** aplicación web para digitalizar la gestión de una clínica médica: usuarios, agenda médica y turnos de pacientes.
- **Dos etapas de 4 semanas cada una:**
  1. **Backend** (semanas 1–4): Node.js + Express + MySQL/MariaDB. ✅ **Terminado.**
  2. **Frontend** (semanas 5–8): Angular 21 + Angular Material, consumiendo esta API. **← estamos acá.** A la espera de la consigna de la semana 5.
- Las consignas se liberan **semana a semana**. Cada entrega se construye sobre la anterior.

### Documentos de referencia (leer antes de codear)

Las fuentes originales están en la carpeta `docs/` del repo. Ante cualquier duda sobre nombres, campos o alcance, **la fuente manda sobre lo que esté acá resumido**:

- `docs/Enunciado-General.docx.pdf` — reglas generales del TP (formato de respuesta, entregas, evaluación).
- `docs/Backend-semana-1.pdf` — consigna de la semana 1. ✅ entregada.
- `docs/Backend-semana-2.pdf` — consigna de la semana 2. ✅ entregada.
- `docs/Backend-semana 3.pdf` — consigna de la semana 3. ✅ entregada.
- `docs/Backend-semana 4.pdf` — consigna de la semana 4. ✅ entregada.
- `docs/clinica_ampliada.sql` — **script de la base. Es la fuente de verdad de los nombres exactos de tablas y columnas.** No inventes nombres: leé este archivo.

> ⚠️ Ojo al citar los archivos: los PDF de las semanas 1 y 2 usan guion (`Backend-semana-1.pdf`) y los de la 3 y 4 usan espacio (`Backend-semana 3.pdf`). Así llegaron; no se renombraron para no romper enlaces ya entregados.

> Cuando salga la consigna de una semana nueva, se agrega su PDF a `docs/` y se actualizan el alcance vigente (secciones 2 y 9) y la bitácora (14).

---

## 1.1 Cómo arrancar (leer primero)

### Setup local (lo hace el humano, una vez)

1. Tener Node.js LTS instalado.
2. Levantar MySQL/MariaDB y **crear la base primero**: el script **no** incluye `CREATE DATABASE` ni `USE` — solo crea tablas y las puebla.
   ```sql
   CREATE DATABASE clinica CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
   ```
   Después importar el script sobre esa base:
   ```bash
   mysql -u root -p clinica < docs/clinica_ampliada.sql
   ```
3. Copiar `.env.example` a `.env` y completar credenciales reales de la DB y el `JWT_SECRET`.
4. `npm install` y luego `npm run dev`.
5. Verificar `GET /health` antes de seguir.

### Primer prompt sugerido para Claude Code

> "Leé el `CLAUDE.md` completo y el PDF de la semana en `docs/` antes de empezar. Confirmame el plan (estructura, endpoints o pantallas, y orden de trabajo) y **esperá mi ok antes de escribir código**."

Esto fuerza a cargar el contexto y da un punto de control antes de generar nada, alineado con la regla de no adelantarse.

Para trabajar sobre el backend ya entregado, además conviene levantarlo y mirar
`GET /docs`: es más rápido que reconstruir la API leyendo el código.

---

## 2. 🚨 REGLA DE ORO: no adelantarse

El enunciado es explícito: cada entrega debe enfocarse **solo en lo que toca esa semana**, sin adelantarse.

- **No** implementes endpoints ni lógica de semanas futuras aunque la base ya tenga las tablas.
- Si tenés que crear estructura de carpetas o abstracciones "para después", hacelo solo si **no agrega complejidad hoy**.
- Ante la duda de si algo pertenece a esta semana: **preguntá antes de codear**.

**Alcance vigente:** 🏁 **El backend está cerrado.** Las cuatro semanas están entregadas y las 10 tablas de `clinica_ampliada.sql` están en uso. Ver el detalle en la sección 9.

Lo que sigue es la **etapa 2: frontend con Angular 21 + Angular Material (semanas 5–8)**, consumiendo esta API. Cuando salga esa consigna, la regla de oro se aplica igual: solo lo que pide la semana.

> **Sobre el backend ya entregado:** no se rehace ni se "mejora" por iniciativa propia. Cada rama `entrega-backend-N` es lo que evalúa el docente y tiene que quedar como está. Si el frontend necesita algo que la API no da, **preguntá antes de tocar el backend**: puede ser una mejora legítima o puede romper una entrega ya corregida.

---

## 3. Stack tecnológico (OBLIGATORIO — no sustituir sin autorización)

Columna "Origen": **enunciado** = impuesto por la cátedra, no se negocia. **grupo** = decisión nuestra, igual de obligatoria para Claude, pero si genera fricción en la corrección se puede replantear con el humano.

| Capa            | Tecnología                                                        | Origen    |
| --------------- | ----------------------------------------------------------------- | --------- |
| Runtime         | Node.js (LTS)                                                     | enunciado |
| Framework       | Express                                                           | enunciado |
| Lenguaje        | **TypeScript**                                                    | grupo     |
| Base de datos   | MySQL / MariaDB                                                   | enunciado |
| Acceso a datos  | **`mysql2` con SQL crudo (queries parametrizadas)** — NO usar ORM | grupo     |
| Auth            | JWT (`jsonwebtoken`)                                              | enunciado |
| Hash            | `bcrypt`                                                          | enunciado |
| Config          | `dotenv`                                                          | enunciado (`.env`) |
| Package manager | **npm** (el enunciado pide literal `npm run dev`)                 | enunciado |
| Doc de API      | Postman                                                           | enunciado |

**Dependencias base:** `express`, `mysql2`, `bcrypt`, `jsonwebtoken`, `dotenv`, `swagger-ui-express`
**Dev:** `typescript`, `tsx`, `@types/node`, `@types/express`, `@types/bcrypt`, `@types/jsonwebtoken`, `@types/swagger-ui-express`

> `swagger-ui-express` se sumó en la semana 4, autorizado por el humano: la consigna pide elegir entre Postman y Swagger para documentar la API, y se eligió Swagger. La spec OpenAPI se escribe a mano en `src/docs/openapi.ts` como objeto TypeScript, así no hace falta una dependencia extra para parsear YAML.

> **No agregues ninguna dependencia sin preguntar.** Si el build nativo de `bcrypt` falla en el entorno, avisá antes de cambiar a `bcryptjs`.

**Scripts de `package.json`:**

```json
{
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

---

## 4. Convenciones de código

- **Todo en español:** variables, funciones, carpetas, archivos, comentarios. Debe matchear la nomenclatura de la base de datos (`usuario`, `id_cobertura`, `fecha_nacimiento`, etc.).
- TypeScript **con tipos explícitos** en firmas de funciones, params de request y payloads. Nada de `any` salvo justificación.
- Definí interfaces en `src/types/` para las entidades (`Usuario`, `Sede`, `Cobertura`, `PayloadJWT`, etc.).
- Queries **siempre parametrizadas** (`?`), nunca concatenación de strings → evita SQL injection.
- Un archivo = una responsabilidad. Controladores finos, lógica en services.
- Async/await con try/catch; los errores suben al middleware manejador de errores.

### 4.1 📖 Documentación obligatoria (INNEGOCIABLE)

**Todo el código que escribas tiene que estar documentado.** El objetivo no es decorar: este es un TP de aprendizaje y el autor tiene que poder leer cualquier archivo y entender qué hace y por qué, sin tener que reconstruirlo mentalmente. También hay una defensa oral: si no se puede explicar, no sirve.

Reglas concretas:

1. **Cada archivo arranca con un bloque de cabecera** que diga qué responsabilidad tiene y en qué parte del flujo entra (ruta → controller → service → base).
2. **Cada función, clase o constante exportada lleva un bloque JSDoc** (`/** ... */`) con:
   - qué hace, en una frase;
   - `@param` de cada parámetro que no sea evidente;
   - `@returns` de lo que devuelve;
   - `@throws` si puede lanzar un `ErrorHttp` (con qué código y en qué caso).
   Usar JSDoc y no `//` sueltos, porque el editor lo muestra como tooltip al pasar el mouse.
3. **Las decisiones no obvias se explican con un comentario `//` que responda "por qué", no "qué".** El código ya dice qué hace; lo que se pierde con el tiempo es el motivo. Casos típicos acá: por qué `telefono` es obligatorio, por qué el mensaje de login es genérico, por qué la unicidad se valida en la app y no en la base.
4. **Las queries SQL llevan un comentario** si hacen algo más que un SELECT directo, o si la elección de columnas tiene una razón (por ejemplo, listar columnas explícitas para que nunca salga la `password`).
5. **No documentar lo obvio.** `// suma uno al contador` sobre `contador++` es ruido. Si el comentario solo repite el nombre de la función, sobra.
6. **Comentarios en español**, igual que el resto del código.
7. **Si cambiás código, actualizá su comentario en el mismo momento.** Un comentario que miente es peor que no tener comentario.

Ejemplo del nivel esperado:

```ts
/**
 * Busca un usuario por DNI incluyendo el hash de la contraseña.
 *
 * Devuelve la fila completa (con `password`) porque el login necesita el hash
 * para compararlo con bcrypt. Para cualquier otro uso va `buscarPublicoPorId`,
 * que no expone ese campo.
 *
 * @param dni DNI tal como lo mandó el cliente, ya validado.
 * @returns El usuario, o `null` si no existe ninguno con ese DNI.
 */
```

---

## 5. Estructura de carpetas

Un archivo por responsabilidad, con el mismo esqueleto en las cuatro semanas:
**ruta → controller → validator → service → base**. El sufijo dice el rol del
archivo, así que agregar una entidad es agregar los cinco archivos homónimos.

```
src/
├── config/
│   └── env.ts                    # carga y valida variables de entorno
├── database/                     # nombre literal que pide la consigna
│   └── conexion.ts               # pool de conexión mysql2
├── docs/
│   └── openapi.ts                # spec OpenAPI 3 de los 37 endpoints (semana 4)
├── controllers/                  # reciben req/res, delegan en services
│   ├── health.controller.ts      · auth.controller.ts
│   ├── sede.controller.ts        · especialidad.controller.ts
│   ├── cobertura.controller.ts   · agenda.controller.ts
│   ├── turno.controller.ts       · historial.controller.ts
│   ├── notificacion.controller.ts
│   ├── auditoria.controller.ts   · reporte.controller.ts
├── services/                     # lógica de negocio + acceso a datos (SQL)
│   ├── auth.service.ts           · usuario.service.ts
│   ├── sede.service.ts           · especialidad.service.ts
│   ├── cobertura.service.ts      · agenda.service.ts
│   ├── turno.service.ts          · historial.service.ts
│   ├── notificacion.service.ts
│   ├── auditoria.service.ts      · reporte.service.ts
│   └── dependencias.service.ts   # chequeo de FKs antes de un DELETE
├── middlewares/
│   ├── verificarToken.ts         # 401 si el JWT falta o es inválido
│   ├── verificarRol.ts           # 403 si el rol no está permitido
│   ├── auditoria.ts              # registra las acciones sensibles (semana 4)
│   └── manejadorErrores.ts       # captura final, formato uniforme
├── routes/
│   ├── index.ts                  # monta todas las rutas
│   ├── health.routes.ts          · auth.routes.ts
│   ├── sede.routes.ts            · especialidad.routes.ts
│   ├── cobertura.routes.ts       · agenda.routes.ts
│   ├── turno.routes.ts           · historial.routes.ts
│   ├── notificacion.routes.ts
│   ├── auditoria.routes.ts       · reporte.routes.ts
├── utils/
│   ├── respuesta.ts              # helper de respuesta uniforme
│   ├── errorHttp.ts              # error de negocio con código HTTP
│   └── jwt.ts                    # firmar/verificar tokens
├── validators/
│   ├── comunes.ts                # helpers compartidos (texto, fecha, hora, ids)
│   ├── auth.validators.ts        · entidades.validators.ts
│   ├── agenda.validators.ts      · turno.validators.ts
│   ├── historial.validators.ts
│   ├── auditoria.validators.ts   · reporte.validators.ts
├── types/
│   ├── index.ts                  # interfaces de todas las entidades
│   └── express.d.ts              # agrega req.usuario al Request de Express
└── index.ts                      # arranque de Express y orden de middlewares

postman/                          # una colección de pruebas por semana
scripts/
└── usuarios-prueba.sql           # contraseñas reales + 2do médico
docs/                             # consignas en PDF + script de la base
```

> La consigna pide textualmente `src/controllers`, `src/routes` y `src/database` ("o similar"). Se usan los tres con el nombre literal: cuesta cero y elimina cualquier objeción en la corrección.

**Orden de middlewares en `src/index.ts`** (importa, Express los recorre de arriba hacia abajo):

```
express.json() → /docs → auditar → rutas → 404 → manejadorErrores
```

`auditar` va antes de las rutas porque envuelve `res.json`, y el 404 y el manejador de errores van últimos porque son la red de contención.

---

## 6. 🔑 Formato de respuesta uniforme (INNEGOCIABLE)

**Todos** los endpoints —éxito y error, desde la semana 1— responden con esta estructura y **nunca** se arma a mano. Se usa siempre el helper.

```ts
// src/utils/respuesta.ts
import { Response } from "express";

export function responder(
  res: Response,
  codigo: number,
  estado: string,
  datos: unknown = null,
) {
  return res.status(codigo).json({ codigo, estado, datos });
}
```

- **`codigo`**: código HTTP numérico (200, 201, 400, 401, 403, 404, 409, 500…).
- **`estado`**: `"ok"` si salió bien; si falló, un **mensaje descriptivo del error** (string).
- **`datos`**: los datos solicitados, o `null` cuando no hay retorno.

**Éxito:**

```json
{ "codigo": 200, "estado": "ok", "datos": { "token": "..." } }
```

**Error:**

```json
{ "codigo": 409, "estado": "El DNI ya está registrado", "datos": null }
```

Consistencia total en todos los endpoints y todas las semanas. Esto se evalúa.

---

## 7. Base de datos

- Conexión vía **pool** de `mysql2/promise` en `src/database/conexion.ts`. Credenciales solo por `.env`.
- Probá la conexión con `GET /health` antes de avanzar con lo demás.
- **NO modifiques el script `clinica_ampliada.sql` provisto** salvo que se autorice explícitamente (ver punto de hashes abajo).

### ⚠️ Gotchas conocidos del script (tenerlos presentes)

1. **🚨 `telefono` es `NOT NULL` y NO tiene default.** La consigna no lo lista entre los datos del registro, pero **un `INSERT` sin `telefono` falla** con `Error 1364: Field 'telefono' doesn't have a default value` **en un servidor en modo estricto** (el default de MySQL 5.7+). Ver el gotcha 8: el WAMP de desarrollo NO está en modo estricto, así que este error no se reproduce localmente pero sí puede aparecer en la máquina del docente. Decisión tomada: **`telefono` se pide en el registro como campo requerido** (es dato razonable para una clínica y evita tocar el `.sql`). Se valida `varchar(10)`. Si el docente objeta que no está en la consigna, la alternativa es insertar `''`.
2. **Los hashes de contraseña del seed son FALSOS** (`'$2b$10$hashdeejemplo1'`). Ningún usuario cargado puede loguearse. Para probar login/roles:
   - Crear usuarios reales vía `POST /auth/registro` (quedan con rol `paciente`), **o**
   - Re-seedear con hashes bcrypt reales (esto sí requiere tocar datos; **preguntá antes**).
3. **No hay `UNIQUE` en `dni` ni `email` a nivel base**, pero la consigna exige que no se dupliquen. → La unicidad se valida **en la app** con un `SELECT` previo al `INSERT`. No agregues índices únicos al script sin autorización.
4. **Longitudes cortas — validarlas en la app antes de insertar:** `dni varchar(8)`, `email varchar(30)`, `telefono varchar(10)`, `nombre`/`apellido varchar(30)`, `rol varchar(20)`. `password varchar(255)` alcanza de sobra para un hash bcrypt (60 chars).
5. **PK/FK son `tinyint` → techo de 127 filas por tabla.** No lo cambies. Para `usuario` es irrelevante, pero desde la semana 4 **sí importa en `log_auditoria`**: se audita cada alta, baja y modificación, y un ciclo completo de las cuatro colecciones de Postman consume ~20 entradas. Al llegar a 127 los INSERT fallan. Por eso la escritura del log es **no fatal** (avisa por consola y la operación de negocio termina bien igual). El SQL para vaciarlo está en el README. `agenda` y `turno` también acumulan, más lento.
6. `fecha_nacimiento` es `date` → formato `YYYY-MM-DD`. Validar antes de insertar.
7. Las tablas son `utf8` (utf8mb3) `utf8_general_ci`. Configurá `charset: "utf8mb4"` en el pool para que los acentos no se rompan (`Martín`, `García`).
8. **⚠️ El WAMP local NO está en modo estricto** (`sql_mode = IGNORE_SPACE`), verificado en la semana 4. Consecuencias: pasarse del largo de una columna **trunca en silencio** en vez de dar el error 1406, y un `NOT NULL` sin default no siempre falla. **No confíes en la base para validar**: los largos se controlan en la app (ver los validators), porque la máquina del docente probablemente sí sea estricta y ahí lo que acá se trunca, allá revienta con un 500.

### Roles válidos (según el seed — no inventar otros)

`admin` · `operador` · `medico` · `paciente` — en minúscula y sin acentos, tal cual están en la columna `rol`. El registro público siempre asigna `paciente`.

---

## 8. Seguridad

- **Contraseñas siempre hasheadas con bcrypt.** Jamás texto plano, en ningún punto del flujo. Salt rounds: 10.
- **JWT** firmado con `JWT_SECRET` del `.env`. Payload mínimo: `id`, `rol`, `id_sede` (para pacientes va `null`).
  ```ts
  export interface PayloadJWT {
    id: number;
    rol: string;
    id_sede: number | null;
  }
  ```
- Secretos y credenciales **solo en `.env`** (que va en `.gitignore`). Incluí un `.env.example` versionado.

**Variables de entorno:**

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=clinica
JWT_SECRET=cambiar_este_secreto
JWT_EXPIRES_IN=1d
```

---

## 9. Alcance del backend (COMPLETO ✅)

Las cuatro semanas están entregadas. Cada una vive en su propia rama —así la
evalúa el docente— y `main` es el acumulado.

| Semana | Rama | Contenido | Pruebas |
| ------ | ---- | --------- | ------- |
| 1 | `entrega-backend-1` (en `main`) | Setup, conexión, JWT y middlewares | 36/36 |
| 2 | `entrega-backend-2` | CRUD de sedes, especialidades, coberturas y agenda | 86/86 |
| 3 | `entrega-backend-3` | Turnos, historial clínico y notificaciones | 142/142 |
| 4 | `entrega-backend-4` | Auditoría, reportes y documentación Swagger | 146/146 |

**37 endpoints en total.** El listado completo, con método, ruta, rol y cuerpo
esperado, está en dos lugares que sí conviene consultar antes que esta sección:

- **`GET /docs`** — Swagger UI, la documentación viva de la API.
- **`README.md`** — tablas de endpoints por semana, más las decisiones de diseño.

Las 10 tablas de `clinica_ampliada.sql` están en uso.

### 9.0 Semana 2 — ENTREGADA ✅ (referencia)

> Entregada en la rama **`entrega-backend-2`** (lo pide textualmente la consigna).

### Endpoints a entregar

**Sedes** — todos `verificarToken` + `verificarRol('admin')`

| Método | Ruta         | Descripción                                    |
| ------ | ------------ | ---------------------------------------------- |
| GET    | `/sedes`     | Listado (ya existía de la semana 1)            |
| POST   | `/sedes`     | Alta: `nombre`, `direccion`, `telefono`        |
| PUT    | `/sedes/:id` | Modificación                                   |
| DELETE | `/sedes/:id` | Baja, previa validación de dependencias        |

**Especialidades** — todos `admin`. `GET`, `POST`, `PUT/:id`, `DELETE/:id` sobre `/especialidades` (campo `descripcion`).

**Coberturas** — campo `nombre`

| Método | Ruta                      | Protección | Descripción                                  |
| ------ | ------------------------- | ---------- | -------------------------------------------- |
| GET    | `/coberturas/disponibles` | **pública** | Servicio de solo lectura para el registro   |
| GET    | `/coberturas`             | `admin`    | Listado del CRUD                             |
| POST   | `/coberturas`             | `admin`    | Alta                                         |
| PUT    | `/coberturas/:id`         | `admin`    | Modificación                                 |
| DELETE | `/coberturas/:id`         | `admin`    | Baja, previa validación de dependencias      |

> **Por qué dos rutas de listado.** El criterio de aceptación exige que los endpoints de coberturas sean accesibles *únicamente* por admin (403 para el resto), pero la consigna también pide un servicio de solo lectura reutilizable desde el registro, que es público. Ambas cosas no entran en la misma ruta: `/coberturas/disponibles` resuelve el registro y `/coberturas` cumple el 403. El nombre sale del propio enunciado ("liste las coberturas **disponibles**").

**Agenda** (`/agendas`) — `verificarToken` + `verificarRol('medico', 'operador', 'admin')`. El rol `paciente` recibe 403 en los cuatro.

| Método | Ruta            | Descripción                                                    |
| ------ | --------------- | -------------------------------------------------------------- |
| GET    | `/agendas`      | Listado filtrable por `id_medico`, `id_sede` y `fecha` (query)  |
| POST   | `/agendas`      | Alta de un rango horario                                        |
| PUT    | `/agendas/:id`  | Modificación                                                    |
| DELETE | `/agendas/:id`  | Baja, previa validación de turnos asociados                     |

No se implementa `GET /:id` de ningún recurso: la consigna pide alta, listado, modificación y baja.

### 🔒 Reglas de rol de la agenda (row-level, no alcanza `verificarRol`)

`verificarRol` solo mira el rol; la pertenencia de la fila se valida en el service:

- **POST** — un `medico` solo puede crear agenda con `id_medico` = su propio id; si manda otro → **403**. `operador`/`admin` pueden usar cualquiera.
- **PUT / DELETE** — se lee la fila primero: no existe → **404**; existe pero es de otro médico y el rol es `medico` → **403**.
- **GET** — al `medico` se le fuerza el filtro a su propio id, ignorando lo que venga por query. `operador`/`admin` filtran libremente.

### ⚠️ Validaciones de dependencia antes de borrar (INNEGOCIABLE)

El criterio de aceptación exige un error controlado, **nunca un 500**. La consigna lista menos dependencias de las que realmente existen en el script; las marcadas con 🔴 no están en el enunciado pero producen un error de FK si no se validan:

| DELETE de     | Bloqueado por                                             |
| ------------- | --------------------------------------------------------- |
| `sede`        | `usuario.id_sede`, `agenda.id_sede`                        |
| `especialidad`| `medico_especialidad.id_especialidad`, 🔴 `agenda.id_especialidad` |
| `cobertura`   | `usuario.id_cobertura`, 🔴 `turno.id_cobertura`            |
| `agenda`      | 🔴 `turno.id_agenda`                                       |

Todas responden **409** con un mensaje que indique qué la está usando.

### Validaciones de datos de la agenda

- `hora_entrada` / `hora_salida`: formato `HH:MM` (la columna es `varchar(5)`), y entrada **<** salida.
- `fecha`: `YYYY-MM-DD` y fecha real.
- `id_medico`: debe existir **y tener rol `medico`** (si no, se podría agendar a un paciente).
- `id_especialidad` e `id_sede`: deben existir.
- **Sin solapamiento**: se rechaza con 409 si el rango pisa otro del mismo médico en la misma fecha (en el `PUT` se excluye la propia fila). Un médico no puede estar en dos lugares a la vez.
- Varios rangos por día para el mismo médico están permitidos, siempre que no se solapen.

#### Criterios de aceptación de la semana 2 (cumplidos)

- [ ] El proyecto levanta con `npm run dev` sin errores.
- [ ] Sedes, especialidades y coberturas responden **403** a cualquier rol que no sea `admin`.
- [ ] El `medico` solo accede y modifica su propia agenda; el `operador` puede con cualquiera.
- [ ] No se puede eliminar sede, especialidad ni cobertura con dependencias: devuelve error controlado, **no 500**.
- [ ] Todas las respuestas (éxito y error) siguen el formato uniforme.
- [ ] Colección de Postman con los endpoints de esta entrega.
- [ ] Todo entregado en la rama `entrega-backend-2`.

### Datos del seed útiles para probar

- **Sede Norte (id 2)** no tiene usuarios ni agenda → sirve para el DELETE exitoso.
- **Sede Centro (id 1)**, **especialidad 1**, **cobertura 1** y **agenda 2** tienen dependencias → sirven para los cuatro 409.

---

### 9.1 Semana 1 — ENTREGADA ✅ (referencia)

#### Endpoints entregados

| Método | Ruta             | Protección                                 | Descripción                                                               |
| ------ | ---------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| GET    | `/health`        | pública                                    | Verifica que el servidor y la conexión a DB funcionen                     |
| GET    | `/coberturas`    | pública                                    | Lista las coberturas disponibles (necesario para el registro)             |
| POST   | `/auth/registro` | pública                                    | Alta de paciente                                                          |
| POST   | `/auth/login`    | pública                                    | Devuelve JWT                                                              |
| GET    | `/auth/perfil`   | `verificarToken`                           | Datos del usuario logueado (desde el token) → **prueba `verificarToken`** |
| GET    | `/sedes`         | `verificarToken` + `verificarRol('admin')` | Lista sedes → **prueba `verificarRol`**                                   |

> Los últimos dos existen para cumplir "al menos un endpoint protegido por cada middleware". `/sedes` usa solo la tabla `sede` (dentro del alcance).

#### `POST /auth/registro`

- Campos requeridos por la consigna: `nombre`, `apellido`, `dni`, `email`, `password`, `fecha_nacimiento`, `id_cobertura`.
- **+ `telefono`**: no está en la consigna, pero la columna es `NOT NULL` sin default → sin él el `INSERT` explota. Ver gotcha 1 de la sección 7.
- `id_cobertura` debe ser una cobertura existente (validar contra la base).
- Hashear `password` con bcrypt antes de guardar.
- Rol asignado automáticamente: **`paciente`**.
- Validar que `dni` y `email` **no estén duplicados** → responder 409 con mensaje claro si lo están.
- `id_sede` va `null` para pacientes.

#### `POST /auth/login`

- Recibe `dni` y `password`.
- Busca el usuario por `dni`, compara con `bcrypt.compare`.
- Si es correcto → devuelve JWT con `id`, `rol`, `id_sede`.
- Si falla → 401 con mensaje genérico (no revelar si el error es el dni o la contraseña).

#### `GET /auth/perfil`

- Protegido por `verificarToken`.
- Devuelve los datos del usuario logueado tomando el `id` del token (sin la `password`).

#### Middlewares

- **`verificarToken`**: valida que el JWT sea válido y no esté vencido. Si no → **401**. Inyecta el payload en `req` (p. ej. `req.usuario`).
- **`verificarRol(...rolesPermitidos)`**: verifica que `req.usuario.rol` esté entre los permitidos. Si no → **403**. Se usa siempre después de `verificarToken`.

#### ⚠️ Cómo probar el caso 200 de `verificarRol`

Los usuarios del seed **no pueden loguearse** (hashes falsos) y el registro público siempre crea `paciente`. Entonces:

- El caso **403** se prueba sin problema: token de un paciente registrado → `GET /sedes` → 403. ✅
- El caso **200** necesita un usuario `admin` real. Sin eso no se puede demostrar el happy path en la defensa.

Opciones (elegir **con el humano antes de ejecutar**, ninguna se hace por iniciativa propia):

1. `UPDATE usuario SET password = '<hash bcrypt real>' WHERE rol = 'admin';` — un `UPDATE` puntual, no toca el `.sql` provisto. **Preferida.**
2. Un script `npm run seed:admin` versionado que genere el hash y haga el `UPDATE`.

En cualquier caso: dejar documentadas las credenciales de prueba en el README (el enunciado exige llevar "credenciales de prueba" a la defensa).

#### Criterios de aceptación de la semana 1 (cumplidos)

- [ ] El proyecto levanta con `npm run dev` sin errores.
- [ ] Las contraseñas se guardan hasheadas en la base.
- [ ] El login devuelve un JWT válido, verificable con el secreto.
- [ ] Un endpoint protegido rechaza con **401** sin token o con token inválido.
- [ ] Un endpoint por rol rechaza con **403** a un rol no permitido.
- [ ] Registro valida `dni`/`email` duplicados.
- [ ] **Todas** las respuestas (éxito y error) siguen el formato uniforme.
- [ ] Colección de Postman con las pruebas de `registro`, `login` y `perfil`.

---

## 10. Manejo de errores

- Un middleware `manejadorErrores` centralizado, montado al final, que captura y responde con el formato uniforme (código 500 y mensaje genérico para lo inesperado; nunca filtrar stack traces al cliente).
- Los errores de validación / negocio (dni duplicado, credenciales inválidas, etc.) se responden con su código específico (400/401/403/409), no como 500.

---

## 11. Git y versionado

- Versionar desde el día 1. Commits chicos y descriptivos, en español.
- `.gitignore` con `node_modules`, `dist`, `.env`.
- La entrega es el **link al repositorio** en el aula virtual.

---

## 12. Entregables (todos cumplidos ✅)

La entrega es el **link al repositorio** en el aula virtual, apuntando a la rama
de esa semana.

| Semana | Rama | Entregado |
| ------ | ---- | --------- |
| 1 | `entrega-backend-1` (en `main`) | Backend inicializado; `/auth/registro`, `/auth/login` y `/auth/perfil` operativos; colección de Postman. |
| 2 | `entrega-backend-2` | CRUD de sedes, especialidades, coberturas y agenda, protegidos por rol; colección de Postman. |
| 3 | `entrega-backend-3` | Alta, cancelación y atención de turnos; historial clínico; notificaciones; colección de Postman. |
| 4 | `entrega-backend-4` | Auditoría automática y su consulta; los cuatro reportes con rango de fechas; documentación Swagger en `/docs`; colección de Postman. |

Las cuatro colecciones están en `postman/`, una por semana.

> **Para la defensa:** hay que llevar credenciales de prueba (están en el
> README) y conviene resetear `log_auditoria` antes, porque tiene tope de 127
> filas. El SQL para vaciarlo está en el README.

---

## 13. Qué NO hacer (guardrails)

- ❌ No rehacer ni "mejorar" lo ya entregado por iniciativa propia. Las cuatro ramas `entrega-backend-N` son lo que evalúa el docente. Si algo hay que cambiar, **preguntá primero**.
- ❌ No usar ORM. SQL crudo con `mysql2`.
- ❌ No dejar contraseñas en texto plano en ningún lado.
- ❌ No armar respuestas fuera del helper `responder`.
- ❌ No agregar dependencias sin preguntar.
- ❌ No modificar el `.sql` provisto sin autorización.
- ❌ No identificadores en inglés.
- ❌ No hardcodear secretos ni credenciales.

---

## 14. Bitácora de progreso (actualizar al final de cada sesión)

> Mantené esta sección al día para conservar contexto entre sesiones de Claude Code.
> Semanas más recientes arriba.

**Semana en curso:** Semana 4 ✅ entregada. **Backend completo.** **Pendiente:** etapa 2, frontend con Angular (semanas 5-8).

### Semana 4 — Auditoría, reportes y cierre

- **Estado:** ✅ Completa y verificada end-to-end. **146/146 asserts** en verde (50 requests). Sin regresiones: semana 1 **36/36**, semana 2 **86/86**, semana 3 **142/142**.
- **Rama:** `entrega-backend-4`.
- **Hecho:**
  - Auditoría automática vía middleware (`src/middlewares/auditoria.ts`), montado una sola vez. Cero código de auditoría en controllers y services, como exige el criterio.
  - `GET /auditoria` con filtros por usuario, entidad y rango de fechas, solo admin.
  - Los cuatro reportes con filtro por rango de fechas, solo admin.
  - Swagger UI en `GET /docs` documentando los 37 endpoints de las cuatro semanas.
  - Colección de Postman de la semana 4, idempotente (verificada con dos corridas seguidas).
- **Notas / decisiones tomadas:**
  - **Tabla explícita de rutas auditadas, no mapeo por verbo HTTP.** El verbo no alcanza: los turnos se cancelan y atienden con `PATCH` (acciones distintas con el mismo método), y `PATCH /notificaciones/:id/leida` también es `PATCH` y no debe auditarse. Agregar un endpoint al log es agregar un renglón a esa tabla.
  - **Se audita agenda y turno además de las cuatro entidades del entregable.** Decisión del grupo: son los movimientos más frecuentes y sin ellos el log queda ciego justo donde más pasa.
  - **`cancelar` se registra como `BAJA` y `atender` como `MODIFICACION`.** Un turno cancelado deja de estar vigente aunque la fila siga existiendo.
  - **En el registro público el actor del log es el propio usuario creado.** No hay token, y la columna `id_usuario` es NOT NULL con FK. Verificado: `id_entidad` e `id_usuario` coinciden en esa entrada.
  - **⚠️ `log_auditoria.id` es `tinyint`: tope de 127 filas.** Se optó por NO tocar el esquema y hacer la escritura **no fatal** (avisa por consola, la operación de negocio termina bien). Un ciclo completo de las cuatro colecciones consume ~20 entradas. El SQL para vaciarlo está en el README.
  - **No se lee `req.params` en el middleware.** Los controllers son `async`, y para cuando llaman a `res.json` Express puede haber restaurado los params de la capa exterior. Se parsea `req.originalUrl`, que es determinista.
  - **Swagger sobre Postman** para la documentación, autorizado por el humano (agrega `swagger-ui-express` y sus tipos). La spec es un objeto TypeScript, no un YAML: evita una tercera dependencia y la valida el compilador.
  - **Los reportes se calculan en el momento**, sin tablas ni columnas derivadas. Por eso cancelar un turno mueve la tasa en la consulta siguiente sin ningún paso intermedio, que es justo lo que pide el punto de cierre.
  - **Los reportes usan `LEFT JOIN` desde la entidad, no `INNER JOIN` desde `turno`**, para que una sede o especialidad sin movimiento aparezca con 0 en vez de desaparecer. El filtro de fechas va en el `ON` y no en el `WHERE`: en un LEFT JOIN, una condición sobre la tabla derecha puesta en el WHERE lo convierte en un INNER.

### Semana 3 — Turnos, historial clínico y notificaciones

- **Estado:** ✅ Completa y verificada end-to-end. **142/142 asserts** en verde (56 requests), más **86/86** de la semana 2 sin regresiones.
- **Rama:** `entrega-backend-3`. La escribió el compañero; esta sesión la corrigió.
- **Hecho por el compañero:** los 11 endpoints de la consigna (turnos, historial, notificaciones), con la lógica de negocio correcta.
- **Corregido en esta sesión:**
  - **La rama salía de la semana 1, no de la 2.** El entregable pide el proyecto "actualizado sobre la base de la semana 2", y sin el CRUD de agenda no se puede cargar un rango horario contra el cual reservar: la entrega no se podía demostrar sola. Se mergeó `main` (2 conflictos: `routes/index.ts` y `types/index.ts`).
  - **`src/index.ts` auto-mergeaba sin conflicto y se comía la documentación.** Ojo con esto si vuelve a pasar: git no avisa. Se recuperó la versión de `main`.
  - **Faltaba la colección de Postman**, que la consigna pide nominalmente con tres casos. Se armó de cero: 56 requests, idempotente (verificado con tres corridas seguidas sin limpiar).
  - **Faltaban los validators.** Se agregaron `turno.validators.ts` e `historial.validators.ts`, siguiendo el patrón de `comunes.ts`.
- **Notas / decisiones tomadas:**
  - **El rol `admin` NO participa de la semana 3.** La consigna enumera qué rol usa cada endpoint y no lo nombra en ninguno. Se decidió no dárselo, a diferencia de la agenda en la semana 2 (ahí tampoco lo nombraba, pero era incoherente que administrara sedes y no pudiera ver una agenda).
  - **La superposición de turnos se detecta por hora exacta**, no por duración: la tabla `turno` no tiene columna de duración. Alcanza con mirar la misma agenda **porque la semana 2 ya prohíbe rangos solapados** del mismo médico y fecha. Buen punto para la defensa: sin la semana 2, este chequeo tendría agujeros.
  - **El historial se carga como paso posterior a la atención** (la consigna admite las dos variantes); quedan asociados por `historial_clinico.id_turno`.
  - **⚠️ El WAMP local NO está en modo estricto** (`sql_mode = IGNORE_SPACE`). Consecuencia: pasarse del largo de una columna **trunca en silencio** en vez de dar error 1406. La máquina del docente probablemente sí sea estricta, así que los largos se validan en la app. Esto también significa que el gotcha 1 de la sección 7 (`telefono` NOT NULL → error 1364) no se reproduce localmente.
  - **Dos hallazgos de la revisión inicial eran falsos** y se corrigieron tras verificar contra la base: ni el campo faltante ni la nota larga daban 500. El que sí era real: `"9:00"` sin cero adelante se rechazaba como "horario no disponible", porque las horas se comparan como texto.

### Semana 2 — CRUD de sedes, especialidades, coberturas y agenda

- **Estado:** ✅ Completa y verificada end-to-end. **86/86 asserts** en verde (52 requests), más **36/36** de la semana 1 sin regresiones.
- **Rama:** `entrega-backend-2`, como exige la consigna.
- **Hecho:**
  - 16 endpoints nuevos: CRUD completo de sedes, especialidades, coberturas y agenda.
  - Validación de dependencias antes de cada `DELETE`, cubriendo **todas** las FKs reales (409, nunca 500).
  - Reglas de rol de la agenda: el médico solo la propia (validación por fila en el service), operador y admin cualquiera, paciente 403.
  - Control de solapamiento de rangos horarios por médico y fecha.
  - `scripts/usuarios-prueba.sql` versionado e idempotente (verificado corriéndolo dos veces).
  - Colección de Postman de la semana 2, idempotente (verificado con dos corridas seguidas sin limpiar).
- **Notas / decisiones tomadas:**
  - **`administrador` del PDF = `admin` en la base.** La consigna escribe "administrador" pero el seed carga `admin`; manda la base. Documentado por si el docente objeta.
  - **`GET /coberturas` dejó de ser público.** El criterio de aceptación exige 403 para todo rol que no sea admin, pero la consigna también pide un listado de solo lectura para el registro (que es público). No entran en la misma ruta: el público pasó a `GET /coberturas/disponibles` y se actualizó la colección de la semana 1.
  - **El `admin` puede gestionar agenda igual que el `operador`.** La consigna no lo menciona; se decidió así porque sería incoherente que administre sedes y especialidades pero no pueda ver una agenda.
  - **Se rechazan los rangos solapados** (409). La consigna solo pide permitir varios por día; los contiguos (08:00-12:00 y 12:00-16:00) sí se aceptan.
  - **Segundo médico (Carlos Ruiz, dni 25333444)** agregado por el script de pruebas. El seed trae uno solo y con un único médico es imposible demostrar el criterio "el médico solo modifica su propia agenda".
  - La consigna lista **menos dependencias de las que existen**: faltan `agenda.id_especialidad`, `turno.id_cobertura` y `turno.id_agenda`. Se validan igual, porque si no el `DELETE` termina en un 500.
  - De `turno` (semana 3+) solo se hace `SELECT COUNT(*)` para las dependencias. Nada más.

### Semana 1 — Setup, conexión y autenticación

- **Estado:** ✅ Completa y verificada end-to-end (46/46 pruebas manuales contra la base real).
- **Hecho:**
  - Proyecto inicializado: Express 5 + TypeScript 7, scripts `dev`/`build`/`start` funcionando.
  - Base `clinica` creada en el MySQL 8.3 de WAMP e importado `clinica_ampliada.sql` (10 tablas, seed cargado).
  - Los 6 endpoints del alcance operativos: `/health`, `/coberturas`, `/auth/registro`, `/auth/login`, `/auth/perfil`, `/sedes`.
  - Middlewares `verificarToken` (401), `verificarRol` (403) y `manejadorErrores` centralizado.
  - Formato uniforme verificado en éxito Y error, incluidos 404 y JSON mal formado.
  - Colección de Postman en `postman/` (guarda el JWT solo) y `README.md` con setup y credenciales.
- **Pendiente:** nada de la semana 1. Esperar la consigna de la semana 2.
- **Notas / decisiones tomadas:**
  - **`telefono` es obligatorio en el registro.** La columna es `NOT NULL` sin default: sin el campo, el `INSERT` falla con `Error 1364`. Se prefirió pedirlo antes que tocar el `.sql` de la cátedra.
  - **Admin de prueba:** se ejecutó `UPDATE usuario SET password = <hash real> WHERE dni = '18222333'` para poder demostrar el caso 200 de `verificarRol`. No se modificó el script provisto. Credenciales en el README.
  - **Login devuelve `{ token, usuario }`**, no solo el token: evita una segunda llamada desde el frontend en la etapa 2.
  - `dateStrings: true` en el pool → `fecha_nacimiento` viaja como `"YYYY-MM-DD"` sin corrimientos de zona horaria.
  - Los usuarios del seed (hashes falsos) responden **401 limpio** en el login: `bcrypt.compare` devuelve `false` con un hash mal formado, no lanza.
  - Entorno local: el Node real es `C:\Program Files\nodejs\node.exe` (v24). Hay un archivo vacío `C:\WINDOWS\system32\node` que lo tapa en la terminal; `npm` no se ve afectado.
