/**
 * SERVICE: autenticación
 * ======================
 *
 * Corazón de la semana 1: el alta de pacientes y el login.
 *
 * A diferencia de `usuario.service`, que solo ejecuta SQL, este service tiene
 * la LÓGICA DE NEGOCIO: en qué orden validar, cuándo hashear, qué error
 * corresponde a cada situación. Se apoya en los otros services para hablar con
 * la base y no escribe SQL propio.
 *
 * SOBRE BCRYPT (por qué no se guarda la contraseña tal cual):
 * Si la base se filtra, un atacante se lleva todas las contraseñas en texto
 * plano — y como la gente las repite, también sus mails y sus bancos. bcrypt
 * aplica una función de un solo sentido: de la contraseña se obtiene el hash,
 * pero del hash NO se puede volver a la contraseña. Para verificar un login se
 * hashea lo que mandó el usuario y se comparan los hashes.
 *
 * Además bcrypt es LENTO a propósito (eso controla el `SALT_ROUNDS`) y agrega
 * un "salt" aleatorio a cada contraseña. Por eso dos usuarios con la misma
 * contraseña tienen hashes distintos, y probar contraseñas por fuerza bruta se
 * vuelve carísimo.
 */

import bcrypt from "bcrypt";
import { DatosLogin, DatosRegistro, PayloadJWT, UsuarioPublico } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { firmarToken } from "../utils/jwt";
import * as coberturaService from "./cobertura.service";
import * as usuarioService from "./usuario.service";

/**
 * Costo del hasheo: bcrypt hace 2^10 = 1024 iteraciones internas.
 *
 * Es el valor que fija el CLAUDE.md. Cuanto más alto, más seguro y más lento;
 * 10 es el equilibrio habitual (unos 50-100 ms por hash). Subirlo a 15 haría el
 * login perceptiblemente lento.
 */
const SALT_ROUNDS = 10;

/**
 * Da de alta un paciente.
 *
 * Orden de la operación (importa que las validaciones vayan ANTES de hashear:
 * hashear cuesta ~100 ms y sería tirarlos si después hay que rechazar el alta):
 *
 *   1. ¿El DNI ya existe?         → 409
 *   2. ¿El email ya existe?       → 409
 *   3. ¿La cobertura existe?      → 400
 *   4. Hashear la contraseña
 *   5. INSERT
 *   6. Releer el usuario creado y devolverlo sin la password
 *
 * @param datos Cuerpo del registro ya validado por `validarRegistro`.
 * @returns El usuario recién creado, sin la contraseña.
 * @throws `ErrorHttp` 409 si el DNI o el email ya están registrados.
 * @throws `ErrorHttp` 400 si `id_cobertura` no existe en la base.
 */
export async function registrarPaciente(
  datos: DatosRegistro,
): Promise<UsuarioPublico> {
  if (await usuarioService.existeDni(datos.dni)) {
    // 409 (Conflict) es el código para "el recurso choca con algo que ya
    // existe". No es 400: los datos están bien formados, el problema es el
    // estado actual de la base.
    throw new ErrorHttp(409, "El DNI ya está registrado");
  }

  if (await usuarioService.existeEmail(datos.email)) {
    throw new ErrorHttp(409, "El email ya está registrado");
  }

  // La cobertura tiene que existir de verdad: `id_cobertura` es una clave
  // foránea, así que un id inventado haría fallar el INSERT con un error de
  // MySQL (que terminaría en un 500). Mejor detectarlo acá y devolver un 400
  // con un mensaje entendible.
  if (!(await coberturaService.existeCobertura(datos.id_cobertura))) {
    throw new ErrorHttp(400, "La cobertura indicada no existe");
  }

  const passwordHasheada = await bcrypt.hash(datos.password, SALT_ROUNDS);
  const idNuevo = await usuarioService.crearPaciente(datos, passwordHasheada);

  // Se relee de la base en vez de devolver `datos`: así la respuesta refleja lo
  // que quedó realmente guardado (con el id asignado y el rol que puso el
  // service), y no lo que el cliente creía estar mandando.
  const usuario = await usuarioService.buscarPublicoPorId(idNuevo);
  if (!usuario) {
    // Prácticamente imposible: significaría que el INSERT dijo que anduvo pero
    // la fila no está. Se contempla igual para no devolver `null` hacia arriba.
    throw new ErrorHttp(500, "No se pudo recuperar el usuario recién creado");
  }

  return usuario;
}

/**
 * Valida las credenciales y genera el token de la sesión.
 *
 * DECISIÓN DE SEGURIDAD: los dos motivos de fallo —el DNI no existe y la
 * contraseña es incorrecta— devuelven EXACTAMENTE el mismo mensaje. Si se
 * distinguieran ("ese DNI no está registrado" vs "contraseña incorrecta"),
 * cualquiera podría averiguar qué DNIs tienen cuenta en la clínica probando de
 * a uno. Eso se llama enumeración de usuarios.
 *
 * Detalle sobre los usuarios del seed: sus hashes son falsos
 * (`$2b$10$hashdeejemplo1`, de 21 caracteres en vez de 60). `bcrypt.compare`
 * devuelve `false` con un hash mal formado en lugar de lanzar una excepción,
 * así que esos logins responden un 401 limpio y no rompen la aplicación.
 *
 * @param datos DNI y contraseña ya validados.
 * @returns El token firmado y los datos públicos del usuario.
 * @throws `ErrorHttp` 401 si el DNI no existe o la contraseña no coincide.
 */
export async function login(
  datos: DatosLogin,
): Promise<{ token: string; usuario: UsuarioPublico }> {
  const usuario = await usuarioService.buscarPorDni(datos.dni);
  if (!usuario) {
    throw new ErrorHttp(401, "DNI o contraseña incorrectos");
  }

  // Compara la contraseña recibida contra el hash guardado. bcrypt saca el salt
  // del propio hash, vuelve a hashear con él y compara los resultados: nunca
  // "desencripta" nada, porque no se puede.
  const coincide = await bcrypt.compare(datos.password, usuario.password);
  if (!coincide) {
    throw new ErrorHttp(401, "DNI o contraseña incorrectos");
  }

  // Solo lo mínimo que pide la consigna. El payload de un JWT es legible por
  // cualquiera, así que acá no va nada sensible.
  const payload: PayloadJWT = {
    id: usuario.id,
    rol: usuario.rol,
    id_sede: usuario.id_sede,
  };

  // Saca `password` del objeto y junta todo el resto en `usuarioPublico`.
  // El guión bajo en `_password` marca que la variable existe solo para
  // descartar ese campo y no se usa.
  const { password: _password, ...usuarioPublico } = usuario;

  return { token: firmarToken(payload), usuario: usuarioPublico };
}

/**
 * Devuelve los datos del usuario autenticado.
 *
 * El id llega del token, no de la URL ni del body: por eso un usuario no puede
 * pedir el perfil de otro cambiando un parámetro.
 *
 * @param id Id del usuario, tomado de `req.usuario.id`.
 * @returns Los datos públicos del usuario.
 * @throws `ErrorHttp` 404 si el usuario fue eliminado después de emitirse el
 *   token (el token sigue siendo válido hasta que venza, pero la fila ya no
 *   está).
 */
export async function obtenerPerfil(id: number): Promise<UsuarioPublico> {
  const usuario = await usuarioService.buscarPublicoPorId(id);
  if (!usuario) {
    throw new ErrorHttp(404, "El usuario del token ya no existe");
  }
  return usuario;
}
