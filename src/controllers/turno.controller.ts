/**
 * CONTROLLER: turno
 * =================
 *
 * Alta, cancelación, atención y listados de turnos.
 *
 * Flujo: `turno.routes.ts` → este controller → validators
 * (`turno.validators.ts`, `historial.validators.ts`) → `turno.service.ts` →
 * `responder`.
 *
 * Como el de agenda, estos controllers le pasan `req.usuario` al service:
 * `verificarRol` filtra por rol, pero las reglas dependen de QUIÉN pide (un
 * paciente solo cancela el suyo, un operador solo los de su sede, un médico
 * solo los suyos). Esa parte la resuelve el service, que es el que lee la
 * fila.
 *
 * Lo que sí se decide acá es de quién es el turno que se está sacando: el
 * paciente lo saca para sí mismo y el operador en representación de otro. Es
 * una regla del endpoint, no de la fila, así que no baja al service.
 */

import { NextFunction, Request, Response } from "express";
import * as turnoService from "../services/turno.service";
import { PayloadJWT } from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { responder } from "../utils/respuesta";
import { comoObjeto, validarIdRuta } from "../validators/comunes";
import { validarHistorial } from "../validators/historial.validators";
import { validarFiltrosTurnosDia, validarNuevoTurno } from "../validators/turno.validators";

/**
 * Devuelve el usuario autenticado o corta la petición.
 *
 * En la práctica nunca falla, porque todas estas rutas van detrás de
 * `verificarToken`. Está para que TypeScript descarte el `undefined` y para
 * que, si alguien monta una ruta sin el middleware, el error sea explícito.
 *
 * @param req Petición en curso.
 * @returns El payload del token.
 * @throws `ErrorHttp` 401 si no hay usuario autenticado.
 */
function usuarioAutenticado(req: Request): PayloadJWT {
  if (!req.usuario) {
    throw new ErrorHttp(401, "Falta el token de autenticación");
  }
  return req.usuario;
}

/**
 * `POST /turnos` — solicita un turno.
 *
 * Lo puede pedir el propio paciente o un operador en su representación. En el
 * primer caso el paciente sale del token y `id_paciente` del cuerpo se ignora:
 * si se tomara del body, un paciente podría sacarle turnos a otro.
 *
 * Responde 201 con el turno creado (detallado) y un mensaje.
 */
export async function crear(
  req: Request, // el pedido: cuerpo JSON en req.body, usuario del token en req.usuario
  res: Response, // con qué se responde (a través de `responder`)
  next: NextFunction, // para pasarle un error al manejador de errores
): Promise<void> {
  // Todo va dentro de un try/catch: CUALQUIER error que se lance adentro (del
  // validador, de estas reglas o del service) cae en el `catch`, que lo pasa
  // con `next(error)` al middleware `manejadorErrores`. Ese middleware arma la
  // respuesta de error con el formato uniforme { codigo, estado, datos: null }.
  try {
    // Quién hace el pedido (lo dejó verificarToken a partir del JWT).
    const usuario = usuarioAutenticado(req);
    // Valida la FORMA del cuerpo (ids, fecha, hora, nota). Si algo está mal,
    // lanza un ErrorHttp 400 con todos los errores juntos y salta al catch.
    const datos = validarNuevoTurno(req.body);

    // ¿Para qué paciente es el turno?
    let idPaciente: number;
    if (usuario.rol === "paciente") {
      // PACIENTE: para sí mismo. El id sale del TOKEN (firmado, no se puede
      // falsificar), nunca del cuerpo: si se tomara del cuerpo, un paciente
      // podría sacarle turnos a otro mandando otro id_paciente.
      idPaciente = usuario.id;
    } else {
      // OPERADOR (el único otro rol que llega acá: lo filtró verificarRol).
      // Regla 1: tiene que indicar para qué paciente es el turno.
      if (datos.id_paciente === undefined) {
        throw new ErrorHttp(400, "El operador debe indicar el paciente");
      }
      // Regla 2: el operador solo opera sobre su propia sede, como pide la
      // consigna. Si no tiene sede, o pide un turno en otra sede → 403.
      if (usuario.id_sede === null || datos.id_sede !== usuario.id_sede) {
        throw new ErrorHttp(403, "El operador solo puede solicitar turnos de su propia sede");
      }
      idPaciente = datos.id_paciente;
    }

    // Las reglas de negocio que necesitan la base (agenda, horario libre,
    // cobertura) las aplica el service. `await` espera a que termine.
    const turno = await turnoService.crearTurno(datos, idPaciente, usuario);
    // Todo OK: 201 (Created) con el turno creado y un mensaje.
    responder(res, 201, "ok", { ...turno, mensaje: "Turno confirmado correctamente" });
  } catch (error) {
    // Cualquier error (400, 403, 404, 409 o uno inesperado) va al manejador.
    next(error);
  }
}

/**
 * `PATCH /turnos/:id/cancelar` — pasa el turno a `cancelado`.
 *
 * Se usa PATCH y no PUT porque no se reemplaza el turno: se cambia un solo
 * campo de estado.
 */
export async function cancelar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const idTurno = validarIdRuta(req.params.id);
    const turno = await turnoService.cancelarTurno(idTurno, usuario);
    responder(res, 200, "ok", { ...turno, mensaje: "Turno cancelado correctamente" });
  } catch (error) {
    next(error);
  }
}

/**
 * `PATCH /turnos/:id/atender` — el médico pasa el turno a `atendido`.
 *
 * El cuerpo es opcional. Si trae `diagnostico` (y opcionalmente `tratamiento`
 * y `observaciones`), se valida como un historial clínico y se guarda junto
 * con el cambio de estado: es la acción "Marcar como atendido" del frontend,
 * que carga el historial en el mismo paso. Sin cuerpo, solo cambia el estado.
 */
export async function atender(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const idTurno = validarIdRuta(req.params.id);

    // Un body vacío llega como `{}` (o `undefined` sin Content-Type): en los
    // dos casos se interpreta como "sin historial".
    const cuerpo = req.body === undefined ? {} : comoObjeto(req.body);
    const historial = cuerpo.diagnostico !== undefined ? validarHistorial(cuerpo) : undefined;

    const turno = await turnoService.atenderTurno(idTurno, usuario, historial);
    responder(res, 200, "ok", { ...turno, mensaje: "Turno marcado como atendido" });
  } catch (error) {
    next(error);
  }
}

/**
 * `GET /turnos/mios` — turnos del paciente autenticado.
 *
 * El paciente sale del token, nunca de la URL: así no hay forma de pedir los
 * turnos de otro.
 */
export async function misTurnos(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const turnos = await turnoService.listarTurnosPaciente(usuario.id);
    responder(res, 200, "ok", turnos);
  } catch (error) {
    next(error);
  }
}

/**
 * `GET /turnos/medico?fecha=YYYY-MM-DD&id_sede=` — turnos del médico.
 *
 * Sin `id_sede` devuelve los de todas las sedes donde atiende ese día.
 */
export async function turnosMedico(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const { fecha, id_sede } = validarFiltrosTurnosDia(req.query);
    const turnos = await turnoService.listarTurnosMedico(usuario.id, { fecha, id_sede });
    responder(res, 200, "ok", turnos);
  } catch (error) {
    next(error);
  }
}

/**
 * `GET /turnos/sede?fecha=YYYY-MM-DD&id_medico=` — turnos de la sede, para el
 * operador.
 *
 * La sede sale del token y no de la query: el operador solo puede ver la suya.
 */
export async function turnosSede(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const { fecha, id_medico } = validarFiltrosTurnosDia(req.query);
    if (usuario.id_sede === null) {
      throw new ErrorHttp(403, "El usuario no tiene una sede asignada");
    }
    const turnos = await turnoService.listarTurnosSede(usuario.id_sede, { fecha, id_medico });
    responder(res, 200, "ok", turnos);
  } catch (error) {
    next(error);
  }
}
