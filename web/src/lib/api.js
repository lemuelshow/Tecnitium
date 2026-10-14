import { servidor } from '../local/servidor.js';
import { HttpError } from '../local/erros.js';

const CHAVE = 'tecnitium:sessao';

export function lerSessao() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) || null; } catch { return null; }
}
export function gravarSessao(s) {
  try { s ? localStorage.setItem(CHAVE, JSON.stringify(s)) : localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
}

export class ErroApi extends Error {
  constructor(status, corpo) {
    super(corpo?.erro || 'Não foi possível concluir a operação.');
    this.status = status;
    this.campo = corpo?.campo;
  }
}

let aoExpirar = () => {};
export const definirAoExpirar = (fn) => { aoExpirar = fn; };

// Sem servidor: as chamadas vao para o "servidor local" (src/local), que guarda tudo no navegador.
export async function api(caminho, { method = 'GET', body } = {}) {
  try {
    return await servidor(method, caminho, body === undefined ? undefined : body);
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.status === 401 && caminho !== '/auth/login') aoExpirar();
      throw new ErroApi(e.status, { erro: e.message, campo: e.campo });
    }
    if (e?.code === 'P2002') throw new ErroApi(409, { erro: 'Já existe um registro com este valor.', campo: e.meta?.target?.[0] });
    if (e?.code === 'P2025') throw new ErroApi(404, { erro: 'Registro não encontrado.' });
    console.error(e);
    throw new ErroApi(500, { erro: 'Erro inesperado ao gravar no navegador. Recarregue a página e tente de novo.' });
  }
}

// Envio de foto: o arquivo vai direto para o armazenamento local (IndexedDB).
export const enviarArquivo = (caminho, campos) => api(caminho, { method: 'POST', body: campos });

// Reduz a foto para no maximo 1280 px (JPEG) antes de enviar; se o navegador nao conseguir ler, envia o original.
export async function comprimirImagem(arquivo, max = 1280) {
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * escala); c.height = Math.round(bmp.height * escala);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    return blob ? new File([blob], (arquivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : arquivo;
  } catch {
    return arquivo;
  }
}
