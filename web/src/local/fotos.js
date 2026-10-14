// Fotos das OS no IndexedDB do navegador (cabe muito mais que o localStorage).
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

export async function listarFotos(osId) {
  const todas = await operar('readonly', (s) => s.index('osId').getAll(osId));
  return (todas || []).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}

export async function salvarFoto(osId, arquivo, legenda) {
  const foto = { id: crypto.randomUUID(), osId, url: await paraDataUrl(arquivo), legenda: legenda || null, criadoEm: new Date().toISOString() };
  await operar('readwrite', (s) => s.put(foto));
  return foto;
}

export const obterFoto = (id) => operar('readonly', (s) => s.get(id));
export const apagarFoto = (id) => operar('readwrite', (s) => s.delete(id));

export async function apagarFotosDaOS(osId) {
  for (const f of await listarFotos(osId)) await apagarFoto(f.id);
}

export const apagarTodasFotos = () => operar('readwrite', (s) => s.clear());
