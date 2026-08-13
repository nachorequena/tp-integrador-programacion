import dotenv from "dotenv";

dotenv.config();

/**
 * Lee una variable obligatoria. Si falta, corta el arranque con un mensaje
 * claro en vez de fallar más adelante con un error críptico de conexión.
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

function opcional(nombre: string, porDefecto: string): string {
  const valor = process.env[nombre];
  return valor === undefined || valor.trim() === "" ? porDefecto : valor;
}

/**
 * `DB_PASSWORD` se lee aparte: la cadena vacía es un valor válido
 * (instalaciones de XAMPP/MariaDB con root sin contraseña).
 */
export const entorno = {
  puerto: Number(opcional("PORT", "3000")),
  db: {
    host: requerida("DB_HOST"),
    puerto: Number(opcional("DB_PORT", "3306")),
    usuario: requerida("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    nombre: requerida("DB_NAME"),
  },
  jwtSecret: requerida("JWT_SECRET"),
  jwtExpiraEn: opcional("JWT_EXPIRES_IN", "1d"),
};
