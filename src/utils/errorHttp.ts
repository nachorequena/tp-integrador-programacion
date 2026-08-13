/**
 * ERROR DE NEGOCIO CON CÓDIGO HTTP
 * ================================
 *
 * Resuelve un problema concreto: los services son los que detectan la mayoría
 * de los errores (un DNI repetido, una contraseña que no coincide), pero NO
 * tienen acceso al objeto `Response` para contestar. Y no deberían tenerlo: su
 * responsabilidad es la lógica de negocio, no el protocolo HTTP.
 *
 * La solución es que el service lance un `ErrorHttp` con el código que
 * corresponde. Ese error sube por la cadena de llamadas hasta el controller,
 * que lo pasa a `next(error)`, y termina en el middleware `manejadorErrores`,
 * que sí sabe responder.
 *
 * La distinción clave que habilita esta clase:
 *
 *   - Es un `ErrorHttp`  → lo previmos. Se responde su código y su mensaje.
 *   - Es cualquier otro  → es un bug o una falla inesperada. Se responde 500
 *     con un texto genérico y el detalle queda solo en el log del servidor,
 *     para no filtrarle información interna a un atacante.
 */

/**
 * Error previsto por la aplicación, con el código HTTP que le corresponde.
 *
 * Extiende la clase `Error` nativa, así que conserva `message` y el stack
 * trace, y funciona con `throw` y con `instanceof` como cualquier error normal.
 *
 * @example
 * throw new ErrorHttp(409, "El DNI ya está registrado");
 * throw new ErrorHttp(401, "DNI o contraseña incorrectos");
 */
export class ErrorHttp extends Error {
  /**
   * Código HTTP a devolver. Es `readonly` porque no tiene sentido cambiarlo
   * después de crear el error.
   */
  public readonly codigo: number;

  /**
   * @param codigo Código HTTP (400, 401, 403, 404, 409...).
   * @param mensaje Texto descriptivo. Viaja tal cual en el campo `estado` de la
   *   respuesta, así que tiene que ser entendible por quien consume la API.
   */
  constructor(codigo: number, mensaje: string) {
    // `super` llama al constructor de Error y completa la propiedad `message`.
    super(mensaje);

    // Sin esto, `name` quedaría como "Error" y los logs serían más confusos.
    this.name = "ErrorHttp";
    this.codigo = codigo;
  }
}
