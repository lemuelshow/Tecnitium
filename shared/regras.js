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

// ---------- portal do cliente ----------
// O cliente entra no portal com o CPF/CNPJ (so numeros) como login e como senha.
export const documentoDoCliente = (cliente) => somenteDigitos(cliente?.documento);
export const documentoValidoParaPortal = (doc) => [11, 14].includes(somenteDigitos(doc).length);

// Etapas da linha do tempo mostrada ao cliente.
export function etapasOS(os) {
  const hist = os.historico || [];
  const quando = (lista) => hist.find((h) => lista.includes(h.status))?.data || null;
  const EM_MANUT = ['Em análise', 'Aguardando aprovação', 'Aguardando peça', 'Em reparo'];
  const s = os.status;
  const ordem = { 'Aberta': 1, 'Em análise': 2, 'Aguardando aprovação': 2, 'Aguardando peça': 2, 'Em reparo': 2, 'Pronta': 3, 'Sem conserto': 3, 'Entregue': 4, 'Cancelada': 0 };
  const atual = ordem[s] ?? 1;
  const detalhe = {
    'Em análise': 'O técnico está avaliando o aparelho.',
    'Aguardando aprovação': 'Orçamento pronto: aguardando a sua aprovação.',
    'Aguardando peça': 'Aguardando a chegada da peça para o reparo.',
    'Em reparo': 'O conserto está sendo feito na bancada.',
    'Pronta': 'Serviço concluído. O aparelho já pode ser retirado.',
    'Sem conserto': 'Avaliação concluída sem reparo. O aparelho já pode ser retirado.',
  };
  const etapas = [
    { chave: 'recebido', titulo: 'Aparelho recebido', data: os.entrada, texto: 'Recebemos o aparelho e registramos o estado de entrada.' },
    { chave: 'manutencao', titulo: 'Em manutenção', data: quando(EM_MANUT), texto: atual === 2 ? detalhe[s] : 'Avaliação e reparo na bancada.' },
    { chave: 'concluido', titulo: s === 'Sem conserto' ? 'Avaliação concluída' : 'Serviço concluído', data: os.dataPronta || quando(['Pronta', 'Sem conserto']), texto: atual === 3 ? detalhe[s] : 'Pronto para retirada.' },
    { chave: 'entregue', titulo: 'Aparelho retirado', data: os.dataEntrega, texto: os.retiradoPor ? `Retirado por ${os.retiradoPor}.` : 'Entregue ao cliente.' },
  ];
  return etapas.map((e, i) => ({ ...e, feito: atual > i + 1 || (atual === 4 && i === 3), atual: s !== 'Cancelada' && atual === i + 1 && atual !== 4 }));
}

// ---------- simulador de impostos (estimativa; confirmar com o contador) ----------
// Simples Nacional (LC 123/2006, tabelas vigentes desde 2018). A faixa e definida pela receita
// bruta dos ultimos 12 meses (RBT12) da empresa toda e aplicada a cada anexo.
// Anexo III: servicos de reparo e manutencao em geral. Anexo I: venda de pecas (comercio).
export const SIMPLES_ANEXO_III = [[180000, 0.06, 0], [360000, 0.112, 9360], [720000, 0.135, 17640], [1800000, 0.16, 35640], [3600000, 0.21, 125640], [4800000, 0.33, 648000]];
export const SIMPLES_ANEXO_I = [[180000, 0.04, 0], [360000, 0.073, 5940], [720000, 0.095, 13860], [1800000, 0.107, 22500], [3600000, 0.143, 87300], [4800000, 0.19, 378000]];
export const LIMITE_SIMPLES = 4800000;
export const LIMITE_MEI = 81000;

export function aliquotaSimples(rbt12, tabela) {
  if (rbt12 > LIMITE_SIMPLES) return null;
  const i = tabela.findIndex(([lim]) => rbt12 <= lim);
  const [, nominal, deduzir] = tabela[i];
  // Empresa em inicio de atividade (sem RBT12): usa a aliquota nominal da 1a faixa.
  const efetiva = rbt12 > 0 ? (rbt12 * nominal - deduzir) / rbt12 : nominal;
  return { faixa: i + 1, nominal, deduzir, efetiva };
}

export function simularImpostos({ servicos = 0, pecas = 0, rbt12 = 0, issAliq = 5, icmsAliq = 0, salarioMinimo = 1518 }) {
  servicos = Math.max(0, Number(servicos) || 0); pecas = Math.max(0, Number(pecas) || 0); rbt12 = Math.max(0, Number(rbt12) || 0);
  const receita = servicos + pecas;
  const r2 = (n) => Math.round(n * 100) / 100;

  // MEI: valor fixo mensal (INSS 5% do salario minimo + ICMS R$ 1 + ISS R$ 5)
  const mei = {
    nome: 'MEI',
    elegivel: rbt12 <= LIMITE_MEI,
    motivo: rbt12 > LIMITE_MEI ? `Receita de 12 meses acima do limite do MEI (R$ ${LIMITE_MEI.toLocaleString('pt-BR')} por ano).` : '',
    itens: [['INSS (5% do salário mínimo)', r2(salarioMinimo * 0.05)], ...(pecas ? [['ICMS (valor fixo)', 1]] : []), ...(servicos ? [['ISS (valor fixo)', 5]] : [])],
  };

  // Simples Nacional
  const a3 = aliquotaSimples(rbt12, SIMPLES_ANEXO_III), a1 = aliquotaSimples(rbt12, SIMPLES_ANEXO_I);
  const simples = {
    nome: 'Simples Nacional',
    elegivel: !!a3,
    motivo: a3 ? '' : 'Receita de 12 meses acima do limite do Simples (R$ 4,8 milhões).',
    anexos: a3 ? { servicos: a3, pecas: a1 } : null,
    itens: a3 ? [[`Serviços · Anexo III, faixa ${a3.faixa} (${(a3.efetiva * 100).toFixed(2).replace('.', ',')}%)`, r2(servicos * a3.efetiva)], [`Peças · Anexo I, faixa ${a1.faixa} (${(a1.efetiva * 100).toFixed(2).replace('.', ',')}%)`, r2(pecas * a1.efetiva)]] : [],
  };

  // Lucro Presumido (equivalente mensal; IRPJ e CSLL sao apurados por trimestre)
  const baseIr = servicos * 0.32 + pecas * 0.08, baseCs = servicos * 0.32 + pecas * 0.12;
  const presumido = {
    nome: 'Lucro Presumido',
    elegivel: true,
    motivo: '',
    itens: [
      ['IRPJ (15% sobre a presunção de 32% serviços / 8% peças)', r2(baseIr * 0.15 + Math.max(0, baseIr - 20000) * 0.10)],
      ['CSLL (9% sobre a presunção de 32% / 12%)', r2(baseCs * 0.09)],
      ['PIS (0,65%)', r2(receita * 0.0065)],
      ['COFINS (3%)', r2(receita * 0.03)],
      [`ISS (${String(issAliq).replace('.', ',')}% sobre serviços)`, r2(servicos * (Number(issAliq) || 0) / 100)],
      ...(Number(icmsAliq) ? [[`ICMS efetivo (${String(icmsAliq).replace('.', ',')}% sobre peças)`, r2(pecas * Number(icmsAliq) / 100)]] : []),
    ],
  };

  const regimes = [mei, simples, presumido].map((r) => {
    const total = r2(r.itens.reduce((s, [, v]) => s + v, 0));
    return { ...r, total, aliquotaEfetiva: receita ? total / receita : 0 };
  });
  const elegiveis = regimes.filter((r) => r.elegivel);
  const melhor = elegiveis.length ? elegiveis.reduce((a, b) => (b.total < a.total ? b : a)).nome : null;
  return { receita, regimes, melhor };
}
