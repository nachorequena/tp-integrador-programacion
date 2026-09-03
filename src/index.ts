/**
 * PUNTO DE ENTRADA DE LA APLICACIÓN
 * =================================
 *
 * Acá se arma el servidor Express y se define el ORDEN en que una petición
 * atraviesa la aplicación. El orden importa muchísimo en Express: cada `app.use`
 * agrega un eslabón a una cadena que se recorre de arriba hacia abajo.
 *
 * Recorrido de una petición:
 *
 *   1. `express.json()`  → si viene un body JSON, lo parsea y lo deja en req.body
 *   2. `/docs`           → documentación Swagger de la API (pública)
 *   3. `auditar`         → envuelve res.json para registrar acciones sensibles
 *   4. `rutas`           → busca una ruta que coincida (ver src/routes/index.ts)
 *   5. 404               → si ninguna coincidió, la petición cae acá
 *   6. `manejadorErrores`→ solo se ejecuta si algo llamó a next(error)
 *
 * Los pasos 5 y 6 van al final justamente porque son la red de contención:
 * si estuvieran arriba, atraparían peticiones que sí tenían una ruta válida.
 */

import express from "express";
import swaggerUi from "swagger-ui-express";
import { entorno } from "./config/env";
import { probarConexion } from "./database/conexion";
import { especificacion } from "./docs/openapi";
import { auditar } from "./middlewares/auditoria";
import { manejadorErrores } from "./middlewares/manejadorErrores";
import { rutas } from "./routes";
import { responder } from "./utils/respuesta";

const app = express();

// Middleware nativo de Express: convierte el cuerpo JSON de la petición en un
// objeto JavaScript accesible desde `req.body`. Sin esto, `req.body` sería
// `undefined` en el registro y el login.
app.use(express.json());

/**
 * Documentación de la API.
 *
 * Va ANTES de `auditar` porque no hay nada que auditar en leer documentación, y
 * antes de las rutas para que `/docs` no se confunda con un recurso de la API.
 *
 * Es pública a propósito: si pidiera token, quien tiene que aprender a
 * consumir la API necesitaría antes saber consumirla para conseguir el token.
 * No expone ningún dato, solo la forma de los endpoints.
 */
app.use("/docs", swaggerUi.serve, swaggerUi.setup(especificacion));

/**
 * Auditoría automática.
 *
 * Se monta una sola vez, antes de las rutas, y envuelve `res.json` para
 * registrar cada alta, baja o modificación sobre las entidades sensibles. Es lo
 * que permite cumplir "sin código repetido en cada endpoint": ningún
 * controller ni service sabe que esto existe.
 */
app.use(auditar);

// Todas las rutas de la API, montadas desde un único router (src/routes).
app.use(rutas);

/**
 * Manejador de 404.
 *
 * Express llega hasta acá solo si NINGUNA ruta anterior coincidió con la
 * petición. Se responde con el mismo formato uniforme que el resto de la API,
 * para que un cliente nunca reciba el HTML de error por defecto de Express.
 */
app.use((req, res) => {
  responder(res, 404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`);
});

// El manejador de errores va SIEMPRE último: Express lo reconoce porque tiene
// 4 parámetros, y solo lo invoca cuando alguien llamó a next(error).
app.use(manejadorErrores);

/**
 * Levanta el servidor.
 *
 * Una vez escuchando, se prueba la conexión a la base para avisar temprano si
 * algo está mal configurado. NO se corta el proceso si la base falla: el
 * servidor queda arriba a propósito, así `GET /health` puede responder y
 * reportar el problema en lugar de que el cliente reciba un "connection
 * refused" sin explicación.
 */
app.listen(entorno.puerto, async () => {
  console.log(`Servidor escuchando en http://localhost:${entorno.puerto}`);

  try {
    await probarConexion();
    console.log(`Conexión a la base "${entorno.db.nombre}" OK`);
  } catch (error) {
    console.error(
      `No se pudo conectar a la base "${entorno.db.nombre}". Revisá el .env y que el motor esté levantado.`,
    );
    console.error(error);
  }
});
