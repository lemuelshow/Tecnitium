// Configuracao das telas de cadastro: campos do formulario, colunas, busca e filtro.
import { TIPOS_APARELHO, UFS, isoDateTime } from '@tecnitium/shared';
import { Pill } from './components/ui.jsx';
import { brl, num, fd, fdt } from './lib/format.js';
import { consultarCnpj, consultarCep } from './lib/consultas.js';

const BALCAO = ['ADMIN', 'ATENDENTE'];
const vazio = <span className="sub">—</span>;
const nomeCli = (L, id) => L.clientesPorId[id]?.nome || '—';
const opClientes = (L) => [...L.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.id, c.nome]);
const fone = (r) => r.whatsapp || r.telefone;

export const clientes = {
  api: 'clientes', titulo: 'Clientes', sobre: 'Cadastro de clientes', um: 'cliente', novo: 'Novo cliente', escrita: BALCAO,
  nomeDe: (r) => r.nome,
  campos: [
    { k: 'nome', l: 'Nome completo / razão social', obrig: true, span: true },
    { k: 'documento', l: 'CPF / CNPJ', busca: consultarCnpj, buscaRotulo: 'Buscar dados do CNPJ', dica: 'Com CNPJ, a lupa preenche pela Receita Federal. O CPF/CNPJ também é o login e a senha do cliente no portal.' }, { k: 'email', l: 'E-mail', t: 'email' },
    { k: 'whatsapp', l: 'WhatsApp', dica: 'Usado para avisar que o aparelho está pronto' }, { k: 'telefone', l: 'Telefone fixo' },
    { k: 'cep', l: 'CEP', busca: consultarCep, buscaRotulo: 'Buscar endereço pelo CEP', dica: 'Toque na lupa para preencher o endereço' }, { k: 'endereco', l: 'Endereço' },
    { k: 'cidade', l: 'Cidade' }, { k: 'uf', l: 'UF', t: 'select', o: UFS },
    { k: 'obs', l: 'Observações', t: 'texto-longo', span: true },
  ],
  colunas: [
    { l: 'Cliente', r: (r) => <><strong>{r.nome}</strong><span className="sub mono">{r.documento}</span></>, csv: (r) => r.nome },
    { l: 'Contato', r: (r) => <><span className="nw">{fone(r) || '—'}</span><span className="sub">{r.email}</span></>, csv: (r) => fone(r) },
    { l: 'Cidade', r: (r) => (r.cidade ? `${r.cidade}${r.uf ? '/' + r.uf : ''}` : '—'), csv: (r) => r.cidade },
    { l: 'Aparelhos', c: 'num', r: (r, L) => L.aparelhos.filter((a) => a.clienteId === r.id).length, csv: (r, L) => L.aparelhos.filter((a) => a.clienteId === r.id).length },
    { l: 'OS', c: 'num', r: (r, L) => L.ordens.filter((o) => o.clienteId === r.id).length, csv: (r, L) => L.ordens.filter((o) => o.clienteId === r.id).length },
    { l: 'Portal', r: (r) => ([11, 14].includes(String(r.documento || '').replace(/\D/g, '').length) ? <Pill tom="ok">Liberado</Pill> : <Pill tom="mute">Sem CPF/CNPJ</Pill>), csv: (r) => ([11, 14].includes(String(r.documento || '').replace(/\D/g, '').length) ? 'Liberado' : 'Sem CPF/CNPJ') },
  ],
  texto: (r) => [r.nome, r.documento, r.telefone, r.whatsapp, r.email, r.cidade].join(' '),
};

export const aparelhos = {
  api: 'aparelhos', titulo: 'Aparelhos', sobre: 'Equipamentos dos clientes', um: 'aparelho', novo: 'Novo aparelho', escrita: BALCAO,
  nomeDe: (r) => `${r.marca} ${r.modelo}`,
  campos: [
    { k: 'clienteId', l: 'Cliente', t: 'ref', o: opClientes, obrig: true, span: true },
    { k: 'tipo', l: 'Tipo', t: 'select', o: TIPOS_APARELHO, obrig: true, padrao: 'Celular' },
    { k: 'marca', l: 'Marca', obrig: true }, { k: 'modelo', l: 'Modelo', obrig: true },
    { k: 'serie', l: 'IMEI / número de série' }, { k: 'cor', l: 'Cor' },
    { k: 'senha', l: 'Senha / padrão de desbloqueio', dica: 'Visível só para a equipe' },
    { k: 'acessorios', l: 'Acessórios que costuma acompanhar', span: true },
    { k: 'obs', l: 'Observações', t: 'texto-longo', span: true },
  ],
  colunas: [
    { l: 'Aparelho', r: (r) => <><strong>{r.marca} {r.modelo}</strong><span className="sub">{r.tipo}{r.cor ? ' · ' + r.cor : ''}</span></>, csv: (r) => `${r.tipo} ${r.marca} ${r.modelo}` },
    { l: 'IMEI / série', r: (r) => <span className="mono">{r.serie || '—'}</span>, csv: (r) => r.serie },
    { l: 'Cliente', r: (r, L) => nomeCli(L, r.clienteId), csv: (r, L) => nomeCli(L, r.clienteId) },
    { l: 'OS', c: 'num', r: (r, L) => L.ordens.filter((o) => o.aparelhoId === r.id).length, csv: (r, L) => L.ordens.filter((o) => o.aparelhoId === r.id).length },
  ],
  texto: (r, L) => [r.tipo, r.marca, r.modelo, r.serie, r.cor, nomeCli(L, r.clienteId)].join(' '),
  filtro: { k: 'tipo', l: 'Todos os tipos', o: TIPOS_APARELHO },
};

export const tecnicos = {
  api: 'tecnicos', titulo: 'Técnicos', sobre: 'Equipe de bancada e comissões', um: 'técnico', novo: 'Novo técnico', escrita: ['ADMIN'],
  nomeDe: (r) => r.nome,
  campos: [
    { k: 'nome', l: 'Nome', obrig: true, span: true },
    { k: 'cpf', l: 'CPF' }, { k: 'telefone', l: 'Telefone' }, { k: 'email', l: 'E-mail', t: 'email' }, { k: 'especialidade', l: 'Especialidade' },
    { k: 'secao-com', l: 'Remuneração', t: 'secao' },
    { k: 'regime', l: 'Regime', t: 'select', o: ['Comissão', 'Salário fixo'], obrig: true, padrao: 'Comissão', span: true,
      dica: 'Salário fixo recebe comissão somente sobre peças' },
    { k: 'salario', l: 'Salário fixo mensal (R$)', t: 'dinheiro', mostrar: (f) => f.regime === 'Salário fixo', obrig: true },
    { k: 'percPeca', l: 'Comissão sobre peças (%)', t: 'numero', passo: '0.1', padrao: 0 },
    { k: 'percServico', l: 'Comissão sobre mão de obra (%)', t: 'numero', passo: '0.1', padrao: 0, mostrar: (f) => f.regime !== 'Salário fixo' },
    { k: 'ativo', l: 'Técnico ativo', t: 'bool', padrao: true },
    { k: 'obs', l: 'Observações', t: 'texto-longo', span: true },
  ],
  colunas: [
    { l: 'Técnico', r: (r) => <><strong>{r.nome}</strong><span className="sub">{r.especialidade}</span></>, csv: (r) => r.nome },
    { l: 'Contato', r: (r) => <span className="nw">{r.telefone || '—'}</span>, csv: (r) => r.telefone },
    { l: 'Regime', r: (r) => <Pill tom={r.regime === 'Salário fixo' ? 'info' : 'ready'}>{r.regime}</Pill>, csv: (r) => r.regime },
    { l: 'Salário', c: 'num', r: (r) => (r.regime === 'Salário fixo' ? brl(r.salario) : '—'), csv: (r) => r.salario },
    { l: 'Peças', c: 'num', r: (r) => `${num(r.percPeca, 1)}%`, csv: (r) => r.percPeca },
    { l: 'Mão de obra', c: 'num', r: (r) => (r.regime === 'Salário fixo' ? <span className="sub">não recebe</span> : `${num(r.percServico, 1)}%`), csv: (r) => r.percServico },
    { l: 'Em bancada', c: 'num', r: (r, L) => L.ordens.filter((o) => o.tecnicoId === r.id && !['Entregue', 'Cancelada', 'Pronta', 'Sem conserto'].includes(o.status)).length, csv: () => '' },
    { l: 'Situação', r: (r) => <Pill tom={r.ativo ? 'ok' : 'mute'}>{r.ativo ? 'Ativo' : 'Inativo'}</Pill>, csv: (r) => (r.ativo ? 'Ativo' : 'Inativo') },
  ],
  texto: (r) => [r.nome, r.especialidade, r.regime, r.telefone].join(' '),
  filtro: { k: 'regime', l: 'Todos os regimes', o: ['Comissão', 'Salário fixo'] },
};

export const atendentes = {
  api: 'atendentes', titulo: 'Atendentes', sobre: 'Equipe de balcão', um: 'atendente', novo: 'Novo atendente', escrita: ['ADMIN'],
  nomeDe: (r) => r.nome,
  campos: [
    { k: 'nome', l: 'Nome', obrig: true, span: true },
    { k: 'cpf', l: 'CPF' }, { k: 'telefone', l: 'Telefone' }, { k: 'email', l: 'E-mail', t: 'email' },
    { k: 'ativo', l: 'Atendente ativo', t: 'bool', padrao: true },
    { k: 'obs', l: 'Observações', t: 'texto-longo', span: true },
  ],
  colunas: [
    { l: 'Atendente', r: (r) => <strong>{r.nome}</strong>, csv: (r) => r.nome },
    { l: 'Contato', r: (r) => <>{r.telefone || '—'}<span className="sub">{r.email}</span></>, csv: (r) => r.telefone },
    { l: 'OS abertas por ele', c: 'num', r: (r, L) => L.ordens.filter((o) => o.atendenteId === r.id).length, csv: (r, L) => L.ordens.filter((o) => o.atendenteId === r.id).length },
    { l: 'Situação', r: (r) => <Pill tom={r.ativo ? 'ok' : 'mute'}>{r.ativo ? 'Ativo' : 'Inativo'}</Pill>, csv: (r) => (r.ativo ? 'Ativo' : 'Inativo') },
  ],
  texto: (r) => [r.nome, r.telefone, r.email].join(' '),
};

const baixo = (p) => p.quantidade <= p.minimo;
export const pecas = {
  api: 'pecas', titulo: 'Estoque', sobre: 'Peças e insumos', um: 'peça', fem: true, novo: 'Nova peça', escrita: BALCAO,
  nomeDe: (r) => r.descricao,
  campos: [
    { k: 'codigo', l: 'Código', obrig: true }, { k: 'categoria', l: 'Categoria', dica: 'Ex.: Telas, Baterias, Conectores' },
    { k: 'descricao', l: 'Descrição', obrig: true, span: true },
    { k: 'marca', l: 'Marca' }, { k: 'compatibilidade', l: 'Compatível com' },
    { k: 'unidade', l: 'Unidade', t: 'select', o: ['un', 'par', 'kit', 'm', 'g', 'ml'], padrao: 'un' }, { k: 'localizacao', l: 'Localização', dica: 'Gaveta, prateleira…' },
    { k: 'quantidade', l: 'Estoque inicial', t: 'numero', passo: '0.01', padrao: 0, mostrar: (f) => !f.id, dica: 'Depois, use as movimentações de estoque' },
    { k: 'minimo', l: 'Estoque mínimo', t: 'numero', passo: '0.01', padrao: 0 },
    { k: 'custo', l: 'Custo (R$)', t: 'dinheiro', padrao: 0 }, { k: 'preco', l: 'Preço de venda (R$)', t: 'dinheiro', padrao: 0 },
    { k: 'ativo', l: 'Peça ativa', t: 'bool', padrao: true },
    { k: 'obs', l: 'Observações', t: 'texto-longo', span: true },
  ],
  colunas: [
    { l: 'Código', r: (r) => <strong className="mono">{r.codigo}</strong>, csv: (r) => r.codigo },
    { l: 'Peça', r: (r) => <>{r.descricao}<span className="sub">{[r.categoria, r.compatibilidade].filter(Boolean).join(' · ')}</span></>, csv: (r) => r.descricao },
    { l: 'Local', r: (r) => r.localizacao || '—', csv: (r) => r.localizacao },
    { l: 'Estoque', c: 'num', r: (r) => <span className={baixo(r) ? 'txt-bad' : ''}>{num(r.quantidade, r.quantidade % 1 ? 2 : 0)} {r.unidade}</span>, csv: (r) => r.quantidade },
    { l: 'Mínimo', c: 'num', r: (r) => num(r.minimo, r.minimo % 1 ? 2 : 0), csv: (r) => r.minimo },
    { l: 'Custo', c: 'num', r: (r) => brl(r.custo), csv: (r) => r.custo },
    { l: 'Venda', c: 'num', r: (r) => brl(r.preco), csv: (r) => r.preco },
    { l: 'Margem', c: 'num', r: (r) => (r.preco ? `${num(((r.preco - r.custo) / r.preco) * 100)}%` : '—'), csv: (r) => (r.preco ? (((r.preco - r.custo) / r.preco) * 100).toFixed(1) : '') },
    { l: 'Situação', r: (r) => (!r.ativo ? <Pill tom="mute">Inativa</Pill> : r.quantidade <= 0 ? <Pill tom="bad">Sem estoque</Pill> : baixo(r) ? <Pill tom="warn">Repor</Pill> : <Pill tom="ok">OK</Pill>), csv: (r) => (baixo(r) ? 'Repor' : 'OK') },
  ],
  ordenar: (a, b) => (baixo(b) - baixo(a)) || a.descricao.localeCompare(b.descricao),
  texto: (r) => [r.codigo, r.descricao, r.categoria, r.marca, r.compatibilidade, r.localizacao].join(' '),
  filtro: { l: 'Todas as peças', o: ['Repor', 'Sem estoque', 'OK', 'Inativas'], casa: (r, v) => ({ Repor: r.ativo && baixo(r), 'Sem estoque': r.ativo && r.quantidade <= 0, OK: r.ativo && !baixo(r), Inativas: !r.ativo })[v] },
};

export const movEstoque = {
  api: 'movEstoque', titulo: 'Estoque', sobre: 'Entradas, saídas e ajustes', um: 'movimentação', fem: true, novo: 'Nova movimentação', escrita: BALCAO,
  nomeDe: (r, L) => `${r.tipo} de ${L.pecasPorId[r.pecaId]?.descricao || 'peça'}`,
  campos: [
    { k: 'tipo', l: 'Tipo', t: 'select', o: ['Entrada', 'Saída', 'Ajuste'], obrig: true, padrao: 'Entrada', dica: 'Ajuste aceita valor negativo (ex.: -2)' },
    { k: 'data', l: 'Data e hora', t: 'dataHora', obrig: true, padrao: () => isoDateTime() },
    { k: 'pecaId', l: 'Peça', t: 'ref', obrig: true, span: true, o: (L) => [...L.pecas].filter((p) => p.ativo).sort((a, b) => a.descricao.localeCompare(b.descricao)).map((p) => [p.id, `${p.codigo} · ${p.descricao} (saldo ${num(p.quantidade)})`]),
      aoMudar: (id, f, L) => ({ ...f, custoUnit: f.custoUnit ?? L.pecasPorId[id]?.custo }) },
    { k: 'quantidade', l: 'Quantidade', t: 'numero', passo: '0.01', obrig: true },
    { k: 'custoUnit', l: 'Custo unitário (R$)', t: 'dinheiro', mostrar: (f) => f.tipo === 'Entrada', dica: 'Atualiza o custo médio da peça' },
    { k: 'origem', l: 'Fornecedor / nota / motivo', span: true },
    { k: 'obs', l: 'Observações', t: 'texto-longo', span: true },
  ],
  colunas: [
    { l: 'Data', r: (r) => <span className="nw">{fdt(r.data)}</span>, csv: (r) => fdt(r.data) },
    { l: 'Peça', r: (r, L) => <><strong className="mono">{L.pecasPorId[r.pecaId]?.codigo}</strong><span className="sub">{L.pecasPorId[r.pecaId]?.descricao}</span></>, csv: (r, L) => L.pecasPorId[r.pecaId]?.descricao },
    { l: 'Tipo', r: (r) => <Pill tom={r.quantidade > 0 ? 'ok' : 'warn'}>{r.tipo}</Pill>, csv: (r) => r.tipo },
    { l: 'Quantidade', c: 'num', r: (r) => <span className={r.quantidade > 0 ? 'txt-ok' : 'txt-warn'}>{r.quantidade > 0 ? '+' : ''}{num(r.quantidade, r.quantidade % 1 ? 2 : 0)}</span>, csv: (r) => r.quantidade },
    { l: 'Custo unit.', c: 'num', r: (r) => (r.custoUnit != null ? brl(r.custoUnit) : '—'), csv: (r) => r.custoUnit ?? '' },
    { l: 'Origem', r: (r) => <>{r.origem || '—'}{r.automatico ? <span className="sub">automático</span> : null}</>, csv: (r) => r.origem },
  ],
  texto: (r, L) => [r.tipo, r.origem, r.obs, L.pecasPorId[r.pecaId]?.descricao, L.pecasPorId[r.pecaId]?.codigo].join(' '),
  filtro: { k: 'tipo', l: 'Todos os tipos', o: ['Entrada', 'Saída', 'Ajuste', 'Saída OS', 'Devolução OS'] },
};

export const usuarios = {
  api: 'usuarios', titulo: 'Usuários', sobre: 'Acesso ao sistema', um: 'usuário', novo: 'Novo usuário', escrita: ['ADMIN'],
  nomeDe: (r) => r.nome,
  campos: [
    { k: 'nome', l: 'Nome', obrig: true, span: true },
    { k: 'email', l: 'E-mail', t: 'email', obrig: true },
    { k: 'perfil', l: 'Perfil', t: 'select', o: ['ADMIN', 'ATENDENTE', 'TECNICO'], obrig: true, padrao: 'ATENDENTE' },
    { k: 'tecnicoId', l: 'Cadastro do técnico', t: 'ref', obrig: true, mostrar: (f) => f.perfil === 'TECNICO', o: (L) => L.tecnicos.map((t) => [t.id, t.nome]), dica: 'O técnico vê só as próprias comissões' },
    { k: 'atendenteId', l: 'Cadastro do atendente', t: 'ref', mostrar: (f) => f.perfil === 'ATENDENTE', o: (L) => L.atendentes.map((a) => [a.id, a.nome]), dica: 'Preenche o atendente nas OS abertas por este login' },
    { k: 'senha', l: 'Senha', t: 'senha', dica: 'Mínimo de 6 caracteres. Na edição, deixe vazio para manter.' },
    { k: 'ativo', l: 'Usuário ativo', t: 'bool', padrao: true },
  ],
  colunas: [
    { l: 'Nome', r: (r) => <strong>{r.nome}</strong>, csv: (r) => r.nome },
    { l: 'E-mail', r: (r) => r.email, csv: (r) => r.email },
    { l: 'Perfil', r: (r, L) => <>{({ ADMIN: 'Administrador', ATENDENTE: 'Atendente', TECNICO: 'Técnico' })[r.perfil]}<span className="sub">{L.tecnicosPorId[r.tecnicoId]?.nome || L.atendentesPorId[r.atendenteId]?.nome}</span></>, csv: (r) => r.perfil },
    { l: 'Situação', r: (r) => <Pill tom={r.ativo ? 'ok' : 'mute'}>{r.ativo ? 'Ativo' : 'Inativo'}</Pill>, csv: (r) => (r.ativo ? 'Ativo' : 'Inativo') },
  ],
  texto: (r) => [r.nome, r.email, r.perfil].join(' '),
};

export { vazio, fd };
