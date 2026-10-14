// Regras de negocio compartilhadas entre o servidor (Node) e a interface (React).

export const OS_STATUS = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Aguardando peça', 'Em reparo', 'Pronta', 'Sem conserto', 'Entregue', 'Cancelada'];
export const OS_EM_BANCADA = ['Aberta', 'Em análise', 'Aguardando aprovação', 'Aguardando peça', 'Em reparo'];
export const OS_PARA_RETIRAR = ['Pronta', 'Sem conserto'];
export const OS_FINALIZADA = ['Entregue', 'Cancelada'];
export const TIPOS_APARELHO = ['Celular', 'Tablet', 'Notebook', 'Computador', 'Monitor', 'TV', 'Videogame', 'Smartwatch', 'Fone / caixa de som', 'Impressora', 'Eletroportátil', 'Outro'];
export const FORMAS_PAGAMENTO = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto'];
export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

// ---------- datas ----------
const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isoDateTime = (d = new Date()) => `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const hoje = () => isoDate();
export const parseData = (s) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const somarDias = (s, n) => { const d = parseData(s); d.setDate(d.getDate() + n); return isoDate(d); };
export const diasAte = (s, base = hoje()) => Math.round((parseData(s) - parseData(base)) / 864e5);
export const mesDe = (s) => (s ? s.slice(0, 7) : '');

export const numeroOS = (n) => String(n || 0).padStart(5, '0');

// ---------- valores da OS ----------
export function totaisOS(os) {
  const itens = os.itens || [];
  const pecas = itens.filter((i) => i.tipo === 'Peça').reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valor) || 0), 0);
  const servicos = itens.filter((i) => i.tipo !== 'Peça').reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valor) || 0), 0);
  const custoPecas = itens.filter((i) => i.tipo === 'Peça').reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.custo) || 0), 0);
  const bruto = pecas + servicos;
  const desconto = Math.min(Number(os.desconto) || 0, bruto);
  const total = bruto - desconto;
  return { pecas, servicos, custoPecas, bruto, desconto, total, saldo: total - (Number(os.valorPago) || 0) };
}

// Comissao do tecnico. O desconto e rateado entre pecas e mao de obra.
// Salario fixo: recebe comissao somente sobre pecas.
export function calcularComissao(os, { regime, percPeca, percServico }, base = 'Venda') {
  const t = totaisOS(os);
  const fator = t.bruto ? t.total / t.bruto : 0;
  const basePeca = base === 'Lucro' ? Math.max(0, t.pecas * fator - t.custoPecas) : t.pecas * fator;
  const baseServico = t.servicos * fator;
  const peca = arred((basePeca * (Number(percPeca) || 0)) / 100);
  const servico = regime === 'Salário fixo' ? 0 : arred((baseServico * (Number(percServico) || 0)) / 100);
  return { basePeca: arred(basePeca), baseServico: arred(baseServico), peca, servico, total: arred(peca + servico) };
}
const arred = (n) => Math.round(n * 100) / 100;

// ---------- situacao da OS: atrasos e retiradas ----------
export function situacaoPrazo(os, cfg = {}, base = hoje()) {
  if (OS_FINALIZADA.includes(os.status)) return null;
  if (OS_PARA_RETIRAR.includes(os.status)) {
    const dias = os.dataPronta ? -diasAte(os.dataPronta, base) : 0;
    const limite = cfg.diasAbandono || 30;
    return { tipo: 'retirada', dias, tom: dias >= limite ? 'bad' : dias >= 7 ? 'warn' : 'ok', texto: dias === 0 ? 'pronta hoje' : `aguardando há ${dias} dia${dias === 1 ? '' : 's'}` };
  }
  if (!os.prazo) return { tipo: 'bancada', tom: 'mute', texto: 'sem prazo' };
  const d = diasAte(os.prazo, base);
  if (d < 0) return { tipo: 'atraso', dias: -d, tom: 'bad', texto: `atrasada ${-d} dia${d === -1 ? '' : 's'}` };
  if (d === 0) return { tipo: 'hoje', dias: 0, tom: 'warn', texto: 'vence hoje' };
  if (d === 1) return { tipo: 'amanha', dias: 1, tom: 'warn', texto: 'vence amanhã' };
  return { tipo: 'bancada', dias: d, tom: 'ok', texto: `faltam ${d} dias` };
}

// Quantidade de cada peca usada na OS (para baixa de estoque).
export function pecasDaOS(os) {
  const m = {};
  if (!os || os.status === 'Cancelada') return m;
  for (const i of os.itens || []) if (i.tipo === 'Peça' && i.pecaId) m[i.pecaId] = (m[i.pecaId] || 0) + (Number(i.qtd) || 0);
  return m;
}

export const somenteDigitos = (s) => String(s || '').replace(/\D/g, '');
export function linkWhatsapp(fone, texto) {
  let n = somenteDigitos(fone);
  if (!n) return null;
  if (n.length <= 11) n = '55' + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
