export class HttpError extends Error {
  constructor(status, message, campo) {
    super(message);
    this.status = status;
    this.campo = campo;
  }
}

export const falha = (message, campo) => new HttpError(422, message, campo);

// Repassa erros de handlers async para o middleware de erro do Express.
export const rota = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function tratarErros(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ erro: err.message, campo: err.campo });
  }
  if (err?.code === 'P2002') {
    const campo = [].concat(err.meta?.target || [])[0];
    return res.status(409).json({ erro: 'Já existe um registro com este valor.', campo });
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor. Tente de novo em instantes.' });
}
