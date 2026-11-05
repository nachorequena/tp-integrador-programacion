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
 *
 * Con qué se conecta: lo importan los validators (que devuelven estos tipos),
 * los services (que los reciben y devuelven) y los controllers. Las secciones
 * están ordenadas por semana; la última es la de la etapa frontend.
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

/** Fila de la tabla `especialidad`. Ojo: el campo es `descripcion`, no `nombre`. */
export interface Especialidad {
  id: number;
  descripcion: string;
}

/**
 * Fila de la tabla `agenda`: un rango horario que un médico atiende en una
 * sede, para una especialidad y una fecha concretas.
 *
 * Las horas son `varchar(5)` en la base ("15:00"), no un tipo `time`.
 */
export interface Agenda {
  id: number;
  hora_entrada: string;
  hora_salida: string;
  /** Formato "YYYY-MM-DD". */
  fecha: string;
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
}

/**
 * Fila de agenda con los nombres resueltos por JOIN.
 *
 * Es lo que devuelve el listado: con los ids sueltos, quien consume la API
 * necesitaría una llamada extra por cada uno para saber de qué médico, sede o
 * especialidad se trata.
 */
export interface AgendaDetallada extends Agenda {
  medico: string;
  especialidad: string;
  sede: string;
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

/** Cuerpo ya validado del alta/modificación de una sede. */
export interface DatosSede {
  nombre: string;
  direccion: string;
  telefono: string;
}

/** Cuerpo ya validado del alta/modificación de una especialidad. */
export interface DatosEspecialidad {
  descripcion: string;
}

/** Cuerpo ya validado del alta/modificación de una cobertura. */
export interface DatosCobertura {
  nombre: string;
}

/** Cuerpo ya validado del alta/modificación de una agenda. */
export interface DatosAgenda {
  hora_entrada: string;
  hora_salida: string;
  fecha: string;
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
}

/**
 * Filtros del listado de agenda, ya validados. Los tres son opcionales y se
 * combinan entre sí (`GET /agendas?id_sede=1&fecha=2025-10-20`).
 */
export interface FiltrosAgenda {
  id_medico?: number;
  id_sede?: number;
  fecha?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   SEMANA 3 — turnos, historial clínico y notificaciones
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Fila de la tabla `turno`.
 *
 * `fecha` y `hora` se guardan duplicadas respecto de la agenda a propósito: la
 * agenda define el rango (08:00–12:00) y el turno el momento puntual dentro de
 * ese rango. `hora` es `varchar(5)` como en agenda, no un tipo `time`.
 */
export interface Turno {
  id: number;
  /** `varchar(40)` en la base: el largo se valida antes de insertar. */
  nota: string | null;
  id_agenda: number;
  /** Formato "YYYY-MM-DD". */
  fecha: string | null;
  /** Formato "HH:MM". */
  hora: string | null;
  id_paciente: number;
  id_cobertura: number;
  /** `confirmado` | `cancelado` | `atendido`. */
  estado: string;
}

/**
 * Cuerpo ya validado de `POST /turnos`.
 *
 * No incluye `id_cobertura` a propósito: la consigna exige que la cobertura se
 * tome de la registrada por el paciente y que no pueda pisarse desde el
 * endpoint. Al no estar en el tipo, el service no puede leerla del body ni por
 * accidente.
 */
export interface DatosNuevoTurno {
  id_especialidad: number;
  id_sede: number;
  id_medico: number;
  fecha: string;
  hora: string;
  nota: string;
  /** Solo lo manda un operador que saca el turno en nombre de un paciente. */
  id_paciente?: number;
}

/** Fila de la tabla `historial_clinico`. */
export interface HistorialClinico {
  id: number;
  id_turno: number;
  id_medico: number;
  id_paciente: number;
  diagnostico: string;
  tratamiento: string | null;
  observaciones: string | null;
  fecha_registro: string;
}

/** Cuerpo ya validado de `POST /historial/:idTurno`. */
export interface DatosHistorial {
  diagnostico: string;
  tratamiento?: string;
  observaciones?: string;
}

/**
 * Fila de la tabla `notificacion`.
 *
 * `leida` es `tinyint(1)`: MySQL no tiene booleano real, así que viaja como
 * 0 o 1 y se tipa como `number` para no mentir sobre lo que llega.
 */
export interface Notificacion {
  id: number;
  id_usuario: number;
  tipo: string;
  mensaje: string;
  leida: number;
  fecha: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   SEMANA 4 — auditoría, reportes y cierre
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Acciones que registra la auditoría.
 *
 * Los tres valores salen textuales de la consigna. Se tipan como unión y no
 * como `string` para que sea imposible escribir "MODIFICACIÓN" con acento o
 * "modificacion" en minúscula y ensuciar el log sin que nadie se dé cuenta.
 */
export type AccionAuditoria = "ALTA" | "BAJA" | "MODIFICACION";

/** Fila de la tabla `log_auditoria`. */
export interface LogAuditoria {
  id: number;
  id_usuario: number;
  accion: AccionAuditoria;
  entidad: string;
  id_entidad: number | null;
  detalle: string | null;
  fecha: string;
}

/** Datos con los que el middleware arma una entrada del log. */
export interface EntradaAuditoria {
  id_usuario: number;
  accion: AccionAuditoria;
  entidad: string;
  id_entidad: number | null;
  detalle: string | null;
}

/**
 * Filtros del listado de auditoría, ya validados.
 *
 * Los cuatro son opcionales y se combinan con AND.
 */
export interface FiltrosAuditoria {
  id_usuario?: number;
  /**
   * Texto a buscar en apellido, nombre o DNI de quien hizo la acción. Lo usa
   * el filtro "por usuario" de la pantalla de auditoría del frontend, que es
   * más usable que pedir un id.
   */
  usuario?: string;
  entidad?: string;
  desde?: string;
  hasta?: string;
}

/**
 * Rango de fechas de los reportes, ya validado.
 *
 * Ambos extremos son opcionales e inclusivos: sin ninguno, el reporte abarca
 * todo el histórico.
 */
export interface RangoFechas {
  desde?: string;
  hasta?: string;
}

/** Una fila de los reportes que cuentan turnos agrupados por algo. */
export interface ConteoTurnos {
  id: number;
  nombre: string;
  cantidad: number;
}

/** Una fila del ranking de médicos por turnos atendidos. */
export interface MedicoRanking {
  id_medico: number;
  medico: string;
  atendidos: number;
}

/**
 * Resultado del reporte de tasa de cancelación.
 *
 * `tasa` viaja como número entre 0 y 1 con dos decimales, no como el texto
 * "12%": darle formato es problema de quien lo muestra, no de la API.
 */
export interface TasaCancelacion {
  total: number;
  cancelados: number;
  tasa: number;
}

/* ══════════════════════════════════════════════════════════════════════════
   ETAPA FRONTEND — ajustes de la API pedidos por la consigna final
   (docs/Frontend-enunciado-completo.pdf, "Sugerencias de cambios en el backend")
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Agenda con los nombres resueltos y la cantidad de turnos que la usan.
 *
 * Los conteos los necesita el frontend para no ofrecer acciones que el
 * backend va a rechazar: con `turnos_confirmados > 0` la baja del rango se
 * deshabilita en la interfaz, como pide el criterio de aceptación.
 */
export interface AgendaConTurnos extends AgendaDetallada {
  turnos_confirmados: number;
  turnos_totales: number;
}

/** Especialidad de un médico, tal como viaja dentro de `MedicoListado`. */
export interface EspecialidadDeMedico {
  id: number;
  descripcion: string;
}

/**
 * Médico tal como lo devuelve `GET /medicos`.
 *
 * Solo nombre, apellido, sede y especialidades: la consigna pide
 * explícitamente "sin otros datos personales", porque este listado lo ve
 * cualquier usuario con sesión (incluidos los pacientes).
 */
export interface MedicoListado {
  id: number;
  nombre: string;
  apellido: string;
  id_sede: number | null;
  especialidades: EspecialidadDeMedico[];
}

/** Filtros opcionales de `GET /medicos`, ya validados. */
export interface FiltrosMedico {
  id_especialidad?: number;
  id_sede?: number;
}

/**
 * Parámetros de las consultas de disponibilidad, ya validados.
 *
 * Médico, especialidad y sede son obligatorios: sin los tres no se puede
 * saber qué rangos de agenda mirar.
 */
export interface ConsultaDisponibilidad {
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
}

/**
 * Turno con todos los datos que muestra el frontend, resueltos por JOIN.
 *
 * Reemplaza a la fila pelada de `turno` en los listados: el médico necesita
 * nombre y fecha de nacimiento del paciente (para calcular la edad), el
 * paciente necesita médico, especialidad y sede, y si el turno fue atendido,
 * el resumen del historial clínico. Sin el JOIN, el frontend tendría que
 * resolver cada id con una llamada aparte.
 */
export interface TurnoDetallado extends Turno {
  id_medico: number;
  id_especialidad: number;
  id_sede: number;
  medico: string;
  especialidad: string;
  sede: string;
  paciente: string;
  dni_paciente: string;
  fecha_nacimiento_paciente: string;
  cobertura: string;
  diagnostico: string | null;
  tratamiento: string | null;
  observaciones: string | null;
}

/** Filtros opcionales extra de los listados diarios de turnos. */
export interface FiltrosTurnosDia {
  fecha: string;
  id_sede?: number;
  id_medico?: number;
}

/**
 * Registro del historial con los datos del turno al que pertenece.
 *
 * Un diagnóstico suelto no dice nada si no se sabe de qué consulta salió:
 * fecha, médico y especialidad del turno lo ponen en contexto.
 */
export interface HistorialDetallado extends HistorialClinico {
  fecha_turno: string | null;
  hora_turno: string | null;
  medico: string;
  especialidad: string;
  sede: string;
}

/**
 * Paciente tal como lo devuelve la búsqueda `GET /pacientes`.
 *
 * Trae la cobertura porque el operador la muestra en el resumen del turno
 * que saca en nombre del paciente.
 */
export interface PacienteEncontrado {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string;
  id_cobertura: number | null;
  cobertura: string | null;
}

/**
 * Cuerpo ya validado de `PUT /pacientes/mis-datos`.
 *
 * Son los únicos cuatro campos que la consigna deja modificar al paciente. La
 * contraseña es opcional: si no viene, se conserva la actual.
 */
export interface DatosMisDatos {
  email: string;
  telefono: string;
  id_cobertura: number;
  password?: string;
}

/**
 * Cuerpo ya validado del alta o edición de un usuario por el administrador.
 *
 * - `password` es obligatoria en el alta y opcional en la edición.
 * - `id_sede` va con valor solo para operador y médico (el admin opera sobre
 *   todas las sedes y el paciente no pertenece a ninguna).
 * - `id_cobertura` solo aplica al paciente.
 * - `especialidades` solo aplica al médico (filas de `medico_especialidad`).
 */
export interface DatosUsuarioAdmin {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono: string;
  fecha_nacimiento: string;
  rol: Rol;
  password?: string;
  id_sede: number | null;
  id_cobertura: number | null;
  especialidades: number[];
}

/** Usuario del listado del administrador, con nombres y especialidades. */
export interface UsuarioListado extends UsuarioPublico {
  sede: string | null;
  cobertura: string | null;
  especialidades: number[];
}

/** Filtros del listado de usuarios, ya validados. */
export interface FiltrosUsuarios {
  nombre?: string;
  apellido?: string;
  rol?: Rol;
  id_sede?: number;
}

/** Página pedida de un listado paginado, ya validada. */
export interface Paginacion {
  /** Número de página, empezando en 1. */
  pagina: number;
  /** Cantidad de filas por página. */
  limite: number;
}

/**
 * Respuesta de un listado paginado.
 *
 * `total` es la cantidad de filas que cumplen los filtros en TODAS las
 * páginas: el paginador del frontend lo necesita para saber cuántas páginas
 * hay.
 */
export interface PaginaDe<T> extends Paginacion {
  items: T[];
  total: number;
}
