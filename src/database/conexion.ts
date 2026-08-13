/**
 * CONEXIÓN A LA BASE DE DATOS
 * ===========================
 *
 * Crea y exporta el *pool* de conexiones a MySQL/MariaDB que usan todos los
 * services del proyecto.
 *
 * ¿Qué es un pool y por qué no una conexión suelta?
 * Abrir una conexión a la base es caro (viaje de red + autenticación). Un pool
 * mantiene un conjunto de conexiones ya abiertas y las va prestando a cada
 * consulta; cuando la consulta termina, la conexión vuelve al conjunto en vez
 * de cerrarse. Con una sola conexión compartida, dos peticiones simultáneas se
 * pisarían entre sí.
 *
 * Se usa `mysql2/promise` (y no `mysql2` a secas) para poder trabajar con
 * async/await en lugar de callbacks.
 */

import mysql from "mysql2/promise";
import { entorno } from "../config/env";

/**
 * Pool de conexiones. Se crea una sola vez, al importar este módulo por
 * primera vez, y se reutiliza en toda la aplicación.
 *
 * Dos opciones que NO son las de fábrica y conviene entender:
 *
 * - `charset: "utf8mb4"` → las tablas del script provisto están declaradas en
 *   utf8 (utf8mb3). Forzando utf8mb4 en la conexión, los acentos y la eñe
 *   viajan intactos en los dos sentidos ("Martín", "Muñoz").
 *
 * - `dateStrings: true` → por defecto, mysql2 convierte las columnas `date` a
 *   objetos `Date` de JavaScript, que llevan hora y zona horaria. Eso puede
 *   correr un día para atrás o para adelante al serializarlo a JSON. Con esta
 *   opción, `fecha_nacimiento` llega como el string "1999-05-20", que es
 *   exactamente lo que está guardado.
 */
export const pool = mysql.createPool({
  host: entorno.db.host,
  port: entorno.db.puerto,
  user: entorno.db.usuario,
  password: entorno.db.password,
  database: entorno.db.nombre,
  charset: "utf8mb4",
  dateStrings: true,

  // Si las 10 conexiones están ocupadas, las consultas nuevas esperan turno
  // en vez de fallar. `queueLimit: 0` = cola sin límite de espera.
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Comprueba que la base esté accesible.
 *
 * Pide una conexión al pool y le manda un `ping` (un paquete mínimo del
 * protocolo de MySQL que solo verifica que el servidor conteste). Lo usa el
 * endpoint `GET /health` y también el arranque del servidor.
 *
 * El `release()` va en un `finally` para que la conexión vuelva al pool incluso
 * si el ping falla. Sin eso, cada chequeo fallido se quedaría con una conexión
 * y el pool terminaría agotado.
 *
 * @returns Nada si la conexión funciona.
 * @throws El error original de mysql2 si no se puede conectar (credenciales
 *   incorrectas, motor apagado, base inexistente, etc.).
 */
export async function probarConexion(): Promise<void> {
  const conexion = await pool.getConnection();
  try {
    await conexion.ping();
  } finally {
    conexion.release();
  }
}
