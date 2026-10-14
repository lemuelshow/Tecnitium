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

export async function api(caminho, { method = 'GET', body } = {}) {
  const sessao = lerSessao();
  let resp;
  try {
    resp = await fetch('/api' + caminho, {
      method,
      headers: { 'Content-Type': 'application/json', ...(sessao?.token ? { Authorization: `Bearer ${sessao.token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ErroApi(0, { erro: 'Sem conexão com o servidor. Verifique se a API está rodando.' });
  }
  if (resp.status === 204) return null;
  const corpo = await resp.json().catch(() => null);
  if (resp.status === 401 && caminho !== '/auth/login') aoExpirar();
  if (!resp.ok) throw new ErroApi(resp.status, corpo);
  return corpo;
}

// Envio de arquivo (multipart) com o token da sessao.
export async function enviarArquivo(caminho, campos) {
  const sessao = lerSessao();
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) if (v != null) fd.append(k, v);
  const resp = await fetch('/api' + caminho, { method: 'POST', headers: sessao?.token ? { Authorization: `Bearer ${sessao.token}` } : {}, body: fd });
  const corpo = await resp.json().catch(() => null);
  if (!resp.ok) throw new ErroApi(resp.status, corpo);
  return corpo;
}

// Reduz a foto para no maximo 1600 px (JPEG) antes de enviar; se o navegador nao conseguir ler, envia o original.
export async function comprimirImagem(arquivo, max = 1600) {
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
