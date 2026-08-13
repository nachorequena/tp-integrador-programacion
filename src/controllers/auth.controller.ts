/**
 * CONTROLLER: autenticación
 * =========================
 *
 * Traduce entre el mundo HTTP y el mundo del negocio. Un controller "fino"
 * hace solo tres cosas y nada más:
 *
 *   1. Saca los datos de la petición (`req.body`, `req.usuario`).
 *   2. Llama al service que sabe resolver el caso.
 *   3. Convierte lo que devuelve el service en una respuesta HTTP.
 *
 * Lo que NO hace: escribir SQL, hashear contraseñas ni decidir reglas de
 * negocio. Todo eso vive en los services, para que la lógica se pueda entender
 * y reutilizar sin arrastrar a Express.
 *
 * EL PATRÓN try/catch + next(error):
 * Todos los métodos tienen la misma forma. El `catch` no arma la respuesta de
 * error: se la pasa a `next(error)`, que la manda al middleware
 * `manejadorErrores`. Así el código de error se decide en un solo lugar y los
 * controllers solo se ocupan del camino feliz.
 */

import { NextFunction, Request, Response } from "express";
import * as authService from "../services/auth.service";
import { ErrorHttp } from "../utils/errorHttp";
import { responder } from "../utils/respuesta";
import { validarLogin, validarRegistro } from "../validators/auth.validators";

/**
 * `POST /auth/registro` — alta de un paciente.
 *
 * Responde **201 (Created)** y no 200, porque el resultado de la operación es
 * un recurso nuevo en el servidor. En `datos` viaja el usuario creado, sin la
 * contraseña.
 *
 * @param req Con el cuerpo del registro en `req.body`.
 * @param res Respuesta de Express.
 * @param next Salida hacia el manejador de errores.
 */
export async function registro(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Si algo no valida, `validarRegistro` lanza un ErrorHttp 400 y la
    // ejecución salta directo al catch: el service nunca llega a ejecutarse.
    const datos = validarRegistro(req.body);
    const usuario = await authService.registrarPaciente(datos);
    responder(res, 201, "ok", usuario);
  } catch (error) {
    next(error);
  }
}

/**
 * `POST /auth/login` — valida credenciales y devuelve el JWT.
 *
 * En `datos` van el `token` y el `usuario`. Se incluye el usuario además del
 * token para que el frontend (etapa 2) pueda mostrar el nombre y decidir el
 * menú según el rol sin tener que hacer una segunda llamada a `/auth/perfil`.
 *
 * @param req Con `dni` y `password` en `req.body`.
 * @param res Respuesta de Express.
 * @param next Salida hacia el manejador de errores.
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const datos = validarLogin(req.body);
    const resultado = await authService.login(datos);
    responder(res, 200, "ok", resultado);
  } catch (error) {
    next(error);
  }
}

/**
 * `GET /auth/perfil` — datos del usuario logueado.
 *
 * Endpoint de prueba de `verificarToken`, como pide la consigna. El id se toma
 * de `req.usuario`, que completó el middleware a partir del token: no se recibe
 * por parámetro, así nadie puede pedir el perfil de otra persona.
 *
 * @param req Con `req.usuario` ya cargado por `verificarToken`.
 * @param res Respuesta de Express.
 * @param next Salida hacia el manejador de errores.
 */
export async function perfil(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // En teoría no puede pasar, porque la ruta está montada detrás de
    // `verificarToken`. La comprobación está por dos motivos: TypeScript exige
    // descartar el `undefined` (el campo es opcional), y si algún día alguien
    // monta la ruta sin el middleware, esto falla de forma clara y no con un
    // "cannot read property id of undefined".
    if (!req.usuario) {
      throw new ErrorHttp(401, "Falta el token de autenticación");
    }
    const usuario = await authService.obtenerPerfil(req.usuario.id);
    responder(res, 200, "ok", usuario);
  } catch (error) {
    next(error);
  }
}
