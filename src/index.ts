/**
 * PUNTO DE ENTRADA DE LA APLICACIÓN
 * =================================
 *
 * Acá se arma el servidor Express y se define el ORDEN en que una petición
 * atraviesa la aplicación.
 */

import express from "express";
import { entorno } from "./config/env";
import { probarConexion } from "./database/conexion";
import { manejadorErrores } from "./middlewares/manejadorErrores";
import { rutas } from "./routes";
import { responder } from "./utils/respuesta";

const app = express();

app.use(express.json());

// Todas las rutas se montan desde src/routes/index.ts
app.use(rutas);

// 404
app.use((req, res) => {
  responder(
    res,
    404,
    `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  );
});

// Manejador global de errores
app.use(manejadorErrores);

app.listen(entorno.puerto, async () => {
  console.log(
    `Servidor escuchando en http://localhost:${entorno.puerto}`,
  );

  try {
    await probarConexion();

    console.log(
      `Conexión a la base "${entorno.db.nombre}" OK`,
    );
  } catch (error) {
    console.error(
      `No se pudo conectar a la base "${entorno.db.nombre}". Revisá el .env y que el motor esté levantado.`,
    );

    console.error(error);
  }
});