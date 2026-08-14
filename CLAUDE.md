# CLAUDE.md — TP Integrador: Sistema de Gestión de Turnos Médicos

> Archivo de contexto para Claude Code. **Leelo completo antes de escribir una sola línea.**
> Este documento manda por encima de cualquier suposición. Si algo del enunciado semanal
> contradice esto, avisá antes de proceder.

---

## 1. Contexto del proyecto

- **Materia:** Programación 2 — Proyecto integrador final de la carrera.
- **Qué es:** aplicación web para digitalizar la gestión de una clínica médica: usuarios, agenda médica y turnos de pacientes.
- **Dos etapas de 4 semanas cada una:**
  1. **Backend** (semanas 1–4): Node.js + Express + MySQL/MariaDB. **← estamos acá.**
  2. **Frontend** (semanas 5–8): Angular 21 + Angular Material, consumiendo esta API. **Fuera de alcance por ahora.**
- Las consignas se liberan **semana a semana**. Cada entrega se construye sobre la anterior.

### Documentos de referencia (leer antes de codear)

Las fuentes originales están en la carpeta `docs/` del repo. Ante cualquier duda sobre nombres, campos o alcance, **la fuente manda sobre lo que esté acá resumido**:

- `docs/Enunciado-General.docx.pdf` — reglas generales del TP (formato de respuesta, entregas, evaluación).
- `docs/Backend-semana-1.pdf` — consigna de la semana 1 (entregada).
- `docs/Backend-semana-2.pdf` — **consigna de la semana en curso.**
- `docs/clinica_ampliada.sql` — **script de la base. Es la fuente de verdad de los nombres exactos de tablas y columnas.** No inventes nombres: leé este archivo.

> Cuando salga la consigna de la semana siguiente, se agrega su PDF a `docs/` y se actualiza la sección de alcance vigente (9) y la bitácora (14).

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

> "Leé el `CLAUDE.md` completo y los PDFs de `docs/` antes de empezar. Confirmame el plan de la semana 1 (estructura de carpetas, endpoints y orden de trabajo) y **esperá mi ok antes de escribir código**."

Esto fuerza a cargar el contexto y da un punto de control antes de generar nada, alineado con la regla de no adelantarse.

---

## 2. 🚨 REGLA DE ORO: no adelantarse

El enunciado es explícito: cada entrega debe enfocarse **solo en lo que toca esa semana**, sin adelantarse.

- **No** implementes tablas, endpoints ni lógica de semanas futuras aunque la base de datos ya las tenga.
- La base `clinica_ampliada.sql` incluye 10 tablas. Acumulado hasta la semana 2 se usan **`usuario`, `sede`, `cobertura`, `especialidad`, `medico_especialidad` y `agenda`**.
- **`turno` es semana 3+**: la única interacción permitida hoy es un `SELECT` de existencia para validar dependencias antes de un `DELETE` (sin esa lectura, el borrado revienta con un error de FK → 500, que el criterio de aceptación prohíbe). Nada de CRUD de turnos.
- `historial_clinico`, `log_auditoria` y `notificacion` no se tocan.
- Si tenés que crear estructura de carpetas o abstracciones "para después", hacelo solo si **no agrega complejidad hoy**.
- Ante la duda de si algo pertenece a esta semana: **preguntá antes de codear**.

**Alcance vigente:** Semana 2 (CRUD de sedes, especialidades, coberturas y agenda). Ver sección 9.

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

**Dependencias base:** `express`, `mysql2`, `bcrypt`, `jsonwebtoken`, `dotenv`
**Dev:** `typescript`, `tsx`, `@types/node`, `@types/express`, `@types/bcrypt`, `@types/jsonwebtoken`

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

```
src/
├── config/
│   └── env.ts             # carga y valida variables de entorno
├── database/              # nombre literal que pide la consigna
│   └── conexion.ts        # pool de conexión mysql2
├── controllers/           # reciben req/res, delegan en services
│   ├── auth.controller.ts
│   ├── cobertura.controller.ts
│   ├── sede.controller.ts
│   └── health.controller.ts
├── services/              # lógica de negocio + acceso a datos (SQL)
│   ├── auth.service.ts
│   ├── usuario.service.ts
│   ├── cobertura.service.ts
│   └── sede.service.ts
├── middlewares/
│   ├── verificarToken.ts
│   ├── verificarRol.ts
│   └── manejadorErrores.ts
├── routes/
│   ├── index.ts           # monta todas las rutas
│   ├── auth.routes.ts
│   ├── cobertura.routes.ts
│   ├── sede.routes.ts
│   └── health.routes.ts
├── utils/
│   ├── respuesta.ts       # helper de respuesta uniforme
│   └── jwt.ts             # firmar/verificar tokens
├── validators/
│   └── auth.validators.ts # validaciones de registro/login
├── types/
│   └── index.ts
└── index.ts               # arranque de Express
```

> La consigna pide textualmente `src/controllers`, `src/routes` y `src/database` ("o similar"). Se usan los tres con el nombre literal: cuesta cero y elimina cualquier objeción en la corrección.

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

1. **🚨 `telefono` es `NOT NULL` y NO tiene default.** La consigna no lo lista entre los datos del registro, pero **un `INSERT` sin `telefono` falla** con `Error 1364: Field 'telefono' doesn't have a default value` (modo estricto, default en MySQL 5.7+). Decisión tomada: **`telefono` se pide en el registro como campo requerido** (es dato razonable para una clínica y evita tocar el `.sql`). Se valida `varchar(10)`. Si el docente objeta que no está en la consigna, la alternativa es insertar `''`.
2. **Los hashes de contraseña del seed son FALSOS** (`'$2b$10$hashdeejemplo1'`). Ningún usuario cargado puede loguearse. Para probar login/roles:
   - Crear usuarios reales vía `POST /auth/registro` (quedan con rol `paciente`), **o**
   - Re-seedear con hashes bcrypt reales (esto sí requiere tocar datos; **preguntá antes**).
3. **No hay `UNIQUE` en `dni` ni `email` a nivel base**, pero la consigna exige que no se dupliquen. → La unicidad se valida **en la app** con un `SELECT` previo al `INSERT`. No agregues índices únicos al script sin autorización.
4. **Longitudes cortas — validarlas en la app antes de insertar:** `dni varchar(8)`, `email varchar(30)`, `telefono varchar(10)`, `nombre`/`apellido varchar(30)`, `rol varchar(20)`. `password varchar(255)` alcanza de sobra para un hash bcrypt (60 chars).
5. PK/FK son `tinyint`: correcto para el alcance académico, no lo cambies. (Implica un techo de 127 usuarios; irrelevante para el TP.)
6. `fecha_nacimiento` es `date` → formato `YYYY-MM-DD`. Validar antes de insertar.
7. Las tablas son `utf8` (utf8mb3) `utf8_general_ci`. Configurá `charset: "utf8mb4"` en el pool para que los acentos no se rompan (`Martín`, `García`).

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

## 9. Alcance de la SEMANA 2 (VIGENTE)

> Entregable en la rama **`entrega-backend-2`** (lo pide textualmente la consigna).

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

### Criterios de aceptación (checklist de la semana 2)

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

## 9.1 Semana 1 — ENTREGADA ✅ (referencia)

### Endpoints entregados

| Método | Ruta             | Protección                                 | Descripción                                                               |
| ------ | ---------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| GET    | `/health`        | pública                                    | Verifica que el servidor y la conexión a DB funcionen                     |
| GET    | `/coberturas`    | pública                                    | Lista las coberturas disponibles (necesario para el registro)             |
| POST   | `/auth/registro` | pública                                    | Alta de paciente                                                          |
| POST   | `/auth/login`    | pública                                    | Devuelve JWT                                                              |
| GET    | `/auth/perfil`   | `verificarToken`                           | Datos del usuario logueado (desde el token) → **prueba `verificarToken`** |
| GET    | `/sedes`         | `verificarToken` + `verificarRol('admin')` | Lista sedes → **prueba `verificarRol`**                                   |

> Los últimos dos existen para cumplir "al menos un endpoint protegido por cada middleware". `/sedes` usa solo la tabla `sede` (dentro del alcance).

### `POST /auth/registro`

- Campos requeridos por la consigna: `nombre`, `apellido`, `dni`, `email`, `password`, `fecha_nacimiento`, `id_cobertura`.
- **+ `telefono`**: no está en la consigna, pero la columna es `NOT NULL` sin default → sin él el `INSERT` explota. Ver gotcha 1 de la sección 7.
- `id_cobertura` debe ser una cobertura existente (validar contra la base).
- Hashear `password` con bcrypt antes de guardar.
- Rol asignado automáticamente: **`paciente`**.
- Validar que `dni` y `email` **no estén duplicados** → responder 409 con mensaje claro si lo están.
- `id_sede` va `null` para pacientes.

### `POST /auth/login`

- Recibe `dni` y `password`.
- Busca el usuario por `dni`, compara con `bcrypt.compare`.
- Si es correcto → devuelve JWT con `id`, `rol`, `id_sede`.
- Si falla → 401 con mensaje genérico (no revelar si el error es el dni o la contraseña).

### `GET /auth/perfil`

- Protegido por `verificarToken`.
- Devuelve los datos del usuario logueado tomando el `id` del token (sin la `password`).

### Middlewares

- **`verificarToken`**: valida que el JWT sea válido y no esté vencido. Si no → **401**. Inyecta el payload en `req` (p. ej. `req.usuario`).
- **`verificarRol(...rolesPermitidos)`**: verifica que `req.usuario.rol` esté entre los permitidos. Si no → **403**. Se usa siempre después de `verificarToken`.

### ⚠️ Cómo probar el caso 200 de `verificarRol`

Los usuarios del seed **no pueden loguearse** (hashes falsos) y el registro público siempre crea `paciente`. Entonces:

- El caso **403** se prueba sin problema: token de un paciente registrado → `GET /sedes` → 403. ✅
- El caso **200** necesita un usuario `admin` real. Sin eso no se puede demostrar el happy path en la defensa.

Opciones (elegir **con el humano antes de ejecutar**, ninguna se hace por iniciativa propia):

1. `UPDATE usuario SET password = '<hash bcrypt real>' WHERE rol = 'admin';` — un `UPDATE` puntual, no toca el `.sql` provisto. **Preferida.**
2. Un script `npm run seed:admin` versionado que genere el hash y haga el `UPDATE`.

En cualquier caso: dejar documentadas las credenciales de prueba en el README (el enunciado exige llevar "credenciales de prueba" a la defensa).

### Criterios de aceptación (checklist de la semana)

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

## 12. Entregables de la semana 2

1. Repositorio actualizado sobre la base de la semana 1, **en la rama `entrega-backend-2`**.
2. CRUD de sedes, especialidades, coberturas y agenda médica, protegidos por rol.
3. Colección de Postman de estos endpoints (exportada al repo, carpeta `postman/`).

<details>
<summary>Entregables de la semana 1 (cumplidos)</summary>

1. Repositorio con el backend inicializado y funcionando.
2. Endpoints `POST /auth/registro`, `POST /auth/login`, `GET /auth/perfil` operativos.
3. Colección de Postman con las pruebas de esos tres endpoints.

</details>

---

## 13. Qué NO hacer (guardrails)

- ❌ No implementar turnos, historial clínico, notificaciones ni auditoría (semanas futuras). **La agenda sí entra desde la semana 2.**
- ❌ De `turno` solo se lee para validar dependencias antes de un `DELETE`. Nada de altas, bajas ni modificaciones de turnos.
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

- **Semana en curso:** Semana 1 — Setup, conexión y autenticación.
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
