/**
 * DOCUMENTACIÓN DE LA API (OpenAPI 3)
 * ===================================
 *
 * Especificación completa de los endpoints de la API: los 37 de las cuatro
 * semanas de backend más los que agregó la etapa del frontend (médicos,
 * disponibilidad, pacientes y usuarios). La sirve `swagger-ui-express` en
 * `GET /docs` (ver `src/index.ts`).
 *
 * El criterio de aceptación pide que "alguien que no participó del desarrollo
 * entienda cómo consumir cada endpoint sin leer el código fuente". Por eso cada
 * operación documenta método, ruta, parámetros, cuerpo esperado, respuestas
 * posibles (éxito **y** error) y el rol que puede acceder.
 *
 * ── Por qué un objeto TypeScript y no un YAML ────────────────────────────────
 *
 * Un `.yaml` necesitaría una dependencia extra para parsearlo y no lo revisa
 * nadie hasta que se rompe. Escrito así, el compilador verifica que el objeto
 * esté bien formado y el editor autocompleta.
 *
 * ── Cómo mantenerla ──────────────────────────────────────────────────────────
 *
 * Un endpoint nuevo se agrega en `paths`, reutilizando los helpers de abajo
 * (`exito`, `errores`, `rango`). Los esquemas de las entidades viven en
 * `components.schemas` y se referencian con `$ref`, así un cambio en una
 * entidad se hace en un solo lugar.
 *
 * Con qué se conecta: lo importa `src/index.ts`, que lo sirve con
 * `swagger-ui-express` en `GET /docs`. Hay que actualizarlo cada vez que se
 * agrega o cambia un endpoint en `routes/`.
 */

/** Referencia a un esquema declarado en `components.schemas`. */
function ref(nombre: string): { $ref: string } {
  return { $ref: `#/components/schemas/${nombre}` };
}

/**
 * Arma una respuesta exitosa con el envoltorio uniforme del proyecto.
 *
 * Todas las respuestas de la API —éxito y error— tienen la misma forma:
 * `{ codigo, estado, datos }`. Documentarla acá una vez evita repetir la
 * estructura en las 37 operaciones y garantiza que la documentación no se
 * desincronice del helper `responder`.
 *
 * @param codigo Código HTTP.
 * @param descripcion Qué significa esta respuesta.
 * @param datos Esquema de la propiedad `datos`, o `null` si no devuelve nada.
 * @returns La entrada lista para el objeto `responses`.
 */
function exito(codigo: number, descripcion: string, datos: object | null = null) {
  return {
    [String(codigo)]: {
      description: descripcion,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              codigo: { type: "integer", example: codigo },
              estado: { type: "string", example: "ok" },
              datos: datos ?? { nullable: true, example: null },
            },
          },
        },
      },
    },
  };
}

/**
 * Arma las respuestas de error con el mismo envoltorio.
 *
 * @param entradas Pares de código y descripción del caso.
 * @returns Las entradas listas para el objeto `responses`.
 */
function errores(...entradas: [number, string][]) {
  const salida: Record<string, unknown> = {};

  for (const [codigo, descripcion] of entradas) {
    salida[String(codigo)] = {
      description: descripcion,
      content: {
        "application/json": {
          schema: ref("RespuestaError"),
          example: { codigo, estado: descripcion, datos: null },
        },
      },
    };
  }

  return salida;
}

/** Errores que puede devolver cualquier endpoint protegido por token. */
const ERRORES_AUTH: [number, string][] = [
  [401, "Falta el token, está vencido o es inválido"],
  [500, "Error interno del servidor"],
];

/** Los mismos, más el 403 de los endpoints restringidos por rol. */
const ERRORES_ROL: [number, string][] = [
  [401, "Falta el token, está vencido o es inválido"],
  [403, "El rol autenticado no tiene acceso a este endpoint"],
  [500, "Error interno del servidor"],
];

/** Parámetro de ruta `:id`. */
function paramId(nombre = "id", descripcion = "Id del recurso") {
  return {
    name: nombre,
    in: "path",
    required: true,
    schema: { type: "integer", minimum: 1 },
    description: descripcion,
  };
}

/** Parámetros de query `desde` y `hasta`, compartidos por reportes y auditoría. */
const rango = [
  {
    name: "desde",
    in: "query",
    required: false,
    schema: { type: "string", format: "date", example: "2025-01-01" },
    description: "Extremo inicial del rango, inclusivo. Formato YYYY-MM-DD.",
  },
  {
    name: "hasta",
    in: "query",
    required: false,
    schema: { type: "string", format: "date", example: "2025-12-31" },
    description: "Extremo final del rango, inclusivo. Formato YYYY-MM-DD.",
  },
];

/** Parámetros de query `pagina` y `limite` de los listados paginados. */
const paginacion = [
  {
    name: "pagina",
    in: "query",
    required: false,
    schema: { type: "integer", minimum: 1, default: 1 },
  },
  {
    name: "limite",
    in: "query",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
  },
];

/**
 * Esquema de una respuesta paginada: `{ items, total, pagina, limite }`.
 *
 * @param esquema Nombre del esquema de cada fila.
 */
function pagina(esquema: string) {
  return {
    type: "object",
    properties: {
      items: { type: "array", items: ref(esquema) },
      total: { type: "integer", example: 35 },
      pagina: { type: "integer", example: 1 },
      limite: { type: "integer", example: 10 },
    },
  };
}

/** Cuerpo JSON obligatorio con el esquema indicado. */
function cuerpo(nombreEsquema: string) {
  return {
    required: true,
    content: { "application/json": { schema: ref(nombreEsquema) } },
  };
}

/**
 * Especificación OpenAPI 3 completa de la API.
 *
 * La consume `swagger-ui-express` en `src/index.ts`.
 */
export const especificacion = {
  openapi: "3.0.3",
  info: {
    title: "API — Sistema de Gestión de Turnos Médicos",
    version: "5.0.0",
    description: [
      "TP Integrador de Programación 2. Backend de una clínica: usuarios, agenda",
      "médica, turnos, historial clínico, notificaciones, auditoría y reportes.",
      "",
      "## Formato de respuesta",
      "",
      "**Todos** los endpoints, tanto en éxito como en error, responden con la",
      "misma estructura:",
      "",
      "```json",
      '{ "codigo": 200, "estado": "ok", "datos": { } }',
      "```",
      "",
      "- `codigo`: el código HTTP, repetido en el cuerpo.",
      '- `estado`: `"ok"` si salió bien; si falló, el mensaje descriptivo del error.',
      "- `datos`: lo solicitado, o `null` cuando no hay nada que devolver.",
      "",
      "## Autenticación",
      "",
      "`POST /auth/login` devuelve un JWT. Mandarlo en cada petición protegida",
      "como `Authorization: Bearer <token>`. El payload lleva `id`, `rol` e",
      "`id_sede` (que es `null` para los pacientes).",
      "",
      "## Roles",
      "",
      "`admin` · `operador` · `medico` · `paciente`. Cada operación indica cuál",
      "puede usarla. Un rol no autorizado recibe **403**; sin token, **401**.",
      "",
      "> La consigna escribe *administrador*, pero la base carga el valor `admin`.",
      "> Manda la base.",
      "",
      "## Auditoría",
      "",
      "Las altas, bajas y modificaciones sobre usuarios, sedes, especialidades,",
      "coberturas, agendas y turnos se registran solas en `log_auditoria`. No hay",
      "endpoint para crearlas: se consultan con `GET /auditoria`.",
      "",
      "## Etapa frontend",
      "",
      "Para la entrega final del frontend se sumaron `GET /medicos`,",
      "`GET /disponibilidad/fechas`, `GET /disponibilidad/horarios`,",
      "`GET/POST /pacientes`, `PUT /pacientes/mis-datos` y `GET/POST/PUT /usuarios`;",
      "`GET /sedes` y `GET /especialidades` quedaron abiertos a cualquier usuario",
      "con sesión, y se ajustaron las reglas de agenda, turnos y auditoría (ver",
      "cada operación).",
    ].join("\n"),
  },
  servers: [{ url: "http://localhost:3000", description: "Entorno local" }],
  tags: [
    { name: "Salud", description: "Diagnóstico del servidor (semana 1)" },
    { name: "Autenticación", description: "Registro, login y perfil (semana 1)" },
    { name: "Sedes", description: "CRUD de sucursales (semana 2)" },
    { name: "Especialidades", description: "CRUD de especialidades (semana 2)" },
    { name: "Coberturas", description: "CRUD de obras sociales (semana 2)" },
    { name: "Agenda", description: "Rangos horarios de atención (semana 2)" },
    { name: "Turnos", description: "Alta, cancelación y atención (semana 3)" },
    { name: "Historial clínico", description: "Registro y consulta (semana 3)" },
    { name: "Notificaciones", description: "Avisos automáticos (semana 3)" },
    { name: "Auditoría", description: "Log de acciones sensibles (semana 4)" },
    { name: "Reportes", description: "Estadísticas para administración (semana 4)" },
    { name: "Médicos", description: "Listado de médicos con especialidades (etapa frontend)" },
    { name: "Disponibilidad", description: "Fechas y horarios libres (etapa frontend)" },
    { name: "Pacientes", description: "Búsqueda, alta y mis datos (etapa frontend)" },
    { name: "Usuarios", description: "Gestión de usuarios del administrador (etapa frontend)" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      RespuestaError: {
        type: "object",
        description: "Envoltorio uniforme de cualquier error de la API.",
        properties: {
          codigo: { type: "integer", example: 404 },
          estado: {
            type: "string",
            description: "Mensaje descriptivo del error.",
            example: "La sede indicada no existe",
          },
          datos: { nullable: true, example: null },
        },
      },
      Usuario: {
        type: "object",
        description: "Usuario sin la contraseña. Nunca se devuelve el hash.",
        properties: {
          id: { type: "integer", example: 2 },
          apellido: { type: "string", example: "Friggeri" },
          nombre: { type: "string", example: "Franco" },
          dni: { type: "string", maxLength: 8, example: "36000960" },
          email: { type: "string", maxLength: 30, example: "franco@mail.com" },
          telefono: { type: "string", maxLength: 10, example: "3424555555" },
          fecha_nacimiento: { type: "string", format: "date", example: "1998-03-14" },
          rol: { type: "string", enum: ["admin", "operador", "medico", "paciente"] },
          id_sede: { type: "integer", nullable: true, description: "null en pacientes" },
          id_cobertura: { type: "integer", nullable: true },
        },
      },
      DatosRegistro: {
        type: "object",
        required: [
          "nombre", "apellido", "dni", "email", "password",
          "telefono", "fecha_nacimiento", "id_cobertura",
        ],
        properties: {
          nombre: { type: "string", maxLength: 30, example: "Franco" },
          apellido: { type: "string", maxLength: 30, example: "Friggeri" },
          dni: { type: "string", maxLength: 8, example: "40123456" },
          email: { type: "string", maxLength: 30, example: "franco@mail.com" },
          password: { type: "string", minLength: 6, example: "secreta123" },
          telefono: {
            type: "string",
            maxLength: 10,
            example: "3424555555",
            description:
              "No figura en la consigna, pero la columna es NOT NULL sin default: " +
              "sin este campo el INSERT falla.",
          },
          fecha_nacimiento: { type: "string", format: "date", example: "1998-03-14" },
          id_cobertura: { type: "integer", example: 1 },
        },
      },
      DatosLogin: {
        type: "object",
        required: ["dni", "password"],
        properties: {
          dni: { type: "string", example: "18222333" },
          password: { type: "string", example: "admin123" },
        },
      },
      Sesion: {
        type: "object",
        description: "Lo que devuelve el login: el token y el usuario que lo pidió.",
        properties: {
          token: { type: "string", description: "JWT para el header Authorization" },
          usuario: ref("Usuario"),
        },
      },
      Sede: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          nombre: { type: "string", example: "Sede Centro" },
          direccion: { type: "string", example: "San Martín 123" },
          telefono: { type: "string", example: "3424000001" },
        },
      },
      DatosSede: {
        type: "object",
        required: ["nombre", "direccion", "telefono"],
        properties: {
          nombre: { type: "string", example: "Sede Sur" },
          direccion: { type: "string", example: "Belgrano 900" },
          telefono: { type: "string", example: "3424000003" },
        },
      },
      Especialidad: {
        type: "object",
        description: "Ojo: el campo es `descripcion`, no `nombre`.",
        properties: {
          id: { type: "integer", example: 1 },
          descripcion: { type: "string", example: "Traumatologia" },
        },
      },
      DatosEspecialidad: {
        type: "object",
        required: ["descripcion"],
        properties: { descripcion: { type: "string", example: "Cardiologia" } },
      },
      Cobertura: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          nombre: { type: "string", example: "Jerarquicos" },
        },
      },
      DatosCobertura: {
        type: "object",
        required: ["nombre"],
        properties: { nombre: { type: "string", example: "OSDE" } },
      },
      Agenda: {
        type: "object",
        description: "Un rango horario que un médico atiende en una sede y fecha.",
        properties: {
          id: { type: "integer", example: 2 },
          hora_entrada: { type: "string", example: "08:00" },
          hora_salida: { type: "string", example: "12:00" },
          fecha: { type: "string", format: "date", example: "2025-10-20" },
          id_medico: { type: "integer", example: 3 },
          id_especialidad: { type: "integer", example: 1 },
          id_sede: { type: "integer", example: 1 },
          medico: { type: "string", example: "Lopez, Ana" },
          especialidad: { type: "string", example: "Traumatologia" },
          sede: { type: "string", example: "Sede Centro" },
          turnos_confirmados: {
            type: "integer",
            example: 1,
            description: "Si es mayor que 0, la baja se rechaza con 409.",
          },
          turnos_totales: { type: "integer", example: 2 },
        },
      },
      DatosAgenda: {
        type: "object",
        required: [
          "hora_entrada", "hora_salida", "fecha",
          "id_medico", "id_especialidad", "id_sede",
        ],
        properties: {
          hora_entrada: { type: "string", example: "08:00", description: "HH:MM" },
          hora_salida: { type: "string", example: "12:00", description: "HH:MM" },
          fecha: { type: "string", format: "date", example: "2025-10-20" },
          id_medico: {
            type: "integer",
            example: 3,
            description: "Debe existir y tener rol `medico`.",
          },
          id_especialidad: { type: "integer", example: 1 },
          id_sede: { type: "integer", example: 1 },
        },
      },
      Turno: {
        type: "object",
        properties: {
          id: { type: "integer", example: 5 },
          nota: { type: "string", maxLength: 40, nullable: true },
          id_agenda: { type: "integer", example: 2 },
          fecha: { type: "string", format: "date", example: "2025-10-20" },
          hora: { type: "string", example: "09:00" },
          id_paciente: { type: "integer", example: 2 },
          id_cobertura: { type: "integer", example: 1 },
          estado: { type: "string", enum: ["confirmado", "cancelado", "atendido"] },
        },
      },
      TurnoDetallado: {
        description:
          "Turno con los nombres resueltos y, si fue atendido, el resumen del " +
          "historial clínico. Es lo que devuelven los listados y las acciones " +
          "sobre turnos desde la etapa frontend.",
        allOf: [
          ref("Turno"),
          {
            type: "object",
            properties: {
              id_medico: { type: "integer", example: 3 },
              id_especialidad: { type: "integer", example: 1 },
              id_sede: { type: "integer", example: 1 },
              medico: { type: "string", example: "Lopez, Ana" },
              especialidad: { type: "string", example: "Traumatologia" },
              sede: { type: "string", example: "Sede Centro" },
              paciente: { type: "string", example: "Friggeri, Franco" },
              dni_paciente: { type: "string", example: "36000960" },
              fecha_nacimiento_paciente: { type: "string", format: "date" },
              cobertura: { type: "string", example: "Jerarquicos" },
              diagnostico: { type: "string", nullable: true },
              tratamiento: { type: "string", nullable: true },
              observaciones: { type: "string", nullable: true },
            },
          },
        ],
      },
      Medico: {
        type: "object",
        description: "Médico sin datos personales más allá del nombre.",
        properties: {
          id: { type: "integer", example: 3 },
          nombre: { type: "string", example: "Ana" },
          apellido: { type: "string", example: "Lopez" },
          id_sede: { type: "integer", nullable: true, example: 1 },
          especialidades: { type: "array", items: ref("Especialidad") },
        },
      },
      HorarioLibre: {
        type: "object",
        properties: {
          hora: { type: "string", example: "09:30" },
          id_agenda: { type: "integer", example: 4 },
        },
      },
      PacienteEncontrado: {
        type: "object",
        properties: {
          id: { type: "integer", example: 2 },
          nombre: { type: "string", example: "Franco" },
          apellido: { type: "string", example: "Friggeri" },
          dni: { type: "string", example: "36000960" },
          fecha_nacimiento: { type: "string", format: "date" },
          id_cobertura: { type: "integer", nullable: true, example: 1 },
          cobertura: { type: "string", nullable: true, example: "Jerarquicos" },
        },
      },
      DatosMisDatos: {
        type: "object",
        required: ["email", "telefono", "id_cobertura"],
        description: "Únicos campos que el paciente puede modificar. Cualquier otro → 400.",
        properties: {
          email: { type: "string", maxLength: 30, example: "ffriggeri@mail.com" },
          telefono: { type: "string", maxLength: 10, example: "3425000000" },
          id_cobertura: { type: "integer", example: 2 },
          password: {
            type: "string",
            minLength: 6,
            description: "Opcional: si no viene, se conserva la actual.",
          },
        },
      },
      DatosUsuarioAdmin: {
        type: "object",
        required: ["nombre", "apellido", "dni", "email", "telefono", "fecha_nacimiento", "rol"],
        description:
          "Alta: `rol` ∈ admin/operador/medico y `password` obligatoria. Edición: " +
          "cualquier rol (no se puede cambiar el que tiene) y `password` opcional. " +
          "`id_sede` obligatorio para operador y médico; `especialidades` (al " +
          "menos una) para médico; `id_cobertura` para paciente.",
        properties: {
          nombre: { type: "string", maxLength: 30 },
          apellido: { type: "string", maxLength: 30 },
          dni: { type: "string", example: "30111222" },
          email: { type: "string", maxLength: 30 },
          telefono: { type: "string", maxLength: 10 },
          fecha_nacimiento: { type: "string", format: "date" },
          rol: { type: "string", enum: ["admin", "operador", "medico", "paciente"] },
          password: { type: "string", minLength: 6 },
          id_sede: { type: "integer", nullable: true },
          id_cobertura: { type: "integer", nullable: true },
          especialidades: { type: "array", items: { type: "integer" }, example: [1, 2] },
        },
      },
      UsuarioListado: {
        allOf: [
          ref("Usuario"),
          {
            type: "object",
            properties: {
              sede: { type: "string", nullable: true, example: "Sede Centro" },
              cobertura: { type: "string", nullable: true },
              especialidades: { type: "array", items: { type: "integer" } },
            },
          },
        ],
      },
      DatosNuevoTurno: {
        type: "object",
        required: ["id_especialidad", "id_sede", "id_medico", "fecha", "hora", "nota"],
        description:
          "`id_cobertura` NO se recibe: se toma de la registrada por el paciente, " +
          "para que no pueda pisarse desde este endpoint.",
        properties: {
          id_especialidad: { type: "integer", example: 1 },
          id_sede: { type: "integer", example: 1 },
          id_medico: { type: "integer", example: 3 },
          fecha: { type: "string", format: "date", example: "2025-10-20" },
          hora: {
            type: "string",
            example: "09:00",
            description:
              "HH:MM con dos dígitos. Debe caer dentro de un rango de la agenda " +
              "del médico; el extremo superior es exclusivo.",
          },
          nota: { type: "string", maxLength: 40, example: "Dolor de rodilla" },
          id_paciente: {
            type: "integer",
            example: 2,
            description:
              "Solo lo manda un operador que saca el turno en nombre de un " +
              "paciente. Si lo pide el propio paciente se ignora y sale del token.",
          },
        },
      },
      HistorialClinico: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          id_turno: { type: "integer", example: 2 },
          id_medico: { type: "integer", example: 3 },
          id_paciente: { type: "integer", example: 2 },
          diagnostico: { type: "string", maxLength: 255 },
          tratamiento: { type: "string", maxLength: 255, nullable: true },
          observaciones: { type: "string", maxLength: 255, nullable: true },
          fecha_registro: { type: "string", format: "date-time" },
        },
      },
      DatosHistorial: {
        type: "object",
        required: ["diagnostico"],
        properties: {
          diagnostico: { type: "string", maxLength: 255, example: "Tendinitis rotuliana" },
          tratamiento: { type: "string", maxLength: 255, example: "Kinesiología" },
          observaciones: { type: "string", maxLength: 255, example: "Control en 30 días" },
        },
      },
      Notificacion: {
        type: "object",
        properties: {
          id: { type: "integer", example: 3 },
          id_usuario: { type: "integer", example: 2 },
          tipo: {
            type: "string",
            enum: ["turno_confirmado", "turno_cancelado", "turno_atendido"],
          },
          mensaje: { type: "string", maxLength: 255 },
          leida: { type: "integer", enum: [0, 1], description: "0 = no leída" },
          fecha: { type: "string", format: "date-time" },
        },
      },
      LogAuditoria: {
        type: "object",
        properties: {
          id: { type: "integer", example: 2 },
          id_usuario: { type: "integer", example: 4 },
          usuario: { type: "string", example: "Gomez, Marcos" },
          accion: { type: "string", enum: ["ALTA", "BAJA", "MODIFICACION"] },
          entidad: {
            type: "string",
            enum: ["usuario", "sede", "especialidad", "cobertura", "agenda", "turno"],
          },
          id_entidad: { type: "integer", nullable: true },
          detalle: { type: "string", maxLength: 255, nullable: true },
          fecha: { type: "string", format: "date-time" },
        },
      },
      ConteoTurnos: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          nombre: { type: "string", example: "Traumatologia" },
          cantidad: { type: "integer", example: 12 },
        },
      },
      MedicoRanking: {
        type: "object",
        properties: {
          id_medico: { type: "integer", example: 3 },
          medico: { type: "string", example: "Lopez, Ana" },
          atendidos: { type: "integer", example: 7 },
        },
      },
      TasaCancelacion: {
        type: "object",
        properties: {
          total: { type: "integer", example: 20 },
          cancelados: { type: "integer", example: 3 },
          tasa: {
            type: "number",
            example: 0.15,
            description:
              "Proporción entre 0 y 1 con dos decimales. Un período sin turnos " +
              "devuelve 0, no null.",
          },
        },
      },
    },
  },
  paths: {
    // ── Semana 1 ────────────────────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["Salud"],
        summary: "Estado del servidor y de la base",
        description:
          "**Rol:** público, sin token.\n\n" +
          "Responde 503 si el servidor está arriba pero no alcanza la base. Es " +
          "deliberado que no exija token: tiene que poder consultarse justamente " +
          "cuando la base está caída y no se podrían emitir tokens.",
        responses: {
          ...exito(200, "Servidor y base operativos", {
            type: "object",
            properties: {
              servidor: { type: "string", example: "ok" },
              base_de_datos: { type: "string", example: "ok" },
            },
          }),
          ...errores([503, "No se pudo conectar a la base de datos"]),
        },
      },
    },
    "/auth/registro": {
      post: {
        tags: ["Autenticación"],
        summary: "Alta de paciente",
        description:
          "**Rol:** público, sin token.\n\n" +
          "El rol se asigna automáticamente como `paciente` y `id_sede` queda en " +
          "`null`. La contraseña se hashea con bcrypt antes de guardarse. " +
          "El `dni` y el `email` no pueden repetirse.\n\n" +
          "Queda registrado en la auditoría como `ALTA` de `usuario`.",
        requestBody: cuerpo("DatosRegistro"),
        responses: {
          ...exito(201, "Paciente creado", ref("Usuario")),
          ...errores(
            [400, "Faltan campos o alguno tiene formato inválido"],
            [409, "El DNI o el email ya están registrados"],
            [500, "Error interno del servidor"],
          ),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Autenticación"],
        summary: "Obtener un JWT",
        description:
          "**Rol:** público, sin token.\n\n" +
          "Devuelve el token y el usuario, para evitarle al cliente una segunda " +
          "llamada. Si las credenciales fallan, el mensaje es genérico a " +
          "propósito: distinguir entre DNI inexistente y contraseña incorrecta " +
          "permitiría averiguar qué DNI están registrados.",
        requestBody: cuerpo("DatosLogin"),
        responses: {
          ...exito(200, "Credenciales correctas", ref("Sesion")),
          ...errores(
            [400, "Faltan el dni o la password"],
            [401, "DNI o contraseña incorrectos"],
            [500, "Error interno del servidor"],
          ),
        },
      },
    },
    "/auth/perfil": {
      get: {
        tags: ["Autenticación"],
        summary: "Datos del usuario logueado",
        description:
          "**Rol:** cualquiera autenticado.\n\n" +
          "El id sale del token, nunca de la URL: no hay forma de pedir el perfil " +
          "de otro. Nunca devuelve la contraseña.",
        security: [{ bearerAuth: [] }],
        responses: {
          ...exito(200, "Perfil del usuario", ref("Usuario")),
          ...errores(...ERRORES_AUTH),
        },
      },
    },

    // ── Semana 2 ────────────────────────────────────────────────────────────
    "/coberturas/disponibles": {
      get: {
        tags: ["Coberturas"],
        summary: "Listado público de coberturas",
        description:
          "**Rol:** público, sin token.\n\n" +
          "Servicio de solo lectura que consume el formulario de registro. Existe " +
          "aparte de `GET /coberturas` porque el CRUD debe responder 403 a todo " +
          "rol que no sea admin, y el registro es público: las dos cosas no " +
          "entran en la misma ruta.",
        responses: {
          ...exito(200, "Coberturas disponibles", {
            type: "array",
            items: ref("Cobertura"),
          }),
          ...errores([500, "Error interno del servidor"]),
        },
      },
    },
    "/coberturas": {
      get: {
        tags: ["Coberturas"],
        summary: "Listado (CRUD)",
        description: "**Rol:** `admin`.",
        security: [{ bearerAuth: [] }],
        responses: {
          ...exito(200, "Coberturas", { type: "array", items: ref("Cobertura") }),
          ...errores(...ERRORES_ROL),
        },
      },
      post: {
        tags: ["Coberturas"],
        summary: "Alta de cobertura",
        description: "**Rol:** `admin`. Auditado como `ALTA` de `cobertura`.",
        security: [{ bearerAuth: [] }],
        requestBody: cuerpo("DatosCobertura"),
        responses: {
          ...exito(201, "Cobertura creada", ref("Cobertura")),
          ...errores([400, "El nombre es obligatorio"], ...ERRORES_ROL),
        },
      },
    },
    "/coberturas/{id}": {
      put: {
        tags: ["Coberturas"],
        summary: "Modificación",
        description: "**Rol:** `admin`. Auditado como `MODIFICACION` de `cobertura`.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id de la cobertura")],
        requestBody: cuerpo("DatosCobertura"),
        responses: {
          ...exito(200, "Cobertura actualizada", ref("Cobertura")),
          ...errores(
            [400, "El nombre es obligatorio"],
            [404, "La cobertura indicada no existe"],
            ...ERRORES_ROL,
          ),
        },
      },
      delete: {
        tags: ["Coberturas"],
        summary: "Baja",
        description:
          "**Rol:** `admin`. Auditado como `BAJA` de `cobertura`.\n\n" +
          "Antes de borrar se valida que no la esté usando ningún usuario ni " +
          "ningún turno. Si la está usando responde **409** con el detalle, " +
          "nunca un 500.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id de la cobertura")],
        responses: {
          ...exito(200, "Cobertura eliminada"),
          ...errores(
            [404, "La cobertura indicada no existe"],
            [409, "No se puede eliminar: la usan 2 usuarios afiliados"],
            ...ERRORES_ROL,
          ),
        },
      },
    },
    "/sedes": {
      get: {
        tags: ["Sedes"],
        summary: "Listado",
        description:
          "**Rol:** cualquier usuario con sesión (desde la etapa frontend: lo " +
          "usan los selectores de sede de todos los roles). Alta, modificación y " +
          "baja siguen siendo solo `admin`.",
        security: [{ bearerAuth: [] }],
        responses: {
          ...exito(200, "Sedes", { type: "array", items: ref("Sede") }),
          ...errores(...ERRORES_ROL),
        },
      },
      post: {
        tags: ["Sedes"],
        summary: "Alta de sede",
        description: "**Rol:** `admin`. Auditado como `ALTA` de `sede`.",
        security: [{ bearerAuth: [] }],
        requestBody: cuerpo("DatosSede"),
        responses: {
          ...exito(201, "Sede creada", ref("Sede")),
          ...errores([400, "Faltan campos obligatorios"], ...ERRORES_ROL),
        },
      },
    },
    "/sedes/{id}": {
      put: {
        tags: ["Sedes"],
        summary: "Modificación",
        description: "**Rol:** `admin`. Auditado como `MODIFICACION` de `sede`.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id de la sede")],
        requestBody: cuerpo("DatosSede"),
        responses: {
          ...exito(200, "Sede actualizada", ref("Sede")),
          ...errores(
            [400, "Faltan campos obligatorios"],
            [404, "La sede indicada no existe"],
            ...ERRORES_ROL,
          ),
        },
      },
      delete: {
        tags: ["Sedes"],
        summary: "Baja",
        description:
          "**Rol:** `admin`. Auditado como `BAJA` de `sede`.\n\n" +
          "Se valida que no tenga usuarios asignados ni agenda cargada. Si los " +
          "tiene responde **409**, nunca un 500.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id de la sede")],
        responses: {
          ...exito(200, "Sede eliminada"),
          ...errores(
            [404, "La sede indicada no existe"],
            [409, "No se puede eliminar: tiene 3 usuarios asignados, 1 agenda cargada"],
            ...ERRORES_ROL,
          ),
        },
      },
    },
    "/especialidades": {
      get: {
        tags: ["Especialidades"],
        summary: "Listado",
        description:
          "**Rol:** cualquier usuario con sesión (etapa frontend). Alta, " +
          "modificación y baja siguen siendo solo `admin`.",
        security: [{ bearerAuth: [] }],
        responses: {
          ...exito(200, "Especialidades", { type: "array", items: ref("Especialidad") }),
          ...errores(...ERRORES_ROL),
        },
      },
      post: {
        tags: ["Especialidades"],
        summary: "Alta de especialidad",
        description: "**Rol:** `admin`. Auditado como `ALTA` de `especialidad`.",
        security: [{ bearerAuth: [] }],
        requestBody: cuerpo("DatosEspecialidad"),
        responses: {
          ...exito(201, "Especialidad creada", ref("Especialidad")),
          ...errores([400, "La descripcion es obligatoria"], ...ERRORES_ROL),
        },
      },
    },
    "/especialidades/{id}": {
      put: {
        tags: ["Especialidades"],
        summary: "Modificación",
        description: "**Rol:** `admin`. Auditado como `MODIFICACION` de `especialidad`.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id de la especialidad")],
        requestBody: cuerpo("DatosEspecialidad"),
        responses: {
          ...exito(200, "Especialidad actualizada", ref("Especialidad")),
          ...errores(
            [400, "La descripcion es obligatoria"],
            [404, "La especialidad indicada no existe"],
            ...ERRORES_ROL,
          ),
        },
      },
      delete: {
        tags: ["Especialidades"],
        summary: "Baja",
        description:
          "**Rol:** `admin`. Auditado como `BAJA` de `especialidad`.\n\n" +
          "Se valida que ningún médico la tenga asociada y que no haya agenda " +
          "cargada con ella. Si la hay responde **409**, nunca un 500.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id de la especialidad")],
        responses: {
          ...exito(200, "Especialidad eliminada"),
          ...errores(
            [404, "La especialidad indicada no existe"],
            [409, "No se puede eliminar: tiene 1 médicos asociados"],
            ...ERRORES_ROL,
          ),
        },
      },
    },
    "/agendas": {
      get: {
        tags: ["Agenda"],
        summary: "Listado filtrable",
        description:
          "**Rol:** `medico`, `operador`, `admin`.\n\n" +
          "Los tres filtros son opcionales y se combinan. Si quien consulta es " +
          "`medico`, el filtro `id_medico` se fuerza a su propio id sin importar " +
          "lo que mande: no puede ver la agenda de un colega.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id_medico",
            in: "query",
            required: false,
            schema: { type: "integer" },
            description: "Ignorado si el rol es `medico`.",
          },
          { name: "id_sede", in: "query", required: false, schema: { type: "integer" } },
          {
            name: "fecha",
            in: "query",
            required: false,
            schema: { type: "string", format: "date" },
          },
        ],
        responses: {
          ...exito(200, "Agendas que cumplen los filtros", {
            type: "array",
            items: ref("Agenda"),
          }),
          ...errores([400, "Algún filtro tiene formato inválido"], ...ERRORES_ROL),
        },
      },
      post: {
        tags: ["Agenda"],
        summary: "Alta de un rango horario",
        description:
          "**Rol:** `medico` (solo con su propio `id_medico`), `operador` (solo en " +
          "su sede, desde la etapa frontend), `admin`.\n\n" +
          "El médico tiene que tener asignada la especialidad (400 si no).\n\n" +
          "Auditado como `ALTA` de `agenda`. Se rechaza con **409** si el rango " +
          "pisa otro del mismo médico en la misma fecha. Varios rangos por día " +
          "están permitidos mientras no se solapen; los contiguos se aceptan.",
        security: [{ bearerAuth: [] }],
        requestBody: cuerpo("DatosAgenda"),
        responses: {
          ...exito(201, "Agenda creada", ref("Agenda")),
          ...errores(
            [400, "Datos inválidos, o el id_medico no corresponde a un médico"],
            [403, "Un médico solo puede crear agenda para sí mismo / el operador solo en su sede"],
            [409, "El médico ya tiene una agenda de 08:00 a 12:00 esa fecha"],
            [401, "Falta el token, está vencido o es inválido"],
            [500, "Error interno del servidor"],
          ),
        },
      },
    },
    "/agendas/{id}": {
      put: {
        tags: ["Agenda"],
        summary: "Modificación",
        description:
          "**Rol:** `medico` (solo la propia), `operador` (solo su sede), `admin`.\n\n" +
          "Auditado como `MODIFICACION` de `agenda`. La pertenencia se controla " +
          "dos veces: sobre la fila existente y sobre los datos nuevos.\n\n" +
          "Si el rango tiene turnos **confirmados**, responde **409** si el nuevo " +
          "horario deja alguno afuera o si se cambia fecha, médico, especialidad " +
          "o sede.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id de la agenda")],
        requestBody: cuerpo("DatosAgenda"),
        responses: {
          ...exito(200, "Agenda actualizada", ref("Agenda")),
          ...errores(
            [400, "Datos inválidos"],
            [403, "Solo podés gestionar tu propia agenda"],
            [404, "La agenda indicada no existe"],
            [409, "El rango se solapa con otro, o deja turnos confirmados afuera"],
            [401, "Falta el token, está vencido o es inválido"],
            [500, "Error interno del servidor"],
          ),
        },
      },
      delete: {
        tags: ["Agenda"],
        summary: "Baja",
        description:
          "**Rol:** `medico` (solo la propia), `operador` (solo su sede), `admin`.\n\n" +
          "Auditado como `BAJA` de `agenda`. Con turnos confirmados responde " +
          "**409** (hay que cancelarlos primero); con turnos atendidos o " +
          "cancelados también, para conservar el historial. Nunca un 500.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id de la agenda")],
        responses: {
          ...exito(200, "Agenda eliminada"),
          ...errores(
            [403, "Solo podés gestionar tu propia agenda"],
            [404, "La agenda indicada no existe"],
            [409, "No se puede eliminar el rango porque tiene 2 turno(s) confirmado(s)"],
            [401, "Falta el token, está vencido o es inválido"],
            [500, "Error interno del servidor"],
          ),
        },
      },
    },

    // ── Semana 3 ────────────────────────────────────────────────────────────
    "/turnos": {
      post: {
        tags: ["Turnos"],
        summary: "Solicitar un turno",
        description:
          "**Rol:** `paciente` (para sí mismo) u `operador` (en representación " +
          "de un paciente de su sede).\n\n" +
          "Auditado como `ALTA` de `turno`. El turno se crea en estado " +
          "`confirmado` y genera una notificación para el paciente.\n\n" +
          "La cobertura se toma de la registrada por el paciente y **no puede " +
          "pisarse** desde este endpoint.\n\n" +
          "Desde la etapa frontend: el horario tiene que ser futuro, caer en la " +
          "grilla de 30 minutos de un rango de la agenda (los mismos horarios que " +
          "ofrece `GET /disponibilidad/horarios`) y no estar tomado. El alta es " +
          "transaccional: si dos pedidos llegan al mismo horario, el segundo " +
          "recibe 409. Notifica al paciente, al médico y al operador si fue él.",
        security: [{ bearerAuth: [] }],
        requestBody: cuerpo("DatosNuevoTurno"),
        responses: {
          ...exito(201, "Turno confirmado (detallado, con `mensaje`)", ref("TurnoDetallado")),
          ...errores(
            [400, "El horario solicitado no está disponible en la agenda del médico"],
            [403, "El operador solo puede solicitar turnos de su propia sede"],
            [404, "Paciente no encontrado"],
            [409, "Ese horario ya fue tomado por otro paciente. Elegí otro horario."],
            [401, "Falta el token, está vencido o es inválido"],
            [500, "Error interno del servidor"],
          ),
        },
      },
    },
    "/turnos/mios": {
      get: {
        tags: ["Turnos"],
        summary: "Mis turnos",
        description:
          "**Rol:** `paciente`.\n\n" +
          "Ordenados del más próximo al menos próximo. El paciente sale del " +
          "token: no hay forma de pedir los turnos de otro.",
        security: [{ bearerAuth: [] }],
        responses: {
          ...exito(200, "Turnos del paciente: primero los próximos, después los pasados", {
            type: "array",
            items: ref("TurnoDetallado"),
          }),
          ...errores(...ERRORES_ROL),
        },
      },
    },
    "/turnos/medico": {
      get: {
        tags: ["Turnos"],
        summary: "Turnos programados del médico para una fecha",
        description:
          "**Rol:** `medico`. El médico sale del token. Sin `id_sede`, trae los " +
          "turnos de todas las sedes donde atiende ese día.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "fecha",
            in: "query",
            required: true,
            schema: { type: "string", format: "date", example: "2025-10-20" },
          },
          { name: "id_sede", in: "query", required: false, schema: { type: "integer" } },
        ],
        responses: {
          ...exito(200, "Turnos del día", { type: "array", items: ref("TurnoDetallado") }),
          ...errores([400, "La fecha es obligatoria"], ...ERRORES_ROL),
        },
      },
    },
    "/turnos/sede": {
      get: {
        tags: ["Turnos"],
        summary: "Turnos de la sede para una fecha",
        description:
          "**Rol:** `operador`. La sede sale del token. `id_medico` opcional " +
          "filtra los de un médico (lo usa el ícono de \"ojo\" de la agenda).",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "fecha",
            in: "query",
            required: true,
            schema: { type: "string", format: "date", example: "2025-10-20" },
          },
          { name: "id_medico", in: "query", required: false, schema: { type: "integer" } },
        ],
        responses: {
          ...exito(200, "Turnos de la sede", { type: "array", items: ref("TurnoDetallado") }),
          ...errores(
            [400, "La fecha es obligatoria"],
            [403, "El usuario no tiene una sede asignada"],
            [401, "Falta el token, está vencido o es inválido"],
            [500, "Error interno del servidor"],
          ),
        },
      },
    },
    "/turnos/{id}/cancelar": {
      patch: {
        tags: ["Turnos"],
        summary: "Cancelar un turno",
        description:
          "**Rol:** `paciente` (solo el suyo), `operador` (solo los de su sede) " +
          "y `medico` (solo los suyos, en cualquier sede donde atienda: la " +
          "restricción de sede de la semana 3 se reemplazó en la etapa frontend).\n\n" +
          "Auditado como `BAJA` de `turno`. Pasa el estado a `cancelado` y genera " +
          "una notificación para el paciente. Solo se cancelan turnos " +
          "`confirmado`: uno ya cancelado o atendido responde 400.\n\n" +
          "Se usa PATCH y no PUT porque no se reemplaza el turno: cambia un campo.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id del turno")],
        responses: {
          ...exito(200, "Turno cancelado (detallado, con `mensaje`)", ref("TurnoDetallado")),
          ...errores(
            [400, "Solo se pueden cancelar turnos confirmados"],
            [403, "No podés cancelar un turno de otro paciente"],
            [404, "Turno no encontrado"],
            [401, "Falta el token, está vencido o es inválido"],
            [500, "Error interno del servidor"],
          ),
        },
      },
    },
    "/turnos/{id}/atender": {
      patch: {
        tags: ["Turnos"],
        summary: "Marcar un turno como atendido",
        description:
          "**Rol:** `medico`, y solo sobre sus propios turnos (en cualquier sede).\n\n" +
          "Auditado como `MODIFICACION` de `turno`. Pasa el estado a `atendido` y " +
          "genera notificaciones.\n\n" +
          "El cuerpo es **opcional**: si trae `diagnostico` (más `tratamiento` y " +
          "`observaciones` opcionales), el historial clínico se guarda en la " +
          "misma transacción. Sin cuerpo, el historial se puede cargar después " +
          "con `POST /historial/{idTurno}`.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id del turno")],
        requestBody: {
          required: false,
          content: { "application/json": { schema: ref("DatosHistorial") } },
        },
        responses: {
          ...exito(200, "Turno atendido (detallado, con el historial)", ref("TurnoDetallado")),
          ...errores(
            [400, "Solo se pueden atender turnos confirmados"],
            [403, "El médico solo puede atender sus propios turnos"],
            [404, "Turno no encontrado"],
            [401, "Falta el token, está vencido o es inválido"],
            [500, "Error interno del servidor"],
          ),
        },
      },
    },
    "/historial/{idTurno}": {
      post: {
        tags: ["Historial clínico"],
        summary: "Registrar el resultado de una consulta",
        description:
          "**Rol:** `medico`, y solo sobre turnos que él mismo atendió.\n\n" +
          "El turno tiene que estar en estado `atendido`. Un turno no puede " +
          "tener dos historiales: el segundo intento responde 409.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("idTurno", "Id del turno ya atendido")],
        requestBody: cuerpo("DatosHistorial"),
        responses: {
          ...exito(201, "Historial registrado", {
            type: "object",
            properties: {
              id: { type: "integer", example: 2 },
              mensaje: {
                type: "string",
                example: "Historial clínico registrado correctamente",
              },
            },
          }),
          ...errores(
            [400, "El historial solo puede registrarse en un turno atendido"],
            [403, "El médico solo puede registrar historial de sus propios turnos"],
            [404, "Turno no encontrado"],
            [409, "El turno ya tiene un historial clínico registrado"],
            [401, "Falta el token, está vencido o es inválido"],
            [500, "Error interno del servidor"],
          ),
        },
      },
    },
    "/historial/mio": {
      get: {
        tags: ["Historial clínico"],
        summary: "Mi historial completo",
        description:
          "**Rol:** `paciente`.\n\n" +
          "La totalidad de su historial, del registro más reciente al más " +
          "antiguo. El paciente sale del token: nadie puede ver el de otro.",
        security: [{ bearerAuth: [] }],
        responses: {
          ...exito(200, "Historial del paciente", {
            type: "array",
            items: ref("HistorialClinico"),
          }),
          ...errores(...ERRORES_ROL),
        },
      },
    },
    "/historial/paciente/{idPaciente}": {
      get: {
        tags: ["Historial clínico"],
        summary: "Historial de un paciente, visto por el médico",
        description:
          "**Rol:** `medico`.\n\n" +
          "Devuelve **únicamente los registros que cargó este médico**. Si nunca " +
          "atendió a ese paciente, devuelve una lista vacía en lugar de un 403: " +
          'decir "existe pero no podés verlo" ya sería filtrar información ' +
          "clínica.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("idPaciente", "Id del paciente")],
        responses: {
          ...exito(200, "Registros cargados por este médico", {
            type: "array",
            items: ref("HistorialClinico"),
          }),
          ...errores([400, "Paciente inválido"], ...ERRORES_ROL),
        },
      },
    },
    "/notificaciones": {
      get: {
        tags: ["Notificaciones"],
        summary: "Mis notificaciones",
        description:
          "**Rol:** cualquiera autenticado.\n\n" +
          "De la más reciente a la más antigua. Cada usuario ve solo las suyas: " +
          "el filtro es por el id del token, no por rol.\n\n" +
          "No hay endpoint de alta a propósito: las notificaciones se generan " +
          "solas al confirmar, cancelar o atender un turno, siempre con " +
          "`leida = 0`. Poder crearlas desde afuera permitiría falsificarlas.",
        security: [{ bearerAuth: [] }],
        responses: {
          ...exito(200, "Notificaciones del usuario", {
            type: "array",
            items: ref("Notificacion"),
          }),
          ...errores(...ERRORES_AUTH),
        },
      },
    },
    "/notificaciones/{id}/leida": {
      patch: {
        tags: ["Notificaciones"],
        summary: "Marcar una notificación como leída",
        description:
          "**Rol:** cualquiera autenticado, sobre sus propias notificaciones.\n\n" +
          "El id del usuario va dentro del WHERE: marcar la notificación de otro " +
          "no afecta ninguna fila y responde 404, sin revelar si existe.",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id de la notificación")],
        responses: {
          ...exito(200, "Notificación marcada", {
            type: "object",
            properties: {
              mensaje: { type: "string", example: "Notificación marcada como leída" },
            },
          }),
          ...errores([404, "La notificación no existe"], ...ERRORES_AUTH),
        },
      },
    },

    // ── Semana 4 ────────────────────────────────────────────────────────────
    "/auditoria": {
      get: {
        tags: ["Auditoría"],
        summary: "Consultar el log de acciones sensibles",
        description:
          "**Rol:** `admin`.\n\n" +
          "Los filtros son opcionales y se combinan con AND. El rango de " +
          "fechas es inclusivo en los dos extremos. Desde la etapa frontend la " +
          "respuesta es **paginada** (`pagina`, `limite`, máx. 50) y suma el " +
          "filtro de texto `usuario` (apellido, nombre o DNI).\n\n" +
          "Las entradas las escribe automáticamente un middleware ante cada alta, " +
          "baja o modificación sobre `usuario`, `sede`, `especialidad`, " +
          "`cobertura`, `agenda` y `turno`. No existe endpoint para crearlas, " +
          "modificarlas ni borrarlas: un log que se puede editar no prueba nada.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id_usuario",
            in: "query",
            required: false,
            schema: { type: "integer" },
            description: "Quién realizó la acción.",
          },
          {
            name: "usuario",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Apellido, nombre o DNI de quien realizó la acción.",
          },
          {
            name: "entidad",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["usuario", "sede", "especialidad", "cobertura", "agenda", "turno"],
            },
          },
          ...rango,
          ...paginacion,
        ],
        responses: {
          ...exito(
            200,
            "Página del log, de la entrada más reciente a la más antigua",
            pagina("LogAuditoria"),
          ),
          ...errores([400, "Algún filtro tiene formato inválido"], ...ERRORES_ROL),
        },
      },
    },
    "/reportes/turnos-por-especialidad": {
      get: {
        tags: ["Reportes"],
        summary: "Cantidad de turnos por especialidad",
        description:
          "**Rol:** `admin`.\n\n" +
          "Ordenado de la especialidad más pedida a la menos. Incluye las " +
          "especialidades **sin turnos**, con cantidad 0: un tablero que oculta " +
          "lo que nadie pide es el que no deja verlo.",
        security: [{ bearerAuth: [] }],
        parameters: rango,
        responses: {
          ...exito(200, "Conteo por especialidad", {
            type: "array",
            items: ref("ConteoTurnos"),
          }),
          ...errores([400, "desde no puede ser posterior a hasta"], ...ERRORES_ROL),
        },
      },
    },
    "/reportes/turnos-por-sede": {
      get: {
        tags: ["Reportes"],
        summary: "Cantidad de turnos por sede",
        description:
          "**Rol:** `admin`.\n\n" +
          "Mismo criterio que el reporte por especialidad: incluye las sedes sin " +
          "movimiento, con cantidad 0.",
        security: [{ bearerAuth: [] }],
        parameters: rango,
        responses: {
          ...exito(200, "Conteo por sede", { type: "array", items: ref("ConteoTurnos") }),
          ...errores([400, "desde no puede ser posterior a hasta"], ...ERRORES_ROL),
        },
      },
    },
    "/reportes/ranking-medicos": {
      get: {
        tags: ["Reportes"],
        summary: "Ranking de médicos por turnos atendidos",
        description:
          "**Rol:** `admin`.\n\n" +
          "Devuelve la **lista completa** ordenada de mayor a menor, no solo el " +
          "primero. Cuenta únicamente turnos en estado `atendido`: uno confirmado " +
          "todavía no se atendió y uno cancelado nunca se va a atender.\n\n" +
          "Incluye a los médicos con 0 atendidos.",
        security: [{ bearerAuth: [] }],
        parameters: rango,
        responses: {
          ...exito(200, "Ranking de médicos", {
            type: "array",
            items: ref("MedicoRanking"),
          }),
          ...errores([400, "desde no puede ser posterior a hasta"], ...ERRORES_ROL),
        },
      },
    },
    "/reportes/tasa-cancelacion": {
      get: {
        tags: ["Reportes"],
        summary: "Tasa de cancelación del período",
        description:
          "**Rol:** `admin`.\n\n" +
          "Turnos cancelados sobre el total del período. Se calcula en una sola " +
          "consulta para que el total y los cancelados correspondan al mismo " +
          "instante. Un período sin turnos devuelve tasa 0, no `null`.",
        security: [{ bearerAuth: [] }],
        parameters: rango,
        responses: {
          ...exito(200, "Tasa de cancelación", ref("TasaCancelacion")),
          ...errores([400, "desde no puede ser posterior a hasta"], ...ERRORES_ROL),
        },
      },
    },

    // ── Etapa frontend ──────────────────────────────────────────────────────
    "/medicos": {
      get: {
        tags: ["Médicos"],
        summary: "Médicos con sus especialidades",
        description:
          "**Rol:** cualquier usuario con sesión.\n\n" +
          "Solo nombre, apellido, sede y especialidades (sin otros datos " +
          "personales). Filtros opcionales: `id_especialidad` (tiene esa " +
          "especialidad) e `id_sede` (es su sede o tiene agenda desde hoy en esa sede).",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id_especialidad", in: "query", required: false, schema: { type: "integer" } },
          { name: "id_sede", in: "query", required: false, schema: { type: "integer" } },
        ],
        responses: {
          ...exito(200, "Médicos", { type: "array", items: ref("Medico") }),
          ...errores([400, "Algún filtro tiene formato inválido"], ...ERRORES_AUTH),
        },
      },
    },
    "/disponibilidad/fechas": {
      get: {
        tags: ["Disponibilidad"],
        summary: "Fechas con agenda y algún horario libre",
        description:
          "**Rol:** `paciente`, `operador`.\n\n" +
          "Desde hoy en adelante, para un médico, una especialidad y una sede. No " +
          "devuelve datos de otros pacientes.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id_medico", in: "query", required: true, schema: { type: "integer" } },
          { name: "id_especialidad", in: "query", required: true, schema: { type: "integer" } },
          { name: "id_sede", in: "query", required: true, schema: { type: "integer" } },
        ],
        responses: {
          ...exito(200, "Fechas YYYY-MM-DD", {
            type: "array",
            items: { type: "string", format: "date" },
          }),
          ...errores([400, "Falta algún parámetro"], ...ERRORES_ROL),
        },
      },
    },
    "/disponibilidad/horarios": {
      get: {
        tags: ["Disponibilidad"],
        summary: "Horarios libres de una fecha",
        description:
          "**Rol:** `paciente`, `operador`.\n\n" +
          "Rangos de agenda del médico en esa especialidad, sede y fecha, " +
          "partidos en turnos de **30 minutos**, menos los turnos confirmados y " +
          "los horarios que ya pasaron. Son exactamente los que acepta `POST /turnos`.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id_medico", in: "query", required: true, schema: { type: "integer" } },
          { name: "id_especialidad", in: "query", required: true, schema: { type: "integer" } },
          { name: "id_sede", in: "query", required: true, schema: { type: "integer" } },
          {
            name: "fecha",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
          },
        ],
        responses: {
          ...exito(200, "Horarios libres", { type: "array", items: ref("HorarioLibre") }),
          ...errores([400, "Falta algún parámetro o la fecha no es válida"], ...ERRORES_ROL),
        },
      },
    },
    "/pacientes": {
      get: {
        tags: ["Pacientes"],
        summary: "Buscar pacientes por DNI o apellido",
        description:
          "**Rol:** `operador`, `medico`, `admin`.\n\n" +
          "`busqueda` (mín. 2 caracteres) coincide con el principio del DNI o " +
          "con cualquier parte del apellido. Máximo 20 resultados.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "busqueda", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          ...exito(200, "Pacientes", { type: "array", items: ref("PacienteEncontrado") }),
          ...errores([400, "busqueda debe tener al menos 2 caracteres"], ...ERRORES_ROL),
        },
      },
      post: {
        tags: ["Pacientes"],
        summary: "Alta de paciente por el operador",
        description:
          "**Rol:** `operador`. Mismos datos y validaciones que `POST /auth/registro`. " +
          "Auditado como `ALTA` de `usuario` (actor: el operador).",
        security: [{ bearerAuth: [] }],
        requestBody: cuerpo("DatosRegistro"),
        responses: {
          ...exito(201, "Paciente creado", ref("Usuario")),
          ...errores(
            [400, "Datos inválidos o la cobertura no existe"],
            [409, "El DNI ya está registrado"],
            ...ERRORES_ROL,
          ),
        },
      },
    },
    "/pacientes/mis-datos": {
      put: {
        tags: ["Pacientes"],
        summary: "El paciente modifica sus datos",
        description:
          "**Rol:** `paciente`. Solo email, contraseña (opcional, se guarda " +
          "hasheada), teléfono y cobertura. Auditado como `MODIFICACION` de `usuario`.",
        security: [{ bearerAuth: [] }],
        requestBody: cuerpo("DatosMisDatos"),
        responses: {
          ...exito(200, "Datos actualizados", ref("Usuario")),
          ...errores(
            [400, "Solo se pueden modificar email, password, telefono e id_cobertura"],
            [409, "El email ya está registrado por otro usuario"],
            ...ERRORES_ROL,
          ),
        },
      },
    },
    "/usuarios": {
      get: {
        tags: ["Usuarios"],
        summary: "Listado paginado de usuarios",
        description:
          "**Rol:** `admin`. Filtros opcionales: `nombre` y `apellido` (coincidencia " +
          "parcial), `rol` e `id_sede`.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "nombre", in: "query", required: false, schema: { type: "string" } },
          { name: "apellido", in: "query", required: false, schema: { type: "string" } },
          {
            name: "rol",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["admin", "operador", "medico", "paciente"] },
          },
          { name: "id_sede", in: "query", required: false, schema: { type: "integer" } },
          ...paginacion,
        ],
        responses: {
          ...exito(200, "Página de usuarios", pagina("UsuarioListado")),
          ...errores([400, "Algún filtro tiene formato inválido"], ...ERRORES_ROL),
        },
      },
      post: {
        tags: ["Usuarios"],
        summary: "Alta de operador, médico o administrador",
        description:
          "**Rol:** `admin`. Auditado como `ALTA` de `usuario`. Operador y médico " +
          "con sede; administrador sin sede; médico con una o más especialidades.",
        security: [{ bearerAuth: [] }],
        requestBody: cuerpo("DatosUsuarioAdmin"),
        responses: {
          ...exito(201, "Usuario creado", ref("UsuarioListado")),
          ...errores(
            [400, "Datos inválidos, rol no permitido o referencia inexistente"],
            [409, "El DNI o el email ya están registrados"],
            ...ERRORES_ROL,
          ),
        },
      },
    },
    "/usuarios/{id}": {
      put: {
        tags: ["Usuarios"],
        summary: "Edición de cualquier usuario",
        description:
          "**Rol:** `admin`. Auditado como `MODIFICACION` de `usuario`. El rol no " +
          "se puede cambiar; la contraseña vacía se conserva; no se puede quitar " +
          "a un médico una especialidad en la que tiene agenda (409).",
        security: [{ bearerAuth: [] }],
        parameters: [paramId("id", "Id del usuario")],
        requestBody: cuerpo("DatosUsuarioAdmin"),
        responses: {
          ...exito(200, "Usuario actualizado", ref("UsuarioListado")),
          ...errores(
            [400, "Datos inválidos o cambio de rol"],
            [404, "El usuario indicado no existe"],
            [409, "DNI/email duplicado o especialidad con agenda"],
            ...ERRORES_ROL,
          ),
        },
      },
    },
  },
};
