// Recursos do back-end local: campos aceitos, permissoes e regras de negocio.
// As regras rodam dentro da mesma transacao da gravacao (ctx.tx); se algo falhar, nada e gravado.
import {
  OS_STATUS, OS_PARA_RETIRAR, TIPOS_APARELHO, FORMAS_PAGAMENTO,
  hoje, isoDateTime, somarDias, calcularComissao, pecasDaOS, numeroOS,
} from '@tecnitium/shared';
import { falha } from './erros.js';
import { apagarFotosDaOS } from './fotos.js';

const txt = (rotulo, extra = {}) => ({ tipo: 'string', rotulo, ...extra });
const int = (rotulo, extra = {}) => ({ tipo: 'int', rotulo, ...extra });
const num = (rotulo, extra = {}) => ({ tipo: 'float', rotulo, ...extra });
const bool = (rotulo) => ({ tipo: 'bool', rotulo });
const json = (rotulo) => ({ tipo: 'json', rotulo });
const req = { obrigatorio: true };

const ADMIN = ['ADMIN'];
const BALCAO = ['ADMIN', 'ATENDENTE'];
const TODOS = ['ADMIN', 'ATENDENTE', 'TECNICO'];
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });


export async function lerConfig(tx) {
  return (await tx.configuracao.findUnique({ where: { id: 1 } })) || (await tx.configuracao.create({ data: { id: 1 } }));
}

// Aplica no estoque a diferenca entre as pecas usadas antes e depois da alteracao da OS.
async function movimentarEstoque(tx, os, antes, depois) {
  const ids = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  for (const pecaId of ids) {
    const delta = (depois[pecaId] || 0) - (antes[pecaId] || 0); // quanto sai do estoque
    if (!delta) continue;
    const p = await tx.peca.findUnique({ where: { id: pecaId } });
    if (!p) throw falha('Uma peça da OS não existe mais no estoque.', 'itens');
    if (delta > 0 && p.quantidade < delta) throw falha(`Estoque insuficiente de "${p.descricao}": disponível ${fmt(p.quantidade)} ${p.unidade}, a OS precisa de mais ${fmt(delta)}.`, 'itens');
    await tx.peca.update({ where: { id: p.id }, data: { quantidade: p.quantidade - delta } });
    await tx.movEstoque.create({
      data: { pecaId, data: isoDateTime(), tipo: delta > 0 ? 'Saída OS' : 'Devolução OS', quantidade: -delta, custoUnit: p.custo, origem: `OS ${numeroOS(os.numero)}`, osId: os.id, automatico: true },
    });
  }
}

export const CATEGORIAS_CONTA = ['Aluguel', 'Energia', 'Água', 'Internet e telefone', 'Fornecedor de peças', 'Salários', 'Comissões', 'Impostos', 'Contador', 'Sistemas e assinaturas', 'Marketing', 'Manutenção da loja', 'Outros'];

// Soma meses mantendo o dia (31/01 + 1 mes = 28/02).
function somarMes(data, n = 1) {
  const [y, m, d] = data.split('-').map(Number);
  const alvo = new Date(y, m - 1 + n, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimo));
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-${String(alvo.getDate()).padStart(2, '0')}`;
}

export const recursos = {
  clientes: {
    modelo: 'cliente', ordem: { nome: 'asc' }, escrita: BALCAO,
    campos: {
      nome: txt('o nome', req), documento: txt('CPF/CNPJ'), telefone: txt('Telefone'), whatsapp: txt('WhatsApp'), email: txt('E-mail'),
      cep: txt('CEP'), endereco: txt('Endereço'), cidade: txt('Cidade'), uf: txt('UF'), obs: txt('Observações'),
    },
    validar(d) { if (!d.telefone && !d.whatsapp) throw falha('Informe ao menos um telefone ou WhatsApp para avisar o cliente.', 'telefone'); },
    // O CPF/CNPJ e o login do cliente no portal: nao pode repetir entre clientes.
    async antes(d, { tx, final }) {
      const doc = String(final.documento || '').replace(/\D/g, '');
      if (!doc) return;
      const outro = (await tx.cliente.findMany()).find((c) => c.id !== final.id && String(c.documento || '').replace(/\D/g, '') === doc);
      if (outro) throw falha(`Este CPF/CNPJ já está no cadastro de ${outro.nome}.`, 'documento');
    },
    async aoExcluir(c, { tx }) {
      if (await tx.ordemServico.count({ where: { clienteId: c.id } })) throw falha('Este cliente tem ordens de serviço e não pode ser excluído.');
      await tx.aparelho.deleteMany({ where: { clienteId: c.id } });
    },
  },

  aparelhos: {
    modelo: 'aparelho', ordem: { criadoEm: 'desc' }, escrita: BALCAO,
    campos: {
      clienteId: txt('o cliente', req), tipo: txt('o tipo', { ...req, opcoes: TIPOS_APARELHO }), marca: txt('a marca', req), modelo: txt('o modelo', req),
      serie: txt('IMEI / número de série'), cor: txt('Cor'), senha: txt('Senha de desbloqueio'), acessorios: txt('Acessórios'), obs: txt('Observações'),
    },
    async validar(d, { tx }) { if (!(await tx.cliente.findUnique({ where: { id: d.clienteId } }))) throw falha('Cliente não encontrado.', 'clienteId'); },
    async aoExcluir(a, { tx }) { if (await tx.ordemServico.count({ where: { aparelhoId: a.id } })) throw falha('Este aparelho tem ordens de serviço e não pode ser excluído.'); },
  },

  tecnicos: {
    modelo: 'tecnico', ordem: { nome: 'asc' }, escrita: ADMIN,
    campos: {
      nome: txt('o nome', req), cpf: txt('CPF'), telefone: txt('Telefone'), email: txt('E-mail'), especialidade: txt('Especialidade'),
      regime: txt('o regime', { ...req, opcoes: ['Comissão', 'Salário fixo'] }), salario: num('Salário'), percPeca: num('Comissão sobre peças'),
      percServico: num('Comissão sobre mão de obra'), ativo: bool('Ativo'), obs: txt('Observações'),
    },
    validar(d) {
      for (const k of ['percPeca', 'percServico']) if (d[k] != null && (d[k] < 0 || d[k] > 100)) throw falha('O percentual deve ficar entre 0 e 100.', k);
      if (d.regime === 'Salário fixo' && !(d.salario > 0)) throw falha('Informe o valor do salário fixo.', 'salario');
    },
    antes(d, { final }) { if (final.regime === 'Salário fixo') d.percServico = 0; else d.salario = 0; },
    async aoExcluir(t, { tx }) { if (await tx.ordemServico.count({ where: { tecnicoId: t.id } })) throw falha('Este técnico tem ordens de serviço. Marque como inativo em vez de excluir.'); },
  },

  atendentes: {
    modelo: 'atendente', ordem: { nome: 'asc' }, escrita: ADMIN,
    campos: { nome: txt('o nome', req), cpf: txt('CPF'), telefone: txt('Telefone'), email: txt('E-mail'), ativo: bool('Ativo'), obs: txt('Observações') },
    async aoExcluir(a, { tx }) { if (await tx.ordemServico.count({ where: { atendenteId: a.id } })) throw falha('Este atendente tem ordens de serviço. Marque como inativo em vez de excluir.'); },
  },

  pecas: {
    modelo: 'peca', ordem: { descricao: 'asc' }, escrita: BALCAO,
    campos: {
      codigo: txt('o código', req), descricao: txt('a descrição', req), categoria: txt('Categoria'), marca: txt('Marca'), compatibilidade: txt('Compatibilidade'),
      unidade: txt('Unidade'), quantidade: num('Estoque inicial'), minimo: num('Estoque mínimo'), custo: num('Custo'), preco: num('Preço de venda'),
      localizacao: txt('Localização'), ativo: bool('Ativo'), obs: txt('Observações'),
    },
    validar(d) { if (d.preco != null && d.custo != null && d.preco < d.custo) throw falha('O preço de venda está abaixo do custo.', 'preco'); },
    antes(d, { novo }) { if (!novo) delete d.quantidade; else if (d.quantidade != null && d.quantidade < 0) throw falha('O estoque inicial não pode ser negativo.', 'quantidade'); },
    async depois(p, { tx, novo }) {
      if (novo && p.quantidade > 0) await tx.movEstoque.create({ data: { pecaId: p.id, data: isoDateTime(), tipo: 'Entrada', quantidade: p.quantidade, custoUnit: p.custo, origem: 'Estoque inicial', automatico: true } });
    },
    async aoExcluir(p, { tx }) {
      const usada = (await tx.ordemServico.findMany({ select: { itens: true } })).some((o) => o.itens.includes(p.id));
      if (usada) throw falha('Esta peça já foi usada em ordens de serviço. Marque como inativa em vez de excluir.');
      await tx.movEstoque.deleteMany({ where: { pecaId: p.id } });
    },
  },

  movEstoque: {
    modelo: 'movEstoque', ordem: { data: 'desc' }, escrita: BALCAO,
    campos: {
      pecaId: txt('a peça', req), data: txt('a data', req), tipo: txt('o tipo', { ...req, opcoes: ['Entrada', 'Saída', 'Ajuste'] }),
      quantidade: num('a quantidade', req), custoUnit: num('Custo unitário'), origem: txt('Origem'), obs: txt('Observações'),
    },
    validar(d, { atual }) {
      if (atual?.automatico) throw falha('Movimentações geradas por OS ou cadastro não podem ser alteradas. Faça um ajuste.');
      if (!d.quantidade) throw falha('Informe uma quantidade diferente de zero.', 'quantidade');
      if (d.tipo !== 'Ajuste' && d.quantidade < 0) throw falha('Use quantidade positiva; o tipo já indica se entra ou sai.', 'quantidade');
    },
    antes(d, { final }) { d.quantidade = final.tipo === 'Saída' ? -Math.abs(final.quantidade) : final.tipo === 'Entrada' ? Math.abs(final.quantidade) : final.quantidade; },
    async depois(m, { tx, atual }) {
      const reverter = atual && atual.pecaId === m.pecaId ? atual.quantidade : 0;
      if (atual && atual.pecaId !== m.pecaId) {
        const antiga = await tx.peca.findUnique({ where: { id: atual.pecaId } });
        if (antiga) await tx.peca.update({ where: { id: antiga.id }, data: { quantidade: antiga.quantidade - atual.quantidade } });
      }
      const p = await tx.peca.findUnique({ where: { id: m.pecaId } });
      if (!p) throw falha('Peça não encontrada.', 'pecaId');
      const nova = p.quantidade - reverter + m.quantidade;
      if (nova < 0) throw falha(`O estoque de "${p.descricao}" ficaria negativo (${fmt(nova)}).`, 'quantidade');
      const dados = { quantidade: nova };
      // Entrada com custo: atualiza o custo medio da peca.
      if (m.tipo === 'Entrada' && m.custoUnit > 0 && !atual) {
        const base = Math.max(0, p.quantidade);
        dados.custo = Math.round(((base * p.custo + m.quantidade * m.custoUnit) / (base + m.quantidade)) * 100) / 100;
      }
      await tx.peca.update({ where: { id: p.id }, data: dados });
    },
    async aoExcluir(m, { tx }) {
      if (m.automatico) throw falha('Movimentações geradas por OS ou cadastro não podem ser excluídas.');
      const p = await tx.peca.findUnique({ where: { id: m.pecaId } });
      if (p) {
        if (p.quantidade - m.quantidade < 0) throw falha('Excluir esta movimentação deixaria o estoque negativo.');
        await tx.peca.update({ where: { id: p.id }, data: { quantidade: p.quantidade - m.quantidade } });
      }
    },
  },

  contasPagar: {
    modelo: 'contaPagar', ordem: { vencimento: 'asc' }, escrita: ADMIN, leitura: ADMIN,
    campos: {
      descricao: txt('a descrição', req), categoria: txt('a categoria', { ...req, opcoes: CATEGORIAS_CONTA }), favorecido: txt('Favorecido'),
      valor: num('o valor', req), vencimento: txt('o vencimento', req), recorrencia: txt('Repetição', { opcoes: ['Não', 'Mensal'] }),
      pago: bool('Pago'), dataPagamento: txt('Data do pagamento'), formaPagamento: txt('Forma de pagamento', { opcoes: FORMAS_PAGAMENTO }),
      documento: txt('Nº do documento'), obs: txt('Observações'),
    },
    validar(d) { if (!(d.valor > 0)) throw falha('O valor deve ser maior que zero.', 'valor'); },
    antes(d, { final }) {
      if (final.pago && !final.dataPagamento) d.dataPagamento = hoje();
      if (!final.pago) { d.dataPagamento = null; }
    },
    // Conta mensal paga: cria a do mes seguinte (uma vez so).
    async depois(c, { tx, atual }) {
      if (c.recorrencia !== 'Mensal' || !c.pago || atual?.pago) return;
      const proximo = somarMes(c.vencimento);
      const ja = await tx.contaPagar.findFirst({ where: { origemId: c.id } });
      if (ja) return;
      await tx.contaPagar.create({ data: { descricao: c.descricao, categoria: c.categoria, favorecido: c.favorecido, valor: c.valor, vencimento: proximo, recorrencia: 'Mensal', formaPagamento: c.formaPagamento, origemId: c.id } });
    },
  },

  ordens: {
    modelo: 'ordemServico', ordem: { numero: 'desc' }, escrita: TODOS, exclusao: ADMIN,
    campos: {
      clienteId: txt('o cliente', req), aparelhoId: txt('o aparelho', req), atendenteId: txt('Atendente'), tecnicoId: txt('Técnico'),
      entrada: txt('a data de entrada', req), prazo: txt('Prazo de entrega'), prioridade: txt('Prioridade', { opcoes: ['Normal', 'Urgente'] }),
      status: txt('Situação', { opcoes: OS_STATUS }), defeito: txt('o defeito relatado', req), estado: txt('Estado do aparelho'), acessorios: txt('Acessórios'),
      diagnostico: txt('Diagnóstico'), servicoExecutado: txt('Serviço executado'), itens: json('Peças e serviços'), desconto: num('Desconto'),
      valorPago: num('Valor pago'), formaPagamento: txt('Forma de pagamento', { opcoes: FORMAS_PAGAMENTO }), garantiaDias: int('Garantia'),
      dataPronta: txt('Data em que ficou pronta'), dataEntrega: txt('Data da retirada'), retiradoPor: txt('Retirado por'), obs: txt('Observações'),
      historico: json('Histórico'),
    },
    async validar(d, { tx }) {
      const a = await tx.aparelho.findUnique({ where: { id: d.aparelhoId } });
      if (!a) throw falha('Aparelho não encontrado.', 'aparelhoId');
      if (a.clienteId !== d.clienteId) throw falha('Este aparelho é de outro cliente.', 'aparelhoId');
      if (['Pronta', 'Entregue'].includes(d.status) && !d.tecnicoId) throw falha('Informe o técnico responsável antes de marcar como pronta ou entregue.', 'tecnicoId');
      for (const i of d.itens || []) {
        if (i.tipo === 'Peça' && !i.pecaId) throw falha('Escolha a peça do estoque em cada linha de peça.', 'itens');
        if (!(Number(i.qtd) > 0)) throw falha('A quantidade de cada item deve ser maior que zero.', 'itens');
      }
      if (d.entrada && d.prazo && d.prazo < d.entrada.slice(0, 10)) throw falha('O prazo de entrega não pode ser antes da entrada.', 'prazo');
    },
    async antes(d, { tx, novo, atual, final }) {
      const cfg = await lerConfig(tx);
      if (novo) {
        const max = await tx.ordemServico.aggregate({ _max: { numero: true } });
        d.numero = (max._max.numero || 0) + 1;
        if (!final.prazo) d.prazo = somarDias(final.entrada, cfg.prazoPadraoDias);
        if (final.garantiaDias == null) d.garantiaDias = cfg.garantiaDias;
      }
      // Guarda o custo de cada peca no momento em que entrou na OS.
      const itens = [...(final.itens || [])];
      for (const i of itens) {
        if (i.tipo === 'Peça' && i.pecaId && i.custo == null) i.custo = (await tx.peca.findUnique({ where: { id: i.pecaId } }))?.custo ?? 0;
      }
      d.itens = JSON.stringify(itens);

      // Historico de situacoes (alimenta a linha do tempo do cliente). Sempre calculado aqui, nunca vem da tela.
      const hist = novo ? [] : [...(atual.historico || [])];
      if (!hist.length) hist.push({ status: novo ? final.status : 'Aberta', data: final.entrada });
      if (!novo && atual.status !== final.status) hist.push({ status: final.status, data: isoDateTime() });
      if (novo && final.status !== 'Aberta' && hist[0].status !== final.status) hist.push({ status: final.status, data: isoDateTime() });
      d.historico = JSON.stringify(hist);
      const fin = { ...final, itens };

      if (OS_PARA_RETIRAR.includes(fin.status) && !fin.dataPronta) d.dataPronta = hoje();
      if (fin.status === 'Entregue') {
        d.dataEntrega = fin.dataEntrega || hoje();
        if (!fin.dataPronta) d.dataPronta = d.dataEntrega;
      }
      if (!['Entregue'].includes(fin.status)) d.dataEntrega = null;
      if (!['Entregue', ...OS_PARA_RETIRAR].includes(fin.status)) d.dataPronta = null;

      // Comissao: calculada e congelada na entrega (salario fixo comissiona so pecas).
      if (fin.status === 'Entregue' && fin.tecnicoId) {
        let ref = atual?.regime && atual.tecnicoId === fin.tecnicoId ? { regime: atual.regime, percPeca: atual.percPeca, percServico: atual.percServico } : null;
        if (!ref) {
          const t = await tx.tecnico.findUnique({ where: { id: fin.tecnicoId } });
          ref = { regime: t.regime, percPeca: t.percPeca, percServico: t.percServico };
        }
        const c = calcularComissao(fin, ref, cfg.baseComissaoPeca);
        Object.assign(d, ref, { comissaoPeca: c.peca, comissaoServico: c.servico });
      } else {
        Object.assign(d, { regime: null, percPeca: null, percServico: null, comissaoPeca: 0, comissaoServico: 0 });
      }
    },
    async depois(os, { tx, atual }) {
      await movimentarEstoque(tx, os, pecasDaOS(atual), pecasDaOS(os));
    },
    async aoExcluir(os, { tx }) {
      await movimentarEstoque(tx, os, pecasDaOS(os), {});
      await tx.movEstoque.updateMany({ where: { osId: os.id }, data: { osId: null } });
      await apagarFotosDaOS(os.id);
    },
  },
};
