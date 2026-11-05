/**
 * ENTORNO DE LAS PRUEBAS
 * ======================
 *
 * Se carga ANTES de las pruebas (`npm test` lo pasa con `--import`). Completa
 * las variables obligatorias de `src/config/env.ts` con valores de prueba,
 * para que las pruebas corran en cualquier PC aunque no exista el `.env`.
 *
 * Las pruebas no se conectan a MySQL: donde el código consulta la base, la
 * prueba reemplaza `pool.query` por una versión falsa.
 */

process.env.DB_HOST ??= "localhost";
process.env.DB_USER ??= "prueba";
process.env.DB_NAME ??= "clinica_prueba";
// Siempre el mismo secreto en las pruebas (pisa el del .env si existe): las
// pruebas firman y verifican sus propios tokens.
process.env.JWT_SECRET = "secreto-solo-para-pruebas";
