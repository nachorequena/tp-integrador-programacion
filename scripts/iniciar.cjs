/**
 * INICIO AUTOMÁTICO DEL BACKEND (`npm run iniciar`)
 * ================================================
 *
 * Deja todo listo y levanta la API con un solo comando, pensado para la PC
 * donde se hace la defensa (recién clonado el repo). Hace, en orden:
 *
 *   1. `npm install` si todavía no están las dependencias.
 *   2. Crea el `.env` si no existe: detecta en qué puerto responde MySQL /
 *      MariaDB y pregunta solo lo que no puede adivinar (usuario y contraseña).
 *      Genera un `JWT_SECRET` aleatorio.
 *   3. Crea la base si no existe e importa, EN ORDEN:
 *        docs/clinica_ampliada.sql  → tablas y datos de la cátedra
 *        scripts/usuarios-prueba.sql → contraseñas reales
 *        scripts/datos-prueba.sql    → datos de la entrega final
 *      Si la base ya existía pero no tiene agenda para HOY (por ejemplo, se
 *      cargó otro día), vuelve a correr solo `datos-prueba.sql`, que agrega la
 *      agenda de los días nuevos sin duplicar nada.
 *   4. Controla que el puerto de la API esté libre.
 *   5. Levanta la API (`npm run dev`).
 *
 * Opciones:
 *   npm run iniciar -- --base-nueva   borra la base y la vuelve a crear desde cero
 *   (también existe el atajo `npm run base:reiniciar`).
 *
 * Con qué se conecta: lo invoca el script `iniciar` de `package.json`. Lee y
 * escribe `.env` (mismas variables que `src/config/env.ts`), ejecuta los tres
 * archivos SQL con `mysql2` y termina lanzando `src/index.ts` con `tsx`.
 *
 * Está en CommonJS (.cjs) y solo usa módulos de Node hasta después del paso 1:
 * así funciona aunque todavía no exista `node_modules`.
 */

const { spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const readline = require("node:readline");

const RAIZ = path.resolve(__dirname, "..");
const ARCHIVO_ENV = path.join(RAIZ, ".env");
const BASE_NUEVA = process.argv.includes("--base-nueva");
const SOLO_BASE = process.argv.includes("--solo-base");

/** Puertos habituales de MySQL/MariaDB (WAMP usa 3306, 3307 o 3308). */
const PUERTOS_MYSQL = [3306, 3308, 3307];

/** Imprime un paso con formato uniforme. */
function paso(texto) {
  console.log(`\n▶ ${texto}`);
}

/** Corta la ejecución con un mensaje claro. */
function abortar(texto) {
  console.error(`\n✖ ${texto}\n`);
  process.exit(1);
}

// ── 1. Dependencias ────────────────────────────────────────────────────────

function instalarDependencias() {
  if (fs.existsSync(path.join(RAIZ, "node_modules", "mysql2"))) return;
  paso("Instalando dependencias (npm install)...");
  // `shell: true` hace falta en Windows, donde npm es un .cmd. La entrada
  // estándar se ignora: npm no la necesita y, si la leyera, se comería las
  // respuestas a las preguntas que vienen después.
  const resultado = spawnSync("npm install", {
    cwd: RAIZ,
    stdio: ["ignore", "inherit", "inherit"],
    shell: true,
  });
  if (resultado.status !== 0) abortar("Falló npm install. Revisá la conexión a internet y la versión de npm.");
}

// ── 2. Archivo .env ────────────────────────────────────────────────────────

/** Variables sin las que el backend no arranca (ver `src/config/env.ts`). */
const OBLIGATORIAS = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"];

/**
 * Lee el .env a un objeto, con los mismos valores por defecto que
 * `src/config/env.ts` para las variables opcionales.
 *
 * Se interpreta con `dotenv.parse`, la MISMA función que usa el backend al
 * arrancar: comillas, comentarios y espacios se entienden exactamente igual.
 * Si el script y el backend leyeran distinto una contraseña, uno se conectaría
 * y el otro no. (`dotenv` ya está instalado: este paso corre después del
 * `npm install`.)
 *
 * @throws Error si falta alguna variable obligatoria, con su nombre.
 */
function leerEnv() {
  const leidos = require("dotenv").parse(fs.readFileSync(ARCHIVO_ENV, "utf8"));
  const valores = { PORT: "3000", DB_PORT: "3306", DB_PASSWORD: "" };
  for (const [clave, valor] of Object.entries(leidos)) {
    // Una variable opcional vacía conserva su valor por defecto (igual que el backend).
    if (valor !== "" || !(clave in valores)) valores[clave] = valor;
  }
  const faltantes = OBLIGATORIAS.filter((clave) => !valores[clave]);
  if (faltantes.length > 0) {
    throw new Error(
      `Al .env le faltan estas variables obligatorias: ${faltantes.join(", ")}. ` +
        "Usá .env.example como modelo (o borrá el .env y el script lo crea solo).",
    );
  }
  return valores;
}

/**
 * Prueba conectarse a MySQL en un puerto con un usuario y contraseña.
 *
 * @returns `true` si conecta.
 */
async function puedeConectar(mysql, host, puerto, usuario, password) {
  try {
    const conexion = await mysql.createConnection({
      host,
      port: puerto,
      user: usuario,
      password,
      connectTimeout: 2500,
    });
    await conexion.end();
    return true;
  } catch {
    return false;
  }
}

/** Crea el .env preguntando lo mínimo indispensable. */
async function crearEnv(mysql) {
  paso("No hay archivo .env: lo vamos a crear.");
  const consola = readline.createInterface({ input: process.stdin, output: process.stdout });
  // Se leen las respuestas con el iterador de líneas (que las guarda en orden)
  // y no con `question()`: así también funciona si las respuestas llegan todas
  // juntas por una tubería, no solo tipeadas en la terminal.
  const lineas = consola[Symbol.asyncIterator]();
  const preguntar = async (texto, porDefecto) => {
    process.stdout.write(`  ${texto} [${porDefecto}]: `);
    const { value, done } = await lineas.next();
    const respuesta = done ? "" : String(value).trim();
    return respuesta === "" ? porDefecto : respuesta;
  };

  const host = "127.0.0.1";
  let usuario = "root";
  let password = "";
  let puerto = null;

  // Primero se intenta lo más común (root sin contraseña) en los puertos
  // habituales: en WAMP/XAMPP recién instalados funciona sin preguntar nada.
  for (const candidato of PUERTOS_MYSQL) {
    if (await puedeConectar(mysql, host, candidato, usuario, password)) {
      puerto = candidato;
      break;
    }
  }

  if (puerto === null) {
    console.log("  No se pudo entrar a MySQL como root sin contraseña. Completá los datos:");
    puerto = Number(await preguntar("Puerto de MySQL", "3306"));
    usuario = await preguntar("Usuario de MySQL", "root");
    password = await preguntar("Contraseña de MySQL (vacía = sin contraseña)", "");
    if (!(await puedeConectar(mysql, host, puerto, usuario, password))) {
      consola.close();
      abortar(
        `No se pudo conectar a MySQL en ${host}:${puerto} con el usuario "${usuario}". ` +
          "¿Está encendido el servicio de MySQL (WAMP/XAMPP)? ¿Son correctos el puerto y la contraseña?",
      );
    }
  } else {
    console.log(`  MySQL encontrado en el puerto ${puerto} (usuario root, sin contraseña).`);
  }

  const nombreBase = await preguntar("Nombre de la base de datos", "clinica");
  consola.close();

  const contenido = [
    "PORT=3000",
    `DB_HOST=${host}`,
    `DB_PORT=${puerto}`,
    `DB_USER=${usuario}`,
    `DB_PASSWORD=${password}`,
    `DB_NAME=${nombreBase}`,
    // Secreto aleatorio: cada instalación firma sus propios tokens.
    `JWT_SECRET=${crypto.randomBytes(32).toString("hex")}`,
    "JWT_EXPIRES_IN=1d",
    "CORS_ORIGEN=http://localhost:4200",
    "",
  ].join("\n");
  fs.writeFileSync(ARCHIVO_ENV, contenido, "utf8");
  console.log("  .env creado.");
}

// ── 3. Base de datos ───────────────────────────────────────────────────────

/** Ejecuta un archivo .sql completo (varias sentencias) en la conexión. */
async function ejecutarArchivo(conexion, relativo) {
  const sql = fs.readFileSync(path.join(RAIZ, relativo), "utf8");
  await conexion.query(sql);
  console.log(`  ✓ ${relativo}`);
}

async function prepararBase(mysql, env) {
  const nombre = env.DB_NAME;
  if (!/^[A-Za-z0-9_]+$/.test(nombre)) abortar(`DB_NAME inválido en .env: "${nombre}"`);

  paso(`Preparando la base "${nombre}" en ${env.DB_HOST}:${env.DB_PORT}...`);
  let conexion;
  try {
    conexion = await mysql.createConnection({
      host: env.DB_HOST,
      port: Number(env.DB_PORT),
      user: env.DB_USER,
      password: env.DB_PASSWORD ?? "",
      charset: "utf8mb4",
      // Los scripts traen muchas sentencias seguidas; mysql2 las acepta solo
      // con esta opción.
      multipleStatements: true,
    });
  } catch (error) {
    abortar(
      `No se pudo conectar a MySQL (${env.DB_HOST}:${env.DB_PORT}, usuario ${env.DB_USER}). ` +
        `¿Está encendido WAMP/XAMPP? Detalle: ${error.message}`,
    );
  }

  if (BASE_NUEVA) {
    console.log("  --base-nueva: se borra la base y se crea desde cero.");
    await conexion.query(`DROP DATABASE IF EXISTS \`${nombre}\``);
  }

  const [existe] = await conexion.query(
    "SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema = ? AND table_name = 'usuario'",
    [nombre],
  );

  if (Number(existe[0].tablas) === 0) {
    await conexion.query(
      `CREATE DATABASE IF NOT EXISTS \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
    );
    await conexion.query(`USE \`${nombre}\``);
    console.log("  Base nueva: se importan los tres scripts en orden.");
    await ejecutarArchivo(conexion, "docs/clinica_ampliada.sql");
    await ejecutarArchivo(conexion, "scripts/usuarios-prueba.sql");
    await ejecutarArchivo(conexion, "scripts/datos-prueba.sql");
  } else {
    await conexion.query(`USE \`${nombre}\``);
    const [hoy] = await conexion.query("SELECT COUNT(*) AS rangos FROM agenda WHERE fecha = CURDATE()");
    if (Number(hoy[0].rangos) === 0) {
      // La agenda de prueba es relativa al día en que se cargó: si es de otro
      // día, se agrega la de hoy en adelante (el script no duplica nada).
      console.log("  La base existe pero no tiene agenda para hoy: se actualizan los datos de prueba.");
      await ejecutarArchivo(conexion, "scripts/datos-prueba.sql");
    } else {
      console.log("  La base ya existe y tiene agenda para hoy: no se toca.");
    }
  }

  await conexion.end();
}

// ── 4. Puerto de la API ────────────────────────────────────────────────────

/** Resuelve `true` si nadie está escuchando en el puerto. */
function puertoLibre(puerto) {
  return new Promise((resolver) => {
    const servidor = net.createServer();
    servidor.once("error", () => resolver(false));
    servidor.once("listening", () => servidor.close(() => resolver(true)));
    servidor.listen(puerto);
  });
}

// ── Programa principal ─────────────────────────────────────────────────────

async function main() {
  console.log("Clínica Virtual — inicio automático del backend");

  instalarDependencias();
  const mysql = require("mysql2/promise");

  if (!fs.existsSync(ARCHIVO_ENV)) await crearEnv(mysql);
  const env = leerEnv();

  await prepararBase(mysql, env);
  if (SOLO_BASE) {
    console.log("\n✓ Base lista.\n");
    return;
  }

  const puerto = Number(env.PORT || 3000);
  paso(`Verificando que el puerto ${puerto} esté libre...`);
  if (!(await puertoLibre(puerto))) {
    abortar(
      `El puerto ${puerto} está ocupado por otro programa. Cerralo, o cambiá PORT en .env ` +
        "y también apiUrl en src/environments/environment.ts del frontend (tienen que coincidir).",
    );
  }

  paso(`Levantando la API en http://localhost:${puerto} (Swagger en /docs). Ctrl+C para detenerla.`);
  const servidor = spawn("npm run dev", { cwd: RAIZ, stdio: "inherit", shell: true });
  servidor.on("exit", (codigo) => process.exit(codigo ?? 0));
}

main().catch((error) => abortar(error.message));
