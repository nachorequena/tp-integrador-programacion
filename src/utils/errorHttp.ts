/**
 * Error de negocio con código HTTP asociado.
 *
 * Los services lanzan `ErrorHttp` para los casos previstos (dni duplicado,
 * credenciales inválidas, etc.) y el middleware `manejadorErrores` lo traduce
 * a una respuesta con el formato uniforme. Cualquier error que NO sea de esta
 * clase se considera inesperado y se responde como 500 genérico.
 */
export class ErrorHttp extends Error {
  public readonly codigo: number;

  constructor(codigo: number, mensaje: string) {
    super(mensaje);
    this.name = "ErrorHttp";
    this.codigo = codigo;
  }
}
