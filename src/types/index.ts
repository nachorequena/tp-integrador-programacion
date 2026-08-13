/**
 * TIPOS DE LAS ENTIDADES DEL SISTEMA
 * ==================================
 *
 * Estas interfaces son el "molde" de los datos que circulan por la aplicación.
 * TypeScript las usa solo en tiempo de compilación: no generan código, pero
 * hacen que el editor avise si se escribe mal el nombre de un campo o si falta
 * uno obligatorio.
 *
 * REGLA IMPORTANTE: los nombres de las propiedades replican EXACTAMENTE las
 * columnas de `docs/clinica_ampliada.sql`. Nada de traducir `id_cobertura` a
 * `coberturaId` ni `fecha_nacimiento` a `fechaNacimiento`: si el nombre no
 * coincide con el de la columna, el `INSERT` o el `SELECT` deja de funcionar y
 * el error es difícil de encontrar.
 */

/**
 * Roles existentes en la columna `usuario.rol` del script provisto.
 *
 * Es un array `as const` para poder derivar el tipo `Rol` de él y no tener la
 * lista escrita en dos lugares. En la base la columna es un `varchar(20)`
 * libre: esta lista es la convención acordada, no una restricción del motor.
 */
export const ROLES = ["admin", "operador", "medico", "paciente"] as const;

/** Un rol válido. Equivale a: "admin" | "operador" | "medico" | "paciente". */
export type Rol = (typeof ROLES)[number];

/**
 * Fila completa de la tabla `usuario`, incluido el hash de la contraseña.
 *
 * Este tipo solo debería usarse dentro de los services (el login lo necesita
 * para comparar el hash). Lo que sale hacia el cliente es `UsuarioPublico`.
 *
 * `id_sede` e `id_cobertura` son `number | null` porque en la base admiten
 * NULL: un paciente no tiene sede, y un médico o un admin no tienen cobertura.
 */
export interface Usuario {
  id: number;
  apellido: string;
  nombre: string;
  /** Formato "YYYY-MM-DD" (ver `dateStrings` en src/database/conexion.ts). */
  fecha_nacimiento: string;
  /** Hash bcrypt de 60 caracteres. NUNCA la contraseña en texto plano. */
  password: string;
  rol: string;
  email: string;
  telefono: string;
  dni: string;
  id_sede: number | null;
  id_cobertura: number | null;
}

/**
 * Usuario tal como se expone hacia afuera: es `Usuario` sin el campo
 * `password`.
 *
 * `Omit<T, "campo">` es una utilidad de TypeScript que copia un tipo quitándole
 * una propiedad. La ventaja de derivarlo en vez de escribir la interfaz a mano:
 * si mañana se agrega una columna a `Usuario`, este tipo la hereda solo, y
 * sigue siendo imposible devolver la password sin que el compilador se queje.
 */
export type UsuarioPublico = Omit<Usuario, "password">;

/** Fila de la tabla `cobertura` (obra social). */
export interface Cobertura {
  id: number;
  nombre: string;
}

/** Fila de la tabla `sede` (sucursal de la clínica). */
export interface Sede {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string;
}

/**
 * Contenido del JWT que se firma en el login.
 *
 * Es lo mínimo que pide la consigna: `id`, `rol` e `id_sede`. Va poco y nada a
 * propósito, porque el payload de un JWT NO está cifrado: cualquiera puede
 * leerlo decodificando base64. La firma garantiza que nadie lo haya
 * modificado, no que sea secreto. Por eso acá nunca viajan datos sensibles.
 */
export interface PayloadJWT {
  id: number;
  rol: string;
  id_sede: number | null;
}

/**
 * Cuerpo ya validado de `POST /auth/registro`.
 *
 * Que un dato tenga este tipo significa que ya pasó por `validarRegistro`: los
 * campos existen, tienen el formato correcto y respetan los largos de las
 * columnas. Los services confían en eso y no vuelven a validar.
 */
export interface DatosRegistro {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  /** Contraseña en texto plano. Se hashea en el service, nunca se guarda así. */
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
