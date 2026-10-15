// Fotos e videos das OS no IndexedDB do navegador (cabe muito mais que o localStorage).
// Foto: guardada como data URL (ja reduzida). Video: guardado como arquivo (Blob), sem conversao.
const NOME = 'tecnitium-fotos';

function abrir() {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(NOME, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore('fotos', { keyPath: 'id' });
      s.createIndex('osId', 'osId');
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

async function operar(modo, fn) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const tx = db.transaction('fotos', modo);
    const r = fn(tx.objectStore('fotos'));
    tx.oncomplete = () => { db.close(); ok(r?.result); };
    tx.onerror = () => { db.close(); erro(tx.error); };
  });
}

const paraDataUrl = (arquivo) => new Promise((ok, erro) => {
  const fr = new FileReader();
  fr.onload = () => ok(fr.result);
  fr.onerror = () => erro(fr.error);
  fr.readAsDataURL(arquivo);
});

// Endereco temporario para tocar o video na tela (um por video, reaproveitado).
const urlsVideo = new Map();
function comUrl(item) {
  if (item?.tipo !== 'video' || !item.blob) return item;
  if (!urlsVideo.has(item.id)) urlsVideo.set(item.id, URL.createObjectURL(item.blob));
  const { blob, ...resto } = item;
  return { ...resto, url: urlsVideo.get(item.id) };
}

export async function listarFotos(osId) {
  const todas = await operar('readonly', (s) => s.index('osId').getAll(osId));
  return (todas || []).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).map(comUrl);
}

// momento: 'Entrada' (foto do estado em que o aparelho chegou, visivel ao cliente) ou 'Reparo'.
export async function salvarFoto(osId, arquivo, legenda, momento = 'Entrada') {
  const base = { id: crypto.randomUUID(), osId, legenda: legenda || null, momento, criadoEm: new Date().toISOString() };
  const item = arquivo.type.startsWith('video/')
    ? { ...base, tipo: 'video', blob: arquivo, mime: arquivo.type, tamanho: arquivo.size, nome: arquivo.name || 'video' }
    : { ...base, tipo: 'foto', url: await paraDataUrl(arquivo) };
  await operar('readwrite', (s) => s.put(item));
  // Pede ao navegador para nao apagar esses arquivos quando faltar espaco.
  if (item.tipo === 'video') navigator.storage?.persist?.().catch(() => {});
  return comUrl(item);
}

export const obterFoto = (id) => operar('readonly', (s) => s.get(id));

// Substitui a imagem (ex.: depois de desenhar as marcacoes do defeito).
export async function atualizarFoto(id, arquivo) {
  const f = await obterFoto(id);
  if (!f) return null;
  const nova = { ...f, url: await paraDataUrl(arquivo), editadoEm: new Date().toISOString() };
  await operar('readwrite', (s) => s.put(nova));
  return nova;
}
export const apagarFoto = (id) => {
  if (urlsVideo.has(id)) { URL.revokeObjectURL(urlsVideo.get(id)); urlsVideo.delete(id); }
  return operar('readwrite', (s) => s.delete(id));
};

export async function apagarFotosDaOS(osId) {
  for (const f of await listarFotos(osId)) await apagarFoto(f.id);
}

export const apagarTodasFotos = () => operar('readwrite', (s) => s.clear());
