import { Fragment, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isoDate } from '@tecnitium/shared';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useApoio } from '../lib/dados.js';
import { brl, num, fd, baixarCsv } from '../lib/format.js';
import { Cabecalho, Abas, Pill, IconeBaixar, useAviso } from '../components/ui.jsx';
import ListPage from '../components/ListPage.jsx';
import * as E from '../entidades.jsx';

const ABAS_ESTOQUE = [['/estoque', 'Peças'], ['/estoque/movimentacoes', 'Movimentações']];
export const Estoque = () => <ListPage ent={E.pecas} abas={<Abas itens={ABAS_ESTOQUE} />} />;
export const Movimentacoes = () => <ListPage ent={E.movEstoque} abas={<Abas itens={ABAS_ESTOQUE} />} />;
export const Clientes = () => <ListPage ent={E.clientes} />;
export const Aparelhos = () => <ListPage ent={E.aparelhos} />;
export const Tecnicos = () => <ListPage ent={E.tecnicos} antes={() => <div className="regra">Comissão: o técnico comissionado recebe um percentual sobre as peças e outro sobre a mão de obra. O técnico com <strong>salário fixo</strong> recebe o salário mais a comissão <strong>somente sobre peças</strong>. A comissão é calculada quando a OS é entregue.</div>} />;
export const Atendentes = () => <ListPage ent={E.atendentes} />;
export const Usuarios = () => <ListPage ent={E.usuarios} />;

function periodo(p) {
  const h = new Date(); const y = h.getFullYear(), m = h.getMonth();
  if (p === 'passado') return [isoDate(new Date(y, m - 1, 1)), isoDate(new Date(y, m, 0))];
  if (p === 'ano') return [`${y}-01-01`, isoDate(h)];
  return [isoDate(new Date(y, m, 1)), isoDate(new Date(y, m + 1, 0))];
}

export function Comissoes() {
  const { usuario } = useAuth();
  const [preset, setPreset] = useState('mes');
  const [[de, ate], setFaixa] = useState(periodo('mes'));
  const [aberto, setAberto] = useState(null);
  const { data: R, error } = useQuery({ queryKey: ['comissoes', de, ate], queryFn: () => api(`/comissoes?de=${de}&ate=${ate}`) });
  const tot = (k) => (R?.tecnicos || []).reduce((s, t) => s + t[k], 0);
  const exportar = () => baixarCsv(`comissoes-${de}-a-${ate}`, ['Técnico', 'Regime', 'OS', 'OS nº', 'Retirada', 'Cliente', 'Peças', 'Mão de obra', '% peças', '% mão de obra', 'Comissão peças', 'Comissão mão de obra'],
    R.tecnicos.flatMap((t) => t.detalhes.map((d) => [t.nome, d.regime, t.os, d.numero, fd(d.dataEntrega), d.cliente, d.pecas.toFixed(2), d.servicos.toFixed(2), d.percPeca, d.percServico, d.comissaoPeca.toFixed(2), d.comissaoServico.toFixed(2)])));

  return (
    <>
      <Cabecalho sobre={`OS entregues de ${fd(de)} a ${fd(ate)}`} titulo={usuario?.perfil === 'TECNICO' ? 'Minhas comissões' : 'Comissões'}>
        <button className="btn" onClick={exportar} disabled={!R}><IconeBaixar />Exportar</button>
      </Cabecalho>
      <div className="toolbar">
        <select aria-label="Período" value={preset} onChange={(e) => { setPreset(e.target.value); if (e.target.value !== 'custom') setFaixa(periodo(e.target.value)); }}>
          <option value="mes">Este mês</option><option value="passado">Mês passado</option><option value="ano">Este ano</option><option value="custom">Personalizado</option>
        </select>
        {preset === 'custom' ? <><input type="date" aria-label="De" value={de} onChange={(e) => e.target.value && setFaixa([e.target.value, ate])} /><input type="date" aria-label="Até" value={ate} onChange={(e) => e.target.value && setFaixa([de, e.target.value])} /></> : null}
      </div>
      <div className="regra">A comissão é calculada na entrega da OS, com os percentuais do técnico naquele momento. O desconto é dividido entre peças e mão de obra. Salário fixo recebe comissão só sobre peças.{R?.meses ? ` Salário fixo considerado: ${R.meses} ${R.meses === 1 ? 'mês' : 'meses'}.` : ''}</div>
      {error ? <div className="panel">Não foi possível carregar: {error.message}</div> : !R ? <div className="empty"><strong>Carregando…</strong></div> : (
        <>
          <div className="kpi-row">
            <div className="kpi"><span className="l">Comissão sobre peças</span><span className="v">{brl(tot('comissaoPeca'))}</span></div>
            <div className="kpi"><span className="l">Comissão sobre mão de obra</span><span className="v">{brl(tot('comissaoServico'))}</span></div>
            <div className="kpi"><span className="l">Salários fixos</span><span className="v">{brl(tot('salario'))}</span></div>
            <div className="kpi"><span className="l">Total a pagar</span><span className="v" style={{ color: 'var(--accent-strong)' }}>{brl(tot('total'))}</span></div>
          </div>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Técnico</th><th>Regime</th><th className="num">OS</th><th className="num">Peças</th><th className="num">Mão de obra</th><th className="num">Com. peças</th><th className="num">Com. mão de obra</th><th className="num">Salário</th><th className="num">Total</th></tr></thead>
              <tbody>
                {R.tecnicos.map((t) => (
                  <Fragment key={t.id}>
                    <tr className="click" onClick={() => setAberto(aberto === t.id ? null : t.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setAberto(aberto === t.id ? null : t.id)}>
                      <td><strong>{t.nome}</strong><span className="sub">{aberto === t.id ? 'ocultar OS' : `ver ${t.os} OS`}</span></td>
                      <td><Pill tom={t.regime === 'Salário fixo' ? 'info' : 'ready'}>{t.regime}</Pill><span className="sub">{num(t.percPeca, 1)}% peças{t.regime === 'Comissão' ? ` · ${num(t.percServico, 1)}% mão de obra` : ''}</span></td>
                      <td className="num">{t.os}</td><td className="num">{brl(t.pecas)}</td><td className="num">{brl(t.servicos)}</td>
                      <td className="num">{brl(t.comissaoPeca)}</td><td className="num">{t.regime === 'Salário fixo' ? <span className="sub">não recebe</span> : brl(t.comissaoServico)}</td>
                      <td className="num">{t.salario ? brl(t.salario) : '—'}</td><td className="num"><strong>{brl(t.total)}</strong></td>
                    </tr>
                    {aberto === t.id ? t.detalhes.map((d) => (
                      <tr key={d.id} style={{ background: 'var(--surface-2)' }}>
                        <td colSpan={2} style={{ paddingLeft: 28 }}><span className="os-num">{d.numero}</span> · {d.cliente}<span className="sub">{d.aparelho} · retirada {fd(d.dataEntrega)}</span></td>
                        <td /><td className="num">{brl(d.pecas)}</td><td className="num">{brl(d.servicos)}</td>
                        <td className="num">{brl(d.comissaoPeca)}<span className="sub">{num(d.percPeca, 1)}%</span></td>
                        <td className="num">{brl(d.comissaoServico)}<span className="sub">{d.regime === 'Salário fixo' ? 'fixo' : `${num(d.percServico, 1)}%`}</span></td><td /><td className="num">{brl(d.comissaoPeca + d.comissaoServico)}</td>
                      </tr>
                    )) : null}
                  </Fragment>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={2}>Total</td><td className="num">{tot('os')}</td><td className="num">{brl(tot('pecas'))}</td><td className="num">{brl(tot('servicos'))}</td><td className="num">{brl(tot('comissaoPeca'))}</td><td className="num">{brl(tot('comissaoServico'))}</td><td className="num">{brl(tot('salario'))}</td><td className="num">{brl(tot('total'))}</td></tr></tfoot>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export function Configuracoes() {
  const { data } = useQuery({ queryKey: ['config'], queryFn: () => api('/config') });
  const [f, setF] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const qc = useQueryClient();
  const avisar = useAviso();
  useEffect(() => { if (data && !f) setF(data); }, [data, f]);
  if (!f) return <><Cabecalho sobre="Dados da empresa e regras" titulo="Configurações" /><div className="empty"><strong>Carregando…</strong></div></>;
  const inp = (k, extra = {}) => ({ id: 'c_' + k, value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: e.target.value }), ...extra });
  async function salvar(e) {
    e.preventDefault(); setSalvando(true); setErro('');
    try { await api('/config', { method: 'PUT', body: f }); qc.invalidateQueries(); avisar('Configurações salvas.'); } catch (ex) { setErro(ex.message); }
    setSalvando(false);
  }
  return (
    <>
      <Cabecalho sobre="Dados da empresa e regras" titulo="Configurações" />
      <form className="panel" onSubmit={salvar} style={{ maxWidth: 860 }}>
        <div className="sheet-b" style={{ padding: 0 }}>
          {erro ? <div className="form-err">{erro}</div> : null}
          <div className="sec-title">Empresa (aparece na OS impressa e nas mensagens)</div>
          <div className="f span2"><label htmlFor="c_nomeEmpresa">Nome da empresa</label><input {...inp('nomeEmpresa')} /></div>
          <div className="f"><label htmlFor="c_documento">CNPJ / CPF</label><input {...inp('documento')} /></div>
          <div className="f"><label htmlFor="c_telefone">Telefone</label><input {...inp('telefone')} /></div>
          <div className="f"><label htmlFor="c_whatsapp">WhatsApp</label><input {...inp('whatsapp')} /></div>
          <div className="f"><label htmlFor="c_endereco">Endereço</label><input {...inp('endereco')} /></div>
          <div className="sec-title">Prazos e alertas</div>
          <div className="f"><label htmlFor="c_prazoPadraoDias">Prazo de entrega padrão (dias)</label><input type="number" min="0" {...inp('prazoPadraoDias')} /></div>
          <div className="f"><label htmlFor="c_garantiaDias">Garantia padrão (dias)</label><input type="number" min="0" {...inp('garantiaDias')} /></div>
          <div className="f"><label htmlFor="c_diasAbandono">Alerta de aparelho não retirado após (dias)</label><input type="number" min="1" {...inp('diasAbandono')} /></div>
          <div className="f"><label htmlFor="c_baseComissaoPeca">Comissão sobre peças calculada pelo</label>
            <select {...inp('baseComissaoPeca')}><option value="Venda">Valor de venda da peça</option><option value="Lucro">Lucro da peça (venda menos custo)</option></select></div>
          <div className="sec-title">Termos impressos na OS</div>
          <div className="f span2"><label htmlFor="c_termos">Termos e condições</label><textarea {...inp('termos')} style={{ minHeight: 160 }} /></div>
        </div>
        <div className="actions" style={{ marginTop: 16, justifyContent: 'flex-end' }}><button className="btn primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar configurações'}</button></div>
      </form>
    </>
  );
}
