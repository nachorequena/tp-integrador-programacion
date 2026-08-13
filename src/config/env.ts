/**
 * CONFIGURACIÓN DEL ENTORNO
 * =========================
 *
 * Lee el archivo `.env` y expone sus valores ya validados y convertidos al tipo
 * correcto, a través del objeto `entorno`.
 *
 * ¿Por qué existe este archivo en vez de usar `process.env` directamente en
 * cada módulo?
 *
 *   1. `process.env.LO_QUE_SEA` es siempre `string | undefined`. Acá se
 *      convierte una sola vez (por ejemplo, el puerto a número).
 *   2. Si falta una variable obligatoria, la app falla AL ARRANCAR con un
 *      mensaje claro, en vez de fallar más tarde con un error críptico de
 *      conexión en medio de una petición.
 *   3. Si algún día cambia el nombre de una variable, se toca un solo lugar.
 *
 * Los secretos NUNCA se escriben en el código: viven en `.env`, que está en el
 * `.gitignore`. El archivo versionado es `.env.example`, sin valores reales.
 */

import dotenv from "dotenv";

// Carga el archivo .env y vuelca su contenido dentro de process.env.
// Tiene que ejecutarse antes de cualquier lectura de process.env.
dotenv.config();

/**
 * Lee una variable de entorno obligatoria.
 *
 * @param nombre Nombre de la variable, tal como está escrita en el `.env`.
 * @returns El valor de la variable.
 * @throws Error si la variable no está definida o está vacía. Al lanzarse
 *   durante la carga del módulo, corta el arranque del servidor.
 */
function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (valor === undefined || valor.trim() === "") {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copiá .env.example a .env y completala.`,
    );
  }
  return valor;
}

/**
 * Lee una variable de entorno opcional.
 *
 * @param nombre Nombre de la variable en el `.env`.
 * @param porDefecto Valor a usar si la variable no está o está vacía.
 * @returns El valor de la variable, o `porDefecto`.
 */
function opcional(nombre: string, porDefecto: string): string {
  const valor = process.env[nombre];
  return valor === undefined || valor.trim() === "" ? porDefecto : valor;
}

/**
 * Configuración de la aplicación, ya validada y tipada.
 *
 * Se construye al importar el módulo, así que cualquier variable obligatoria
 * que falte revienta el arranque inmediatamente (falla rápido y visible).
 *
 * `DB_PASSWORD` se lee aparte, sin pasar por `requerida`, porque la cadena
 * vacía es un valor perfectamente válido: muchas instalaciones locales de
 * XAMPP/WAMP/MariaDB tienen el usuario root sin contraseña.
 */
export const entorno = {
  /** Puerto HTTP donde escucha Express. */
  puerto: Number(opcional("PORT", "3000")),

  /** Datos de conexión a MySQL/MariaDB. Los consume src/database/conexion.ts */
  db: {
    host: requerida("DB_HOST"),
    puerto: Number(opcional("DB_PORT", "3306")),
    usuario: requerida("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    nombre: requerida("DB_NAME"),
  },

  /** Clave con la que se firman y verifican los JWT. */
  jwtSecret: requerida("JWT_SECRET"),

  /** Vencimiento del token en formato de la librería `ms` (ej: "1d", "2h"). */
  jwtExpiraEn: opcional("JWT_EXPIRES_IN", "1d"),
};
