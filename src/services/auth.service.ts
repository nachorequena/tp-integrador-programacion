import bcrypt from "bcrypt";
import { DatosLogin, DatosRegistro, PayloadJWT, UsuarioPublico } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { firmarToken } from "../utils/jwt";
import * as coberturaService from "./cobertura.service";
import * as usuarioService from "./usuario.service";

const SALT_ROUNDS = 10;

/**
 * Alta de paciente. Valida unicidad de dni/email y existencia de la cobertura,
 * hashea la password y devuelve el usuario ya creado (sin la password).
 */
export async function registrarPaciente(
  datos: DatosRegistro,
): Promise<UsuarioPublico> {
  if (await usuarioService.existeDni(datos.dni)) {
    throw new ErrorHttp(409, "El DNI ya está registrado");
  }

  if (await usuarioService.existeEmail(datos.email)) {
    throw new ErrorHttp(409, "El email ya está registrado");
  }

  if (!(await coberturaService.existeCobertura(datos.id_cobertura))) {
    throw new ErrorHttp(400, "La cobertura indicada no existe");
  }

  const passwordHasheada = await bcrypt.hash(datos.password, SALT_ROUNDS);
  const idNuevo = await usuarioService.crearPaciente(datos, passwordHasheada);

  const usuario = await usuarioService.buscarPublicoPorId(idNuevo);
  if (!usuario) {
    throw new ErrorHttp(500, "No se pudo recuperar el usuario recién creado");
  }

  return usuario;
}

/**
 * Valida credenciales y devuelve el JWT.
 *
 * El mensaje de error es el mismo para "dni inexistente" y "password
 * incorrecta": no se le informa a un atacante cuál de los dos falló.
 *
 * Nota: los usuarios del seed tienen hashes falsos, así que `bcrypt.compare`
 * devuelve false para ellos y el login responde 401 (no rompe).
 */
export async function login(
  datos: DatosLogin,
): Promise<{ token: string; usuario: UsuarioPublico }> {
  const usuario = await usuarioService.buscarPorDni(datos.dni);
  if (!usuario) {
    throw new ErrorHttp(401, "DNI o contraseña incorrectos");
  }

  const coincide = await bcrypt.compare(datos.password, usuario.password);
  if (!coincide) {
    throw new ErrorHttp(401, "DNI o contraseña incorrectos");
  }

  const payload: PayloadJWT = {
    id: usuario.id,
    rol: usuario.rol,
    id_sede: usuario.id_sede,
  };

  const { password: _password, ...usuarioPublico } = usuario;

  return { token: firmarToken(payload), usuario: usuarioPublico };
}

/** Datos del usuario autenticado, a partir del id que viaja en el token. */
export async function obtenerPerfil(id: number): Promise<UsuarioPublico> {
  const usuario = await usuarioService.buscarPublicoPorId(id);
  if (!usuario) {
    throw new ErrorHttp(404, "El usuario del token ya no existe");
  }
  return usuario;
}
