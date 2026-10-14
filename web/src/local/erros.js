export class HttpError extends Error {
  constructor(status, message, campo) {
    super(message);
    this.status = status;
    this.campo = campo;
  }
}

export const falha = (message, campo) => new HttpError(422, message, campo);
