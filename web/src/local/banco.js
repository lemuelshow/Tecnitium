// Banco de dados local: tabelas gravadas no localStorage do navegador.
// Imita a parte da API do Prisma usada pelas regras (findMany, create, update...),
// assim as mesmas regras do servidor rodam aqui sem mudanca.
import { HttpError } from './erros.js';

const CHAVE = 'tecnitium:banco:v1';

const PADROES = {
  usuario: { perfil: 'ATENDENTE', tecnicoId: null, atendenteId: null, ativo: true },
  configuracao: { nomeEmpresa: 'Tecnitium Assistência Técnica', documento: null, telefone: null, whatsapp: null, endereco: null, prazoPadraoDias: 3, garantiaDias: 90, diasAbandono: 30, baseComissaoPeca: 'Venda', termos: null },
  cliente: {}, aparelho: {}, atendente: { ativo: true },
  tecnico: { regime: 'Comissão', salario: 0, percPeca: 0, percServico: 0, ativo: true },
  peca: { unidade: 'un', quantidade: 0, minimo: 0, custo: 0, preco: 0, ativo: true },
  movEstoque: { automatico: false, osId: null },
  ordemServico: { prioridade: 'Normal', status: 'Aberta', itens: '[]', historico: '[]', desconto: 0, valorPago: 0, comissaoPeca: 0, comissaoServico: 0 },
};
const UNICOS = { usuario: ['email'], peca: ['codigo'], ordemServico: ['numero'] };

let estado = null;

function vazio() { return Object.fromEntries(Object.keys(PADROES).map((m) => [m, []])); }

// Sempre le de novo do localStorage: outra aba pode ter gravado.
export function carregar() {
  try { estado = { ...vazio(), ...(JSON.parse(localStorage.getItem(CHAVE)) || {}) }; } catch { estado = vazio(); }
  return estado;
}
function gravar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); }
  catch { throw new HttpError(507, 'O espaço de armazenamento do navegador acabou. Exporte um backup e apague registros antigos.'); }
}
export const bancoVazio = () => !carregar().usuario.length;
export const exportarBanco = () => JSON.parse(JSON.stringify(carregar()));
export function importarBanco(dados) {
  if (!dados || typeof dados !== 'object' || !Array.isArray(dados.usuario) || !dados.usuario.length) throw new HttpError(422, 'Arquivo de backup inválido.');
  estado = { ...vazio(), ...dados };
  gravar();
}
export function limparBanco() { estado = vazio(); gravar(); }

// ---------- filtros no estilo do Prisma ----------
function casa(obj, where = {}) {
  return Object.entries(where).every(([k, cond]) => {
    if (cond === undefined) return true;
    const v = obj[k] ?? null;
    if (cond !== null && typeof cond === 'object') {
      if ('not' in cond && v === cond.not) return false;
      if ('in' in cond && !cond.in.includes(v)) return false;
      if ('gte' in cond && !(v != null && v >= cond.gte)) return false;
      if ('lte' in cond && !(v != null && v <= cond.lte)) return false;
      return true;
    }
    return v === cond;
  });
}
const copia = (x) => (x == null ? x : structuredClone(x));
const agora = () => new Date().toISOString();
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

function checarUnicos(modelo, reg) {
  for (const campo of UNICOS[modelo] || []) {
    if (estado[modelo].some((x) => x.id !== reg.id && x[campo] === reg[campo])) {
      const e = new Error('unico'); e.code = 'P2002'; e.meta = { target: [campo] }; throw e;
    }
  }
}

function tabela(modelo) {
  const lista = () => estado[modelo];
  const naoAchou = () => { const e = new Error('nao encontrado'); e.code = 'P2025'; return e; };
  return {
    async findUnique({ where }) { return copia(lista().find((x) => casa(x, where)) || null); },
    async findFirst({ where } = {}) { return copia(lista().find((x) => casa(x, where)) || null); },
    async findMany({ where, orderBy } = {}) {
      let r = lista().filter((x) => casa(x, where));
      if (orderBy) {
        const [[campo, dir]] = Object.entries(orderBy);
        r = [...r].sort((a, b) => { const x = a[campo], y = b[campo]; const c = x == null ? 1 : y == null ? -1 : x < y ? -1 : x > y ? 1 : 0; return dir === 'desc' ? -c : c; });
      }
      return copia(r);
    },
    async count({ where } = {}) { return lista().filter((x) => casa(x, where)).length; },
    async aggregate({ _max }) {
      const out = {};
      for (const campo of Object.keys(_max || {})) { const vals = lista().map((x) => x[campo]).filter((v) => v != null); out[campo] = vals.length ? Math.max(...vals) : null; }
      return { _max: out };
    },
    async create({ data }) {
      const reg = { ...PADROES[modelo], ...data, id: data.id ?? (modelo === 'configuracao' ? 1 : novoId()), criadoEm: agora(), atualizadoEm: agora() };
      checarUnicos(modelo, reg);
      lista().push(reg);
      return copia(reg);
    },
    async update({ where, data }) {
      const i = lista().findIndex((x) => casa(x, where));
      if (i < 0) throw naoAchou();
      const reg = { ...lista()[i], ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)), atualizadoEm: agora() };
      checarUnicos(modelo, reg);
      lista()[i] = reg;
      return copia(reg);
    },
    async upsert({ where, update, create }) {
      const atual = lista().find((x) => casa(x, where));
      return atual ? this.update({ where: { id: atual.id }, data: update }) : this.create({ data: create });
    },
    async updateMany({ where, data }) {
      let n = 0;
      estado[modelo] = lista().map((x) => (casa(x, where) ? (n++, { ...x, ...data, atualizadoEm: agora() }) : x));
      return { count: n };
    },
    async delete({ where }) {
      const i = lista().findIndex((x) => casa(x, where));
      if (i < 0) throw naoAchou();
      const [r] = lista().splice(i, 1);
      return copia(r);
    },
    async deleteMany({ where } = {}) {
      const antes = lista().length;
      estado[modelo] = lista().filter((x) => !casa(x, where));
      return { count: antes - estado[modelo].length };
    },
  };
}

export const banco = new Proxy({}, { get: (_, modelo) => (modelo in PADROES ? tabela(modelo) : undefined) });

// Transacao: se a funcao falhar, o estado volta ao que era; se der certo, grava no localStorage.
export async function transacao(fn) {
  carregar();
  const antes = structuredClone(estado);
  try {
    const r = await fn(banco);
    gravar();
    return r;
  } catch (e) {
    estado = antes;
    throw e;
  }
}

// Senha guardada como SHA-256 (protecao basica: os dados ficam no proprio navegador).
export async function hashSenha(email, senha) {
  const dados = new TextEncoder().encode(`tecnitium:${String(email).trim().toLowerCase()}:${senha}`);
  const h = await crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
