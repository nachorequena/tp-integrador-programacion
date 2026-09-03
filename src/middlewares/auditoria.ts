/**
 * MIDDLEWARE: auditoría automática
 * ================================
 *
 * Registra en `log_auditoria` cada alta, baja o modificación sobre las
 * entidades sensibles del sistema.
 *
 * El criterio de aceptación de la semana es explícito: esto tiene que pasar
 * "automáticamente, **sin código repetido en cada endpoint**". Por eso vive
 * acá y no dentro de cada controller: se monta una sola vez en `src/index.ts`
 * y ningún service ni controller sabe que existe. Auditar un endpoint nuevo es
 * agregar un renglón a la tabla de abajo.
 *
 * ── Cómo funciona ────────────────────────────────────────────────────────────
 *
 * El middleware corre ANTES que las rutas, pero lo que le interesa —si la
 * operación salió bien y qué id se creó— recién se sabe DESPUÉS. La solución es
 * envolver `res.json`: se guarda el método original y se lo reemplaza por uno
 * que, además de responder, mira lo que se está por mandar.
 *
 *   petición → auditar (envuelve res.json) → ruta → controller → res.json
 *                                                                   │
 *                            se responde primero, se audita después ┘
 *
 * El orden importa: primero se llama al `res.json` original y recién ahí se
 * escribe el log, sin `await`. Así la auditoría no le agrega latencia a la
 * respuesta y, si la base del log falla, el cliente ya recibió su 201.
 *
 * ── Por qué una tabla explícita y no un mapeo por método ─────────────────────
 *
 * Sería tentador deducir la acción del verbo HTTP (POST→ALTA, PUT→MODIFICACION,
 * DELETE→BAJA), pero no alcanza: los turnos no se modifican con PUT sino con
 * `PATCH /turnos/:id/cancelar` y `PATCH /turnos/:id/atender`, que son acciones
 * distintas con el mismo verbo. Y `PATCH /notificaciones/:id/leida` también es
 * PATCH y NO debe auditarse: marcar una notificación como leída no es una
 * acción sensible, y registrarla inundaría un log que tiene 127 lugares.
 *
 * Con una tabla explícita, lo que se audita se lee de un vistazo y lo que no
 * está listado simplemente no se audita.
 */

import { NextFunction, Request, Response } from "express";
import * as auditoriaService from "../services/auditoria.service";
import { AccionAuditoria, EntradaAuditoria } from "../types";

/** Una operación que se audita. */
interface RutaAuditada {
  /** Método HTTP exacto. */
  metodo: string;
  /**
   * Patrón contra el que se compara la ruta.
   *
   * Si captura un grupo, ese grupo es el id de la entidad afectada. Las altas
   * no capturan nada: su id todavía no existe cuando llega la petición, y se
   * saca de la respuesta.
   */
  patron: RegExp;
  /** Nombre de la entidad, tal como se guarda en la columna `entidad`. */
  entidad: string;
  accion: AccionAuditoria;
}

/**
 * Las operaciones sensibles del sistema.
 *
 * El entregable nombra usuarios, coberturas, especialidades y sedes; se
 * sumaron agenda y turnos porque también son acciones sensibles y su ausencia
 * dejaría ciegos justamente a los movimientos más frecuentes de la clínica.
 *
 * Sobre el mapeo de los turnos: cancelar se registra como `BAJA` y atender como
 * `MODIFICACION`. Un turno cancelado es, a los fines del registro, un turno
 * dado de baja —la fila sigue existiendo, pero deja de estar vigente—, mientras
 * que atenderlo solo le cambia el estado.
 *
 * Lo que NO se audita, a propósito: las lecturas (no modifican nada), el login
 * (no es un alta), el historial clínico (la consigna no lo pide y su propia
 * tabla ya deja constancia de quién lo cargó y cuándo) y el marcado de
 * notificaciones como leídas.
 */
const RUTAS_AUDITADAS: RutaAuditada[] = [
  // Usuarios. El único alta de usuario del sistema es el registro público.
  { metodo: "POST", patron: /^\/auth\/registro$/, entidad: "usuario", accion: "ALTA" },

  // Sedes
  { metodo: "POST", patron: /^\/sedes$/, entidad: "sede", accion: "ALTA" },
  { metodo: "PUT", patron: /^\/sedes\/(\d+)$/, entidad: "sede", accion: "MODIFICACION" },
  { metodo: "DELETE", patron: /^\/sedes\/(\d+)$/, entidad: "sede", accion: "BAJA" },

  // Especialidades
  { metodo: "POST", patron: /^\/especialidades$/, entidad: "especialidad", accion: "ALTA" },
  { metodo: "PUT", patron: /^\/especialidades\/(\d+)$/, entidad: "especialidad", accion: "MODIFICACION" },
  { metodo: "DELETE", patron: /^\/especialidades\/(\d+)$/, entidad: "especialidad", accion: "BAJA" },

  // Coberturas
  { metodo: "POST", patron: /^\/coberturas$/, entidad: "cobertura", accion: "ALTA" },
  { metodo: "PUT", patron: /^\/coberturas\/(\d+)$/, entidad: "cobertura", accion: "MODIFICACION" },
  { metodo: "DELETE", patron: /^\/coberturas\/(\d+)$/, entidad: "cobertura", accion: "BAJA" },

  // Agenda médica
  { metodo: "POST", patron: /^\/agendas$/, entidad: "agenda", accion: "ALTA" },
  { metodo: "PUT", patron: /^\/agendas\/(\d+)$/, entidad: "agenda", accion: "MODIFICACION" },
  { metodo: "DELETE", patron: /^\/agendas\/(\d+)$/, entidad: "agenda", accion: "BAJA" },

  // Turnos
  { metodo: "POST", patron: /^\/turnos$/, entidad: "turno", accion: "ALTA" },
  { metodo: "PATCH", patron: /^\/turnos\/(\d+)\/cancelar$/, entidad: "turno", accion: "BAJA" },
  { metodo: "PATCH", patron: /^\/turnos\/(\d+)\/atender$/, entidad: "turno", accion: "MODIFICACION" },
];

/**
 * Busca si la petición en curso corresponde a una operación auditable.
 *
 * Se compara contra la ruta sin query string: `/sedes/3?x=1` tiene que matchear
 * igual que `/sedes/3`.
 *
 * @param req Petición en curso.
 * @returns La regla que aplica y el id capturado, o `null` si no se audita.
 */
function buscarRegla(
  req: Request,
): { regla: RutaAuditada; idDeLaRuta: number | null } | null {
  const ruta = req.originalUrl.split("?")[0];

  for (const regla of RUTAS_AUDITADAS) {
    if (regla.metodo !== req.method) continue;

    const coincidencia = ruta.match(regla.patron);
    if (!coincidencia) continue;

    // El grupo 1, si existe, es el id que venía en la ruta.
    const idDeLaRuta = coincidencia[1] !== undefined ? Number(coincidencia[1]) : null;
    return { regla, idDeLaRuta };
  }

  return null;
}

/**
 * Arma el texto descriptivo que se guarda en `detalle`.
 *
 * Se prioriza lo que identifica a la entidad para un humano que lee el log
 * meses después: el nombre de la sede, la descripción de la especialidad, la
 * fecha y hora del turno.
 *
 * Las bajas son el caso pobre: un DELETE no trae cuerpo y su respuesta no trae
 * datos, así que no hay nombre que poner. Ahí se cae al id, que es lo único que
 * se sabe. Es poco, pero "BAJA de sede: id 8" sigue siendo más útil que un
 * campo vacío para alguien que revisa el log.
 *
 * @param regla Regla que matcheó.
 * @param cuerpo Cuerpo de la petición (puede venir vacío en un DELETE).
 * @param datos Propiedad `datos` de la respuesta que se está por enviar.
 * @param idEntidad Id de la entidad afectada, si se conoce.
 * @returns El detalle, o `null` si no hubo absolutamente nada que registrar.
 */
function armarDetalle(
  regla: RutaAuditada,
  cuerpo: unknown,
  datos: unknown,
  idEntidad: number | null,
): string | null {
  const fuente: Record<string, unknown> = {
    ...(typeof datos === "object" && datos !== null ? datos : {}),
    ...(typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}),
  };

  const texto = (clave: string): string | null =>
    typeof fuente[clave] === "string" && fuente[clave] !== "" ? (fuente[clave] as string) : null;

  let descripcion: string | null = null;

  switch (regla.entidad) {
    case "usuario":
      // Nunca la contraseña, ni siquiera hasheada: el log lo lee un humano.
      descripcion = [texto("apellido"), texto("nombre")].filter(Boolean).join(", ") || null;
      break;
    case "sede":
    case "cobertura":
      descripcion = texto("nombre");
      break;
    case "especialidad":
      descripcion = texto("descripcion");
      break;
    case "agenda":
    case "turno": {
      const fecha = texto("fecha");
      const hora = texto("hora") ?? texto("hora_entrada");
      descripcion = [fecha, hora].filter(Boolean).join(" ") || null;
      break;
    }
  }

  if (!descripcion && idEntidad !== null) descripcion = `id ${idEntidad}`;

  return descripcion ? `${regla.accion} de ${regla.entidad}: ${descripcion}` : null;
}

/**
 * Middleware de auditoría. Se monta una sola vez, antes de las rutas.
 *
 * No corta la cadena nunca ni modifica la respuesta: solo observa. Si algo de
 * lo que hace fallara, la petición tiene que seguir su curso igual, así que
 * todo el trabajo va dentro de un try/catch.
 *
 * @param req Petición en curso.
 * @param res Respuesta, cuyo `json` se envuelve.
 * @param next Continuación de la cadena.
 */
export function auditar(req: Request, res: Response, next: NextFunction): void {
  const encontrado = buscarRegla(req);

  // La enorme mayoría de las peticiones son lecturas: se sale enseguida y no
  // se les envuelve nada.
  if (!encontrado) {
    next();
    return;
  }

  const { regla, idDeLaRuta } = encontrado;
  const cuerpo = req.body;
  const jsonOriginal = res.json.bind(res);

  res.json = (payload: unknown): Response => {
    // Se responde SIEMPRE primero. Lo que venga después no puede afectar al
    // cliente, que ya tiene su respuesta.
    const resultado = jsonOriginal(payload);

    try {
      // Solo se auditan las operaciones que salieron bien. Un 400 o un 403 no
      // cambiaron nada en la base, así que no hay nada que registrar.
      if (res.statusCode < 200 || res.statusCode >= 300) return resultado;

      const datos =
        typeof payload === "object" && payload !== null
          ? (payload as { datos?: unknown }).datos
          : null;

      const datosObjeto =
        typeof datos === "object" && datos !== null
          ? (datos as Record<string, unknown>)
          : {};

      // En un alta el id no venía en la ruta: lo trae la respuesta.
      const idEntidad =
        idDeLaRuta ??
        (typeof datosObjeto.id === "number" ? datosObjeto.id : null);

      // Quién hizo la acción sale del token. La excepción es el registro, que
      // es público y no lo tiene: ahí el actor es el propio usuario que se
      // acaba de crear. Es discutible —no hay un tercero que lo dé de alta—,
      // pero deja el alta registrada, que es lo que pide la consigna, y la
      // columna es NOT NULL con clave foránea, así que no puede quedar vacía.
      const idUsuario = req.usuario?.id ?? idEntidad;

      if (idUsuario === null) return resultado;

      const entrada: EntradaAuditoria = {
        id_usuario: idUsuario,
        accion: regla.accion,
        entidad: regla.entidad,
        id_entidad: idEntidad,
        detalle: armarDetalle(regla, cuerpo, datos, idEntidad),
      };

      // Sin await a propósito: el registro no debe demorar la respuesta.
      // `registrarLog` no lanza, pero se encadena un catch por las dudas, para
      // que un rechazo inesperado no termine en un unhandled rejection.
      void auditoriaService.registrarLog(entrada).catch(() => undefined);
    } catch (error) {
      console.error("[auditoría] error al preparar la entrada del log", error);
    }

    return resultado;
  };

  next();
}
