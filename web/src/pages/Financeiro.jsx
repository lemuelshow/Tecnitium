// Financeiro (somente administrador): contas a pagar e simulador de impostos.
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { simularImpostos, hoje, diasAte, isoDate, LIMITE_MEI } from '@tecnitium/shared';
import ListPage from '../components/ListPage.jsx';
import { Abas, Cabecalho, Pill, useAviso } from '../components/ui.jsx';
import { useLista, useSalvar } from '../lib/dados.js';
import { api } from '../lib/api.js';
import { brl, num, fd } from '../lib/format.js';

const ABAS = [['/financeiro', 'Contas a pagar'], ['/financeiro/impostos', 'Simulador de impostos']];
const CATEGORIAS = ['Aluguel', 'Energia', 'Água', 'Internet e telefone', 'Fornecedor de peças', 'Salários', 'Comissões', 'Impostos', 'Contador', 'Sistemas e assinaturas', 'Marketing', 'Manutenção da loja', 'Outros'];
const FORMAS = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto'];

export function situacaoConta(c) {
  if (c.pago) return { tom: 'ok', texto: `Paga ${fd(c.dataPagamento)}` };
  const d = diasAte(c.vencimento);
  if (d < 0) return { tom: 'bad', texto: `Vencida há ${-d} dia${d === -1 ? '' : 's'}` };
  if (d === 0) return { tom: 'warn', texto: 'Vence hoje' };
  if (d <= 7) return { tom: 'warn', texto: `Vence em ${d} dia${d === 1 ? '' : 's'}` };
  return { tom: 'info', texto: 'A vencer' };
}

export const contasPagar = {
  api: 'contasPagar', titulo: 'Financeiro', sobre: 'Contas a pagar', um: 'conta', fem: true, novo: 'Nova conta', escrita: ['ADMIN'],
  nomeDe: (r) => r.descricao,
  campos: [
    { k: 'descricao', l: 'Descrição', obrig: true, span: true },
    { k: 'categoria', l: 'Categoria', t: 'select', o: CATEGORIAS, obrig: true, padrao: 'Outros' },
    { k: 'favorecido', l: 'Favorecido / fornecedor' },
    { k: 'valor', l: 'Valor (R$)', t: 'dinheiro', obrig: true },
    { k: 'vencimento', l: 'Vencimento', t: 'data', obrig: true, padrao: hoje },
    { k: 'recorrencia', l: 'Repetição', t: 'select', o: ['Não', 'Mensal'], padrao: 'Não', dica: 'Mensal: ao pagar, cria a conta do mês seguinte' },
    { k: 'documento', l: 'Nº do documento / boleto' },
    { k: 'secao-pag', l: 'Pagamento', t: 'secao' },
    { k: 'pago', l: 'Conta paga', t: 'bool', padrao: false },
    { k: 'dataPagamento', l: 'Data do pagamento', t: 'data', mostrar: (f) => !!f.pago },
    { k: 'formaPagamento', l: 'Forma de pagamento', t: 'select', o: FORMAS, mostrar: (f) => !!f.pago },
    { k: 'obs', l: 'Observações', t: 'texto-longo', span: true },
  ],
  colunas: [
    { l: 'Vencimento', c: 'nw', r: (r) => <><strong>{fd(r.vencimento)}</strong><span className={`sub txt-${situacaoConta(r).tom === 'info' ? '' : situacaoConta(r).tom}`}>{situacaoConta(r).texto}</span></>, csv: (r) => fd(r.vencimento) },
    { l: 'Conta', r: (r) => <>{r.descricao}<span className="sub">{[r.categoria, r.favorecido].filter(Boolean).join(' · ')}{r.recorrencia === 'Mensal' ? ' · mensal' : ''}</span></>, csv: (r) => r.descricao },
    { l: 'Valor', c: 'num', r: (r) => brl(r.valor), csv: (r) => r.valor },
    { l: 'Situação', r: (r) => <Pill tom={situacaoConta(r).tom === 'info' ? 'mute' : situacaoConta(r).tom}>{r.pago ? 'Paga' : situacaoConta(r).tom === 'bad' ? 'Vencida' : 'Em aberto'}</Pill>, csv: (r) => (r.pago ? 'Paga' : 'Em aberto') },
    { l: '', r: (r, L, abrir, pode) => (!r.pago && pode ? <button className="btn sm" onClick={(e) => { e.stopPropagation(); abrir(r, { pago: true, dataPagamento: hoje(), formaPagamento: r.formaPagamento || 'Pix' }); }}>Pagar</button> : null) },
  ],
  ordenar: (a, b) => (a.pago - b.pago) || (a.pago ? b.vencimento.localeCompare(a.vencimento) : a.vencimento.localeCompare(b.vencimento)),
  texto: (r) => [r.descricao, r.categoria, r.favorecido, r.documento, r.obs].join(' '),
  filtro: {
    l: 'Todas', padrao: 'Em aberto', o: ['Em aberto', 'Vencidas', 'Próximos 7 dias', 'Pagas'],
    casa: (r, v) => ({ 'Em aberto': !r.pago, 'Vencidas': !r.pago && diasAte(r.vencimento) < 0, 'Próximos 7 dias': !r.pago && diasAte(r.vencimento) >= 0 && diasAte(r.vencimento) <= 7, 'Pagas': r.pago })[v],
  },
};

function ResumoContas() {
  const { data: contas = [] } = useLista('contasPagar');
  const mes = hoje().slice(0, 7);
  const soma = (l) => l.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const abertas = contas.filter((c) => !c.pago);
  const vencidas = abertas.filter((c) => diasAte(c.vencimento) < 0);
  const semana = abertas.filter((c) => diasAte(c.vencimento) >= 0 && diasAte(c.vencimento) <= 7);
  const doMes = abertas.filter((c) => c.vencimento.startsWith(mes));
  const pagasMes = contas.filter((c) => c.pago && (c.dataPagamento || '').startsWith(mes));
  return (
    <div className="kpi-row">
      <div className="kpi"><span className="l">Vencidas</span><span className={`v ${vencidas.length ? 'txt-bad' : ''}`}>{brl(soma(vencidas))}</span><span className="s">{vencidas.length} conta{vencidas.length === 1 ? '' : 's'}</span></div>
      <div className="kpi"><span className="l">Próximos 7 dias</span><span className="v">{brl(soma(semana))}</span><span className="s">{semana.length} conta{semana.length === 1 ? '' : 's'}</span></div>
      <div className="kpi"><span className="l">Em aberto no mês</span><span className="v">{brl(soma(doMes))}</span><span className="s">{doMes.length} conta{doMes.length === 1 ? '' : 's'}</span></div>
      <div className="kpi"><span className="l">Pago no mês</span><span className="v txt-ok">{brl(soma(pagasMes))}</span><span className="s">{pagasMes.length} pagamento{pagasMes.length === 1 ? '' : 's'}</span></div>
    </div>
  );
}

export function ContasPagar() {
  return <ListPage ent={contasPagar} abas={<Abas itens={ABAS} />} antes={() => <ResumoContas />} />;
}

// ======================================================================
const vencDas = (mes) => { const [y, m] = mes.split('-').map(Number); return isoDate(new Date(y, m, 20)); }; // DAS vence dia 20 do mes seguinte
const nomeMes = (mes) => { const [y, m] = mes.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); };

export function Simulador() {
  const avisar = useAviso();
  const salvar = useSalvar('contasPagar');
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [p, setP] = useState({ servicos: '', pecas: '', rbt12: '', issAliq: 5, icmsAliq: 0, salarioMinimo: 1518 });
  const [origem, setOrigem] = useState('');
  const { data: base, refetch, isFetching } = useQuery({ queryKey: ['impostos', mes], queryFn: () => api('/impostos/base?mes=' + mes) });
  const usarSistema = (b = base) => {
    if (!b) return;
    setP((x) => ({ ...x, servicos: b.servicos, pecas: b.pecas, rbt12: b.rbt12 }));
    setOrigem(`Valores das OS entregues em ${nomeMes(b.mes)}; receita de 12 meses somada dos 12 meses anteriores.`);
  };
  useEffect(() => { if (base && p.servicos === '' && p.pecas === '') usarSistema(base); }, [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = useMemo(() => simularImpostos(p), [p]);
  const set = (k) => (e) => { setP((x) => ({ ...x, [k]: e.target.value })); setOrigem('Valores digitados.'); };
  const simples = r.regimes.find((x) => x.nome === 'Simples Nacional');

  async function lancarDas() {
    try {
      await salvar.mutateAsync({ dados: { descricao: `DAS Simples Nacional - ${nomeMes(mes)}`, categoria: 'Impostos', favorecido: 'Receita Federal', valor: simples.total, vencimento: vencDas(mes), recorrencia: 'Não', pago: false, obs: `Estimativa do simulador: serviços ${brl(Number(p.servicos) || 0)}, peças ${brl(Number(p.pecas) || 0)}, RBT12 ${brl(Number(p.rbt12) || 0)}.` } });
      avisar(`DAS de ${brl(simples.total)} lançado em contas a pagar, vencimento ${fd(vencDas(mes))}.`);
    } catch (ex) { avisar(ex.message, true); }
  }

  const campo = (k, rotulo, extra = {}) => (
    <div className="f"><label htmlFor={'s_' + k}>{rotulo}</label><input id={'s_' + k} type="number" min="0" step={extra.passo || '0.01'} value={p[k]} onChange={set(k)} />{extra.dica ? <span className="hint">{extra.dica}</span> : null}</div>
  );
  return (
    <>
      <Cabecalho sobre="Simulador de impostos" titulo="Financeiro" />
      <Abas itens={ABAS} />
      <div className="regra">Estimativa para comparar regimes. Assistência técnica: <strong>mão de obra</strong> entra no Simples pelo Anexo III (serviços de reparo e manutenção) e <strong>peças</strong> pelo Anexo I (comércio). Confirme os valores com o seu contador antes de pagar.</div>
      <div className="grid">
        <div className="panel span-4">
          <div className="panel-h"><h2>Receitas</h2></div>
          <div className="sheet-b" style={{ padding: 0, gridTemplateColumns: '1fr 1fr' }}>
            <div className="f span2"><label htmlFor="s_mes">Mês de referência</label>
              <div className="campo-busca" style={{ flexWrap: 'wrap' }}><input id="s_mes" type="month" style={{ flex: '1 1 170px' }} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} /><button type="button" className="btn sm" style={{ whiteSpace: 'nowrap' }} disabled={isFetching} onClick={async () => usarSistema((await refetch()).data)}>Usar dados do sistema</button></div>
            </div>
            {campo('servicos', 'Receita de mão de obra (R$)')}
            {campo('pecas', 'Receita de peças (R$)')}
            <div className="span2">{campo('rbt12', 'Receita bruta dos últimos 12 meses (R$)', { dica: 'Define a faixa do Simples e se cabe no MEI (até R$ 81 mil por ano)' })}</div>
            {campo('issAliq', 'ISS no Lucro Presumido (%)', { passo: '0.5', dica: 'Entre 2% e 5%, depende do município' })}
            {campo('icmsAliq', 'ICMS efetivo sobre peças no Presumido (%)', { passo: '0.5', dica: 'Depende do estado e dos créditos; 0 para ignorar' })}
            <div className="span2">{campo('salarioMinimo', 'Salário mínimo vigente (R$)', { dica: 'Usado no DAS do MEI (5% do salário mínimo)' })}</div>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>{origem}</p>
          {base?.meses12?.length ? (
            <details style={{ marginTop: 8 }}><summary className="link">Ver receita dos 12 meses anteriores</summary>
              <table className="t" style={{ minWidth: 0, marginTop: 8 }}><tbody>{base.meses12.map((x) => <tr key={x.mes}><td>{nomeMes(x.mes)}</td><td className="num">{brl(x.total)}</td></tr>)}</tbody></table>
            </details>
          ) : null}
        </div>

        <div className="span-8" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div className="panel">
            <div className="panel-h"><h2>Resultado de {nomeMes(mes)}</h2><span className="count">Receita {brl(r.receita)}</span></div>
            <div className="regimes">
              {r.regimes.map((g) => (
                <div key={g.nome} className={`regime ${g.nome === r.melhor ? 'melhor' : ''} ${g.elegivel ? '' : 'fora'}`}>
                  <div className="regime-topo"><strong>{g.nome}</strong>{g.nome === r.melhor ? <Pill tom="ok">Menor imposto</Pill> : !g.elegivel ? <Pill tom="mute">Não se aplica</Pill> : null}</div>
                  <div className="regime-valor">{brl(g.total)}</div>
                  <span className="sub">{g.elegivel ? `${num(g.aliquotaEfetiva * 100, 2)}% da receita do mês` : g.motivo}</span>
                  <ul>{g.itens.map(([rot, v]) => <li key={rot}><span>{rot}</span><span className="mono">{brl(v)}</span></li>)}</ul>
                  {g.nome === 'Simples Nacional' && g.elegivel && g.total > 0 ? <button className="btn sm" onClick={lancarDas} disabled={salvar.isPending}>Lançar DAS em contas a pagar</button> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2 style={{ marginBottom: 8 }}>Como foi calculado</h2>
            <ul className="explica">
              <li><strong>MEI:</strong> valor fixo por mês (5% do salário mínimo de INSS + R$ 1 de ICMS se vende peças + R$ 5 de ISS se presta serviço). Limite de R$ {LIMITE_MEI.toLocaleString('pt-BR')} por ano.</li>
              <li><strong>Simples Nacional:</strong> alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12, pela faixa da receita dos 12 meses. Vence no dia 20 do mês seguinte{simples?.anexos ? ` (serviços faixa ${simples.anexos.servicos.faixa}, peças faixa ${simples.anexos.pecas.faixa})` : ''}.</li>
              <li><strong>Lucro Presumido:</strong> IRPJ 15% (+10% acima de R$ 20 mil de base no mês) e CSLL 9% sobre a presunção (32% serviços; 8% e 12% peças), PIS 0,65%, COFINS 3%, ISS e ICMS informados. IRPJ e CSLL são pagos por trimestre; aqui aparecem como valor mensal.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
