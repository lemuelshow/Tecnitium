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
            <table className="t cards">
              <thead><tr><th>Técnico</th><th>Regime</th><th className="num">OS</th><th className="num">Peças</th><th className="num">Mão de obra</th><th className="num">Com. peças</th><th className="num">Com. mão de obra</th><th className="num">Salário</th><th className="num">Total</th></tr></thead>
              <tbody>
                {R.tecnicos.map((t) => (
                  <Fragment key={t.id}>
                    <tr className="click" onClick={() => setAberto(aberto === t.id ? null : t.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setAberto(aberto === t.id ? null : t.id)}>
                      <td><span className="cv"><strong>{t.nome}</strong><span className="sub">{aberto === t.id ? 'ocultar OS' : `ver ${t.os} OS`}</span></span></td>
                      <td data-label="Regime"><span className="cv"><Pill tom={t.regime === 'Salário fixo' ? 'info' : 'ready'}>{t.regime}</Pill><span className="sub">{num(t.percPeca, 1)}% peças{t.regime === 'Comissão' ? ` · ${num(t.percServico, 1)}% mão de obra` : ''}</span></span></td>
                      <td className="num" data-label="OS">{t.os}</td><td className="num" data-label="Peças">{brl(t.pecas)}</td><td className="num" data-label="Mão de obra">{brl(t.servicos)}</td>
                      <td className="num" data-label="Com. peças">{brl(t.comissaoPeca)}</td><td className="num" data-label="Com. mão de obra">{t.regime === 'Salário fixo' ? <span className="sub">não recebe</span> : brl(t.comissaoServico)}</td>
                      <td className="num" data-label="Salário">{t.salario ? brl(t.salario) : '—'}</td><td className="num" data-label="Total a pagar"><strong>{brl(t.total)}</strong></td>
                    </tr>
                    {aberto === t.id ? t.detalhes.map((d) => (
                      <tr key={d.id} style={{ background: 'var(--surface-2)' }}>
                        <td colSpan={2} style={{ paddingLeft: 28 }}><span className="cv"><span className="os-num">{d.numero}</span> · {d.cliente}<span className="sub">{d.aparelho} · retirada {fd(d.dataEntrega)}</span></span></td>
                        <td /><td className="num" data-label="Peças">{brl(d.pecas)}</td><td className="num" data-label="Mão de obra">{brl(d.servicos)}</td>
                        <td className="num" data-label="Com. peças"><span className="cv">{brl(d.comissaoPeca)}<span className="sub">{num(d.percPeca, 1)}%</span></span></td>
                        <td className="num" data-label="Com. mão de obra"><span className="cv">{brl(d.comissaoServico)}<span className="sub">{d.regime === 'Salário fixo' ? 'fixo' : `${num(d.percServico, 1)}%`}</span></span></td><td /><td className="num" data-label="Comissão">{brl(d.comissaoPeca + d.comissaoServico)}</td>
                      </tr>
                    )) : null}
                  </Fragment>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={2}>Total</td><td className="num" data-label="OS">{tot('os')}</td><td className="num" data-label="Peças">{brl(tot('pecas'))}</td><td className="num" data-label="Mão de obra">{brl(tot('servicos'))}</td><td className="num" data-label="Com. peças">{brl(tot('comissaoPeca'))}</td><td className="num" data-label="Com. mão de obra">{brl(tot('comissaoServico'))}</td><td className="num" data-label="Salário">{brl(tot('salario'))}</td><td className="num" data-label="Total a pagar">{brl(tot('total'))}</td></tr></tfoot>
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
    try {
      const semSmtp = Object.fromEntries(Object.entries(f).filter(([k]) => !k.startsWith('smtp')));
      const salvo = await api('/config', { method: 'PUT', body: semSmtp });
      setF(salvo); qc.invalidateQueries(); avisar('Configurações salvas.');
    } catch (ex) { setErro(ex.message); }
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
      <EmailSmtp />
      <Dados />
    </>
  );
}

// Backup e restauracao: sem servidor, os dados vivem neste navegador.
function Dados() {
  const qc = useQueryClient();
  const avisar = useAviso();
  const [confirmar, setConfirmar] = useState(null); // 'exemplos' | 'limpar'
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const recarregar = () => { qc.clear(); window.location.assign('/'); };

  async function exportar() {
    const dados = await api('/dados/backup');
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `tecnitium-backup-${isoDate()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    avisar('Backup baixado.');
  }
  async function importar(arquivo) {
    setErro('');
    try {
      const dados = JSON.parse(await arquivo.text());
      await api('/dados/restaurar', { method: 'POST', body: { dados } });
      avisar('Backup restaurado.');
      recarregar();
    } catch (ex) { setErro(ex instanceof SyntaxError ? 'O arquivo não é um backup válido do Tecnitium.' : ex.message); }
  }
  async function executar() {
    setOcupado(true);
    try { await api('/dados/' + confirmar, { method: 'POST' }); recarregar(); }
    catch (ex) { setErro(ex.message); setOcupado(false); setConfirmar(null); }
  }

  return (
    <div className="panel" style={{ maxWidth: 860, marginTop: 16 }}>
      <div className="panel-h"><h2>Dados deste navegador</h2></div>
      <p className="sub" style={{ marginBottom: 12 }}>Esta versão não tem servidor: cadastros e OS ficam no armazenamento local deste navegador, e as fotos no banco local dele. Outro computador ou outro navegador começa com os dados de exemplo. Limpar os dados do navegador apaga tudo, então baixe um backup com frequência. O backup não inclui as fotos.</p>
      {erro ? <div className="form-err" style={{ marginBottom: 12 }}>{erro}</div> : null}
      {confirmar ? (
        <div className="regra" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'var(--warn-bg)' }}>
          <span style={{ flex: '1 1 300px' }}>{confirmar === 'exemplos' ? 'Apagar tudo e carregar de novo os dados de exemplo?' : 'Apagar todos os cadastros, OS, estoque e fotos? Ficam só a configuração e os usuários iniciais.'} Esta ação não pode ser desfeita.</span>
          <button className="btn" onClick={() => setConfirmar(null)} disabled={ocupado}>Cancelar</button>
          <button className="btn danger" onClick={executar} disabled={ocupado}>{ocupado ? 'Apagando…' : 'Apagar'}</button>
        </div>
      ) : null}
      <div className="actions">
        <button className="btn" onClick={exportar}><IconeBaixar />Baixar backup</button>
        <label className="btn" style={{ cursor: 'pointer' }}>Restaurar backup<input type="file" accept="application/json,.json" hidden onChange={(e) => { if (e.target.files[0]) importar(e.target.files[0]); e.target.value = ''; }} /></label>
        <button className="btn" onClick={() => setConfirmar('exemplos')}>Recarregar dados de exemplo</button>
        <button className="btn danger" onClick={() => setConfirmar('limpar')}>Começar do zero</button>
      </div>
    </div>
  );
}

// E-mail (SMTP): usado no "Esqueci a senha" e no e-mail de teste. Enviado pela funcao /api/email.
function EmailSmtp() {
  const { data } = useQuery({ queryKey: ['config'], queryFn: () => api('/config') });
  const qc = useQueryClient();
  const avisar = useAviso();
  const [f, setF] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [para, setPara] = useState('');
  useEffect(() => { if (data && !f) setF({ smtpHost: data.smtpHost || 'smtp.gmail.com', smtpPorta: data.smtpPorta || 465, smtpUsuario: data.smtpUsuario || '', smtpRemetente: data.smtpRemetente || '', smtpSenha: '', definida: !!data.smtpSenhaDefinida }); }, [data, f]);
  if (!f || !data) return null;
  const inp = (k, extra = {}) => ({ id: 'm_' + k, value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: e.target.value }), ...extra });
  async function salvar(e) {
    e.preventDefault(); setOcupado('salvar'); setErro('');
    try {
      const salvo = await api('/config', { method: 'PUT', body: { ...data, ...f, smtpSenha: f.smtpSenha } });
      setF({ ...f, smtpSenha: '', definida: !!salvo.smtpSenhaDefinida }); qc.invalidateQueries({ queryKey: ['config'] }); avisar('Configuração de e-mail salva.');
    } catch (ex) { setErro(ex.message); }
    setOcupado('');
  }
  async function testar() {
    setOcupado('teste'); setErro('');
    try { const r = await api('/config/teste-email', { method: 'POST', body: { para: para || f.smtpUsuario } }); avisar(`E-mail de teste enviado para ${r.para}. Confira a caixa de entrada (e o spam).`); }
    catch (ex) { setErro(ex.message); }
    setOcupado('');
  }
  async function removerSenha() {
    setOcupado('remover');
    try { await api('/config', { method: 'PUT', body: { ...data, ...f, smtpSenha: '', smtpRemoverSenha: true } }); setF({ ...f, smtpSenha: '', definida: false }); qc.invalidateQueries({ queryKey: ['config'] }); avisar('Senha de app removida.'); }
    catch (ex) { setErro(ex.message); }
    setOcupado('');
  }
  return (
    <form className="panel" onSubmit={salvar} style={{ maxWidth: 860, marginTop: 16 }}>
      <div className="panel-h"><h2>E-mail (SMTP)</h2>{f.definida && f.smtpUsuario ? <Pill tom="ok">Configurado</Pill> : <Pill tom="mute">Não configurado</Pill>}</div>
      <p className="sub" style={{ marginBottom: 12 }}>Usado para enviar o código do <strong>“Esqueci a senha”</strong> da equipe. Com Gmail, use uma <strong>senha de app</strong>: Conta Google → Segurança → Verificação em duas etapas (ativar) → Senhas de app → gere uma senha de 16 letras. A senha normal da conta não funciona.</p>
      {erro ? <div className="form-err" style={{ marginBottom: 12 }}>{erro}</div> : null}
      <div className="sheet-b" style={{ padding: 0 }}>
        <div className="f"><label htmlFor="m_smtpHost">Servidor SMTP</label><input {...inp('smtpHost')} /></div>
        <div className="f"><label htmlFor="m_smtpPorta">Porta</label><select {...inp('smtpPorta')}><option value={465}>465 (SSL, recomendado no Gmail)</option><option value={587}>587 (STARTTLS)</option></select></div>
        <div className="f"><label htmlFor="m_smtpUsuario">E-mail do Gmail</label><input type="email" placeholder="suaempresa@gmail.com" autoComplete="off" {...inp('smtpUsuario')} /></div>
        <div className="f"><label htmlFor="m_smtpRemetente">Nome do remetente</label><input placeholder={data.nomeEmpresa} {...inp('smtpRemetente')} /></div>
        <div className="f span2"><label htmlFor="m_smtpSenha">Senha de app</label>
          <input type="password" autoComplete="new-password" placeholder={f.definida ? '•••• •••• •••• •••• (guardada; deixe vazio para manter)' : 'abcd efgh ijkl mnop'} {...inp('smtpSenha')} />
          <span className="hint">Fica guardada só neste navegador e não sai no backup. {f.definida ? <button type="button" className="link" onClick={removerSenha} disabled={!!ocupado}>Remover senha guardada</button> : null}</span>
        </div>
      </div>
      <div className="actions" style={{ marginTop: 16, justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="f" style={{ flex: '1 1 260px', maxWidth: 420 }}><label htmlFor="m_para">Enviar teste para</label>
          <div className="campo-busca"><input id="m_para" type="email" placeholder={f.smtpUsuario || 'email@exemplo.com'} value={para} onChange={(e) => setPara(e.target.value)} /><button type="button" className="btn sm" style={{ whiteSpace: 'nowrap' }} onClick={testar} disabled={!!ocupado || !f.definida}>{ocupado === 'teste' ? 'Enviando…' : 'Enviar teste'}</button></div>
          {!f.definida ? <span className="hint">Salve a senha de app antes de testar.</span> : null}
        </div>
        <button className="btn primary" disabled={!!ocupado}>{ocupado === 'salvar' ? 'Salvando…' : 'Salvar e-mail'}</button>
      </div>
    </form>
  );
}
