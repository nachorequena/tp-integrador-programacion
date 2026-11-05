/**
 * SERVICE: gestión de usuarios (rol administrador)
 * ================================================
 *
 * Listado paginado con filtros, alta y edición de usuarios de cualquier rol,
 * incluidas las especialidades del médico.
 *
 * Flujo: `usuario.routes.ts` → `usuario.controller.ts` →
 * `usuario.validators.ts` → este service → tablas `usuario`, `sede`,
 * `cobertura`, `especialidad`, `medico_especialidad` y `agenda`.
 *
 * Lo usa la pantalla "Usuarios" del administrador en el frontend. Cada alta y
 * modificación queda en la auditoría (lo registra el middleware
 * `auditoria.ts`, no este archivo).
 *
 * Diferencia con `usuario.service.ts`: aquel tiene las consultas básicas que
 * usa el login y el registro (buscar por DNI, existe email…); este arma la
 * lógica de negocio del administrador apoyándose en esas consultas.
 */

import bcrypt from "bcrypt";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { PoolConnection } from "mysql2/promise";
import { pool } from "../database/conexion";
import {
  DatosUsuarioAdmin,
  FiltrosUsuarios,
  PaginaDe,
  Paginacion,
  UsuarioListado,
} from "../types";
import { ErrorHttp } from "../utils/errorHttp";
import { SALT_ROUNDS } from "./auth.service";

/**
 * SELECT base del listado. Columnas explícitas para que la `password` no salga
 * nunca; LEFT JOIN porque sede y cobertura admiten NULL (un admin no tiene
 * ninguna de las dos) y con un JOIN común esos usuarios desaparecerían.
 */
const SELECT_USUARIO = `
  SELECT u.id, u.nombre, u.apellido, u.dni, u.email, u.telefono,
         u.fecha_nacimiento, u.rol, u.id_sede, u.id_cobertura,
         s.nombre AS sede, c.nombre AS cobertura
    FROM usuario u
    LEFT JOIN sede s ON s.id = u.id_sede
    LEFT JOIN cobertura c ON c.id = u.id_cobertura`;

/**
 * Arma el WHERE del listado a partir de los filtros.
 *
 * @param filtros Filtros ya validados.
 * @returns El texto del WHERE (o vacío) y sus parámetros, en orden.
 */
function armarWhere(filtros: FiltrosUsuarios): { where: string; parametros: unknown[] } {
  const condiciones: string[] = [];
  const parametros: unknown[] = [];

  // Nombre y apellido por coincidencia parcial: el admin tipea "gon" y espera
  // ver a González. La colación de la tabla ya ignora mayúsculas.
  if (filtros.nombre) {
    condiciones.push("u.nombre LIKE ?");
    parametros.push(`%${filtros.nombre}%`);
  }
  if (filtros.apellido) {
    condiciones.push("u.apellido LIKE ?");
    parametros.push(`%${filtros.apellido}%`);
  }
  if (filtros.rol) {
    condiciones.push("u.rol = ?");
    parametros.push(filtros.rol);
  }
  if (filtros.id_sede !== undefined) {
    condiciones.push("u.id_sede = ?");
    parametros.push(filtros.id_sede);
  }

  return {
    where: condiciones.length > 0 ? ` WHERE ${condiciones.join(" AND ")}` : "",
    parametros,
  };
}

/**
 * Completa la lista de especialidades de cada médico del listado, con UNA sola
 * consulta para todos (y no una por usuario).
 *
 * @param usuarios Filas ya leídas (se modifican en el lugar).
 */
async function agregarEspecialidades(usuarios: UsuarioListado[]): Promise<void> {
  const medicos = usuarios.filter((usuario) => usuario.rol === "medico");
  if (medicos.length === 0) return;

  const [filas] = await pool.query<RowDataPacket[]>(
    "SELECT id_medico, id_especialidad FROM medico_especialidad WHERE id_medico IN (?)",
    [medicos.map((medico) => medico.id)],
  );

  for (const medico of medicos) {
    medico.especialidades = filas
      .filter((fila) => Number(fila.id_medico) === medico.id)
      .map((fila) => Number(fila.id_especialidad));
  }
}

/**
 * Lista usuarios con filtros y paginación.
 *
 * Hace dos consultas con el mismo WHERE: una cuenta el total (para que el
 * paginador del frontend sepa cuántas páginas hay) y otra trae solo la página
 * pedida con `LIMIT`/`OFFSET`.
 *
 * @param filtros Filtros ya validados.
 * @param paginacion Página y tamaño de página.
 * @returns La página de usuarios y el total que cumple los filtros.
 */
export async function listarUsuarios(
  filtros: FiltrosUsuarios,
  paginacion: Paginacion,
): Promise<PaginaDe<UsuarioListado>> {
  const { where, parametros } = armarWhere(filtros);

  const [conteo] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM usuario u${where}`,
    parametros,
  );

  const desplazamiento = (paginacion.pagina - 1) * paginacion.limite;
  const [filas] = await pool.query<RowDataPacket[]>(
    `${SELECT_USUARIO}${where} ORDER BY u.apellido, u.nombre, u.id LIMIT ? OFFSET ?`,
    [...parametros, paginacion.limite, desplazamiento],
  );

  const usuarios = filas.map((fila) => ({ ...(fila as UsuarioListado), especialidades: [] }));
  await agregarEspecialidades(usuarios);

  return {
    items: usuarios,
    total: Number(conteo[0].total),
    pagina: paginacion.pagina,
    limite: paginacion.limite,
  };
}

/**
 * Busca un usuario del listado por id (con sus especialidades).
 *
 * @param id Id del usuario.
 * @returns El usuario, o `null` si no existe.
 */
export async function buscarUsuarioListado(id: number): Promise<UsuarioListado | null> {
  const [filas] = await pool.query<RowDataPacket[]>(`${SELECT_USUARIO} WHERE u.id = ? LIMIT 1`, [id]);
  if (filas.length === 0) return null;
  const usuario: UsuarioListado = { ...(filas[0] as UsuarioListado), especialidades: [] };
  await agregarEspecialidades([usuario]);
  return usuario;
}

/**
 * Controla las referencias y duplicados comunes al alta y a la edición.
 *
 * Todo con la conexión de la transacción en curso, para que lo que se lee y
 * lo que después se escribe sea consistente.
 *
 * @param conexion Conexión de la transacción.
 * @param datos Datos ya validados.
 * @param idExcluir En la edición, el propio usuario (su DNI no es duplicado).
 * @throws `ErrorHttp` 409 si el DNI o el email ya existen.
 * @throws `ErrorHttp` 400 si la sede, la cobertura o alguna especialidad no
 *   existen.
 */
async function validarReferencias(
  conexion: PoolConnection,
  datos: DatosUsuarioAdmin,
  idExcluir = 0,
): Promise<void> {
  // La unicidad se controla en la app: el script de la cátedra no tiene
  // índices UNIQUE en dni ni email (ver CLAUDE.md, sección 7, gotcha 3).
  const [dni] = await conexion.query<RowDataPacket[]>(
    "SELECT 1 FROM usuario WHERE dni = ? AND id <> ? LIMIT 1",
    [datos.dni, idExcluir],
  );
  if (dni.length > 0) throw new ErrorHttp(409, "El DNI ya está registrado");

  const [email] = await conexion.query<RowDataPacket[]>(
    "SELECT 1 FROM usuario WHERE email = ? AND id <> ? LIMIT 1",
    [datos.email, idExcluir],
  );
  if (email.length > 0) throw new ErrorHttp(409, "El email ya está registrado");

  if (datos.id_sede !== null) {
    const [sede] = await conexion.query<RowDataPacket[]>("SELECT 1 FROM sede WHERE id = ?", [
      datos.id_sede,
    ]);
    if (sede.length === 0) throw new ErrorHttp(400, "La sede indicada no existe");
  }

  if (datos.id_cobertura !== null) {
    const [cobertura] = await conexion.query<RowDataPacket[]>(
      "SELECT 1 FROM cobertura WHERE id = ?",
      [datos.id_cobertura],
    );
    if (cobertura.length === 0) throw new ErrorHttp(400, "La cobertura indicada no existe");
  }

  if (datos.especialidades.length > 0) {
    const [existentes] = await conexion.query<RowDataPacket[]>(
      "SELECT id FROM especialidad WHERE id IN (?)",
      [datos.especialidades],
    );
    if (existentes.length !== datos.especialidades.length) {
      throw new ErrorHttp(400, "Alguna de las especialidades indicadas no existe");
    }
  }
}

/**
 * Da de alta un usuario (operador, médico o administrador).
 *
 * Usuario y especialidades se insertan en una transacción: un médico no puede
 * quedar creado "a medias", sin especialidades, porque eso lo dejaría fuera
 * de todos los listados para pedir turno.
 *
 * @param datos Datos ya validados.
 * @returns El usuario creado, con sus especialidades.
 * @throws `ErrorHttp` 409 / 400 según `validarReferencias`.
 */
export async function crearUsuario(datos: DatosUsuarioAdmin): Promise<UsuarioListado> {
  const conexion = await pool.getConnection();
  let idNuevo: number;

  try {
    await conexion.beginTransaction();
    await validarReferencias(conexion, datos);

    // El validador garantiza que en un alta la contraseña siempre viene.
    const hash = await bcrypt.hash(datos.password as string, SALT_ROUNDS);

    const [resultado] = await conexion.query<ResultSetHeader>(
      `INSERT INTO usuario
         (apellido, nombre, fecha_nacimiento, password, rol, email, telefono, dni, id_sede, id_cobertura)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.apellido,
        datos.nombre,
        datos.fecha_nacimiento,
        hash,
        datos.rol,
        datos.email,
        datos.telefono,
        datos.dni,
        datos.id_sede,
        datos.id_cobertura,
      ],
    );
    idNuevo = resultado.insertId;

    for (const idEspecialidad of datos.especialidades) {
      await conexion.query(
        "INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES (?, ?)",
        [idNuevo, idEspecialidad],
      );
    }

    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }

  const creado = await buscarUsuarioListado(idNuevo);
  if (!creado) throw new ErrorHttp(500, "No se pudo recuperar el usuario recién creado");
  return creado;
}

/**
 * Modifica un usuario existente de cualquier rol.
 *
 * Reglas:
 *   - El rol no se cambia. Pasar un paciente con turnos a médico, o un médico
 *     con agenda a operador, dejaría filas apuntando a un usuario que ya no
 *     cumple el rol que esas filas suponen. Para otro rol, se crea otro
 *     usuario.
 *   - La contraseña es opcional: si no viene, se conserva la actual.
 *   - A un médico no se le puede quitar una especialidad en la que tiene
 *     agenda cargada: sus rangos quedarían en una especialidad que ya no
 *     atiende.
 *
 * Las especialidades se actualizan por diferencia (se borran solo las
 * quitadas y se insertan solo las nuevas) y no "borrar todo y volver a
 * insertar": `medico_especialidad.id` es `tinyint` (tope 127) y reinsertar en
 * cada edición quemaría ids hasta llenar la tabla.
 *
 * @param id Id del usuario a modificar.
 * @param datos Datos nuevos, ya validados.
 * @returns El usuario actualizado, con sus especialidades.
 * @throws `ErrorHttp` 404 si no existe.
 * @throws `ErrorHttp` 400 si se intenta cambiar el rol.
 * @throws `ErrorHttp` 409 si se quita una especialidad con agenda, o por
 *   duplicados.
 */
export async function actualizarUsuario(
  id: number,
  datos: DatosUsuarioAdmin,
): Promise<UsuarioListado> {
  const existente = await buscarUsuarioListado(id);
  if (!existente) throw new ErrorHttp(404, "El usuario indicado no existe");

  if (existente.rol !== datos.rol) {
    throw new ErrorHttp(400, "No se puede cambiar el tipo de un usuario existente");
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await validarReferencias(conexion, datos, id);

    if (datos.rol === "medico") {
      const quitadas = existente.especialidades.filter(
        (actual) => !datos.especialidades.includes(actual),
      );
      if (quitadas.length > 0) {
        const [conAgenda] = await conexion.query<RowDataPacket[]>(
          `SELECT DISTINCT e.descripcion
             FROM agenda a JOIN especialidad e ON e.id = a.id_especialidad
            WHERE a.id_medico = ? AND a.id_especialidad IN (?)`,
          [id, quitadas],
        );
        if (conAgenda.length > 0) {
          const nombres = conAgenda.map((fila) => fila.descripcion).join(", ");
          throw new ErrorHttp(
            409,
            `No se puede quitar la especialidad ${nombres}: el médico tiene agenda cargada en ella`,
          );
        }
        await conexion.query(
          "DELETE FROM medico_especialidad WHERE id_medico = ? AND id_especialidad IN (?)",
          [id, quitadas],
        );
      }

      const agregadas = datos.especialidades.filter(
        (nueva) => !existente.especialidades.includes(nueva),
      );
      for (const idEspecialidad of agregadas) {
        await conexion.query(
          "INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES (?, ?)",
          [id, idEspecialidad],
        );
      }
    }

    // Sin contraseña nueva, `COALESCE(NULL, password)` deja la actual.
    const hash = datos.password ? await bcrypt.hash(datos.password, SALT_ROUNDS) : null;

    await conexion.query(
      `UPDATE usuario
          SET nombre = ?, apellido = ?, dni = ?, email = ?, telefono = ?,
              fecha_nacimiento = ?, id_sede = ?, id_cobertura = ?,
              password = COALESCE(?, password)
        WHERE id = ?`,
      [
        datos.nombre,
        datos.apellido,
        datos.dni,
        datos.email,
        datos.telefono,
        datos.fecha_nacimiento,
        datos.id_sede,
        datos.id_cobertura,
        hash,
        id,
      ],
    );

    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }

  const actualizado = await buscarUsuarioListado(id);
  if (!actualizado) throw new ErrorHttp(500, "No se pudo recuperar el usuario actualizado");
  return actualizado;
}
