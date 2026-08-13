# TP Integrador — Sistema de Gestión de Turnos Médicos (Backend)

Programación 2 — Backend, **Semana 1**: setup, conexión a la base y autenticación con JWT.

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

### 2. Configurar el entorno

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

### 3. Instalar y levantar

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

| Método | Ruta             | Protección                        | Descripción                              |
| ------ | ---------------- | --------------------------------- | ---------------------------------------- |
| GET    | `/health`        | pública                           | Estado del servidor y de la base         |
| GET    | `/coberturas`    | pública                           | Coberturas disponibles para el registro  |
| POST   | `/auth/registro` | pública                           | Alta de paciente                         |
| POST   | `/auth/login`    | pública                           | Devuelve el JWT                          |
| GET    | `/auth/perfil`   | `verificarToken`                  | Datos del usuario logueado               |
| GET    | `/sedes`         | `verificarToken` + `verificarRol('admin')` | Listado de sedes                |

### `POST /auth/registro`

```json
{
  "nombre": "Paciente",
  "apellido": "DePrueba",
  "dni": "40123456",
  "email": "paciente.prueba@test.com",
  "password": "secreto123",
  "telefono": "3424111000",
  "fecha_nacimiento": "1999-05-20",
  "id_cobertura": 1
}
```

- El rol se asigna automáticamente como `paciente` e `id_sede` queda en `null`.
- La contraseña se guarda hasheada con bcrypt (10 salt rounds). Nunca vuelve en la respuesta.
- `dni` y `email` duplicados → **409**.
- `id_cobertura` inexistente → **400**.

> ⚠️ **`telefono` no figura en la consigna**, pero la columna `usuario.telefono` es `NOT NULL` y no tiene valor por defecto en el script provisto: un `INSERT` sin ese campo falla con `Error 1364`. Por eso se pide como campo obligatorio, en vez de modificar el `.sql` de la cátedra.

### `POST /auth/login`

```json
{ "dni": "40123456", "password": "secreto123" }
```

Devuelve el token y los datos públicos del usuario:

```json
{
  "codigo": 200,
  "estado": "ok",
  "datos": {
    "token": "eyJhbGciOi...",
    "usuario": { "id": 5, "nombre": "Paciente", "rol": "paciente", "id_sede": null }
  }
}
```

El payload del JWT contiene `id`, `rol` e `id_sede`. Credenciales incorrectas → **401** con mensaje genérico (no se revela si falló el dni o la contraseña).

### Middlewares

- **`verificarToken`** — valida firma y vencimiento del JWT del header `Authorization: Bearer <token>`. Si falta, es inválido o expiró → **401**. Deja el payload en `req.usuario`.
- **`verificarRol(...roles)`** — valida que `req.usuario.rol` esté entre los permitidos → si no, **403**. Se monta siempre después de `verificarToken`.

---

## Credenciales de prueba

Los usuarios que vienen en el script tienen **hashes de contraseña falsos** (`$2b$10$hashdeejemplo1`), así que **ninguno puede loguearse**: el login les responde 401. Para probar el sistema hay que crear usuarios reales.

### Paciente

Registrar uno con `POST /auth/registro` (queda con rol `paciente`). El de la colección de Postman:

| DNI        | Contraseña   |
| ---------- | ------------ |
| `40123456` | `secreto123` |

### Usuario admin de prueba

El registro público solo crea pacientes, así que para probar el caso exitoso de `verificarRol` en `GET /sedes` hace falta cargarle un hash real al admin del seed (Marcos Gomez, DNI `18222333`).

Generar el hash:

```bash
node -e "console.log(require('bcrypt').hashSync('admin123', 10))"
```

Y aplicarlo:

```sql
UPDATE usuario SET password = '<hash generado>' WHERE dni = '18222333';
```

Esto **no modifica el script provisto**: es un `UPDATE` puntual sobre los datos ya cargados.

| DNI        | Contraseña | Rol     |
| ---------- | ---------- | ------- |
| `18222333` | `admin123` | `admin` |

---

## Colección de Postman

En [postman/](postman/) está `Clinica-Backend-Semana1.postman_collection.json`. Importarla en Postman y ejecutar las carpetas en orden (1 → 6).

- El request de **login guarda el JWT automáticamente** en la variable de colección `token`; los endpoints protegidos ya lo usan.
- La variable `baseUrl` apunta a `http://localhost:3000`.
- Incluye los casos negativos que pide el enunciado: 400 de validación, 409 de duplicados, 401 sin token / token inválido y 403 por rol.

---

## Estructura del proyecto

```
src/
├── config/env.ts              # carga y valida las variables de entorno
├── database/conexion.ts       # pool de mysql2 + ping para /health
├── controllers/               # reciben req/res y delegan en los services
├── services/                  # lógica de negocio + SQL parametrizado
├── middlewares/               # verificarToken, verificarRol, manejadorErrores
├── routes/                    # definición y montaje de rutas
├── validators/                # validación de los cuerpos de las peticiones
├── utils/                     # respuesta uniforme, JWT, ErrorHttp
├── types/                     # interfaces de las entidades
└── index.ts                   # arranque de Express
```

Convenciones: identificadores en español, replicando la nomenclatura de la base. Queries siempre parametrizadas con `?`. Controladores finos, lógica en los services.
