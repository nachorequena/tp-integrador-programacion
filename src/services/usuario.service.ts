/**
 * SERVICE: usuario
 * ================
 *
 * Único lugar del proyecto que escribe SQL contra la tabla `usuario`. Los
 * controllers nunca hablan con la base directamente: si mañana cambia una
 * columna, se toca solo este archivo.
 *
 * SEGURIDAD — QUERIES PARAMETRIZADAS:
 * Todas las consultas usan `?` como marcador y pasan los valores en un array
 * aparte. Nunca se arma el SQL concatenando strings. La diferencia es crítica:
 *
 *   MAL:  "SELECT * FROM usuario WHERE dni = '" + dni + "'"
 *   BIEN: "SELECT * FROM usuario WHERE dni = ?", [dni]
 *
 * En la primera, un dni como `' OR '1'='1` cambia el significado de la consulta
 * y devuelve todos los usuarios: eso es una inyección SQL. Con `?`, el driver
 * manda el valor separado de la consulta y MySQL lo trata siempre como dato,
 * nunca como código, sin importar qué contenga.
 *
 * NOTA SOBRE mysql2: `pool.query` devuelve un array `[filas, metadatos]`. Por
 * eso el `const [filas] = await ...`, que desestructura y se queda solo con el
 * primer elemento.
 */

import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/conexion";
import { DatosRegistro, Usuario, UsuarioPublico } from "../types";

/**
 * Columnas que se pueden exponer hacia afuera.
 *
 * Se listan explícitamente en lugar de usar `SELECT *` para que la `password`
 * no salga NUNCA por descuido. Con `SELECT *`, cualquier endpoint que devuelva
 * la fila estaría filtrando el hash sin que nadie lo note.
 */
const COLUMNAS_PUBLICAS =
  "id, nombre, apellido, dni, email, telefono, fecha_nacimiento, rol, id_sede, id_cobertura";

/**
 * Busca un usuario por DNI incluyendo el hash de la contraseña.
 *
 * Es la única función que devuelve la `password`, y existe porque el login
 * necesita el hash para compararlo con bcrypt. Para cualquier otro uso va
 * `buscarPublicoPorId`.
 *
 * @param dni DNI a buscar, ya validado.
 * @returns El usuario completo, o `null` si no existe ninguno con ese DNI.
 */
export async function buscarPorDni(dni: string): Promise<Usuario | null> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM usuario WHERE dni = ? LIMIT 1",
    [dni],
  );
  // `filas[0]` es `undefined` si no hubo resultados; se normaliza a `null`
  // para que quien llame tenga un solo caso de "no encontrado" que controlar.
  return (filas[0] as Usuario | undefined) ?? null;
}

/**
 * Busca un usuario por id, sin la contraseña.
 *
 * La usa `GET /auth/perfil`: el id sale del token, así que el usuario solo
 * puede pedir sus propios datos.
 *
 * @param id Id del usuario (viene del payload del JWT).
 * @returns Los datos públicos del usuario, o `null` si no existe.
 */
export async function buscarPublicoPorId(
  id: number,
): Promise<UsuarioPublico | null> {
  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUMNAS_PUBLICAS} FROM usuario WHERE id = ? LIMIT 1`,
    [id],
  );
  return (filas[0] as UsuarioPublico | undefined) ?? null;
}

/**
 * Indica si ya hay un usuario con ese DNI.
 *
 * ¿Por qué se consulta en vez de dejar que falle el INSERT? Porque el script de
 * la cátedra NO tiene índices UNIQUE en `dni` ni en `email` (ver CLAUDE.md,
 * sección 7), así que la base aceptaría duplicados sin protestar. La consigna
 * pide que no se dupliquen, entonces la validación se hace en la aplicación.
 *
 * Se selecciona `1` en lugar de `*` porque no interesa el contenido de la fila,
 * solo si existe: así MySQL no lee columnas al pedo.
 *
 * @param dni DNI a comprobar.
 * @returns `true` si ya está registrado.
 */
export async function existeDni(dni: string): Promise<boolean> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM usuario WHERE dni = ? LIMIT 1",
    [dni],
  );
  return filas.length > 0;
}

/**
 * Indica si ya hay un usuario con ese email. Mismo criterio que `existeDni`.
 *
 * @param email Email a comprobar, ya normalizado a minúsculas por el validador.
 * @returns `true` si ya está registrado.
 */
export async function existeEmail(email: string): Promise<boolean> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM usuario WHERE email = ? LIMIT 1",
    [email],
  );
  return filas.length > 0;
}

/**
 * Comprueba que exista un usuario con ese id Y que su rol sea `medico`.
 *
 * La usa el alta de agenda. No alcanza con que el id exista: `agenda.id_medico`
 * apunta a `usuario`, que contiene a todos los roles, así que sin esta
 * comprobación se podría cargar la agenda de un paciente o de un administrativo.
 *
 * @param id Id de usuario recibido como `id_medico`.
 * @returns `true` si existe y es médico.
 */
export async function esMedico(id: number): Promise<boolean> {
  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT 1 FROM usuario WHERE id = ? AND rol = 'medico' LIMIT 1",
    [id],
  );
  return filas.length > 0;
}

/**
 * Inserta un paciente nuevo.
 *
 * Dos valores se fijan acá y no llegan desde el cliente, a propósito:
 *
 * - `rol` = "paciente" — el registro público no puede crear admins ni médicos.
 *   Si el rol viniera en el body, cualquiera se daría de alta como admin.
 * - `id_sede` = NULL — un paciente no pertenece a ninguna sede.
 *
 * El orden de los `?` tiene que coincidir exactamente con el de las columnas
 * listadas arriba y con el del array de valores.
 *
 * @param datos Cuerpo del registro ya validado.
 * @param passwordHasheada Hash bcrypt. NUNCA la contraseña en texto plano: esta
 *   función no hashea nada, confía en que ya viene hasheada desde el service de
 *   autenticación.
 * @returns El id autogenerado del usuario recién creado.
 */
export async function crearPaciente(
  datos: DatosRegistro,
  passwordHasheada: string,
): Promise<number> {
  // `ResultSetHeader` es el tipo que devuelve mysql2 en un INSERT/UPDATE/DELETE:
  // no trae filas, trae metadatos como `insertId` y `affectedRows`.
  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO usuario
       (apellido, nombre, fecha_nacimiento, password, rol, email, telefono, dni, id_sede, id_cobertura)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      datos.apellido,
      datos.nombre,
      datos.fecha_nacimiento,
      passwordHasheada,
      "paciente",
      datos.email,
      datos.telefono,
      datos.dni,
      datos.id_cobertura,
    ],
  );
  return resultado.insertId;
}
