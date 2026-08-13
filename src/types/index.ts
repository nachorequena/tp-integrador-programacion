/**
 * Tipos de las entidades del sistema.
 * Los nombres de las propiedades replican EXACTAMENTE las columnas de
 * `docs/clinica_ampliada.sql`. No renombrar ni traducir.
 */

/** Roles existentes en la columna `usuario.rol` del script provisto. */
export const ROLES = ["admin", "operador", "medico", "paciente"] as const;

export type Rol = (typeof ROLES)[number];

/** Fila completa de la tabla `usuario` (incluye el hash de la password). */
export interface Usuario {
  id: number;
  apellido: string;
  nombre: string;
  fecha_nacimiento: string;
  password: string;
  rol: string;
  email: string;
  telefono: string;
  dni: string;
  id_sede: number | null;
  id_cobertura: number | null;
}

/** Usuario tal como se expone hacia afuera: nunca viaja la password. */
export type UsuarioPublico = Omit<Usuario, "password">;

/** Fila de la tabla `cobertura`. */
export interface Cobertura {
  id: number;
  nombre: string;
}

/** Fila de la tabla `sede`. */
export interface Sede {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string;
}

/** Contenido del JWT. `id_sede` es null para los pacientes. */
export interface PayloadJWT {
  id: number;
  rol: string;
  id_sede: number | null;
}

/** Cuerpo ya validado de `POST /auth/registro`. */
export interface DatosRegistro {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  password: string;
  telefono: string;
  fecha_nacimiento: string;
  id_cobertura: number;
}

/** Cuerpo ya validado de `POST /auth/login`. */
export interface DatosLogin {
  dni: string;
  password: string;
}
