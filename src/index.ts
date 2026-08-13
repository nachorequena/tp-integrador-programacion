import express from "express";
import { entorno } from "./config/env";
import { probarConexion } from "./database/conexion";
import { manejadorErrores } from "./middlewares/manejadorErrores";
import { rutas } from "./routes";
import { responder } from "./utils/respuesta";

const app = express();

app.use(express.json());

app.use(rutas);

// 404: cualquier ruta no registrada, con el mismo formato uniforme.
app.use((req, res) => {
  responder(res, 404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`);
});

// El manejador de errores va SIEMPRE último.
app.use(manejadorErrores);

app.listen(entorno.puerto, async () => {
  console.log(`Servidor escuchando en http://localhost:${entorno.puerto}`);

  // Aviso temprano si la base no responde, pero el servidor sigue arriba
  // para que GET /health pueda reportar el problema.
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
