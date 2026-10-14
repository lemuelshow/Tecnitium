import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OS_STATUS, OS_EM_BANCADA, OS_PARA_RETIRAR, FORMAS_PAGAMENTO, hoje, isoDateTime, somarDias, numeroOS, totaisOS, situacaoPrazo, linkWhatsapp,
} from '@tecnitium/shared';
import { api, enviarArquivo, comprimirImagem } from '../lib/api.js';
import { useApoio, useSalvar, useExcluir } from '../lib/dados.js';
import { useAuth } from '../lib/auth.jsx';
import { brl, num, fd, fdt, baixarCsv } from '../lib/format.js';
import { Cabecalho, Pill, Modal, ModalTopo, IconeMais, IconeBusca, IconeBaixar, useAviso } from '../components/ui.jsx';
import FormModal from '../components/FormModal.jsx';
import * as E from '../entidades.jsx';

export const TOM_OS = { 'Aberta': 'info', 'Em análise': 'info', 'Aguardando aprovação': 'warn', 'Aguardando peça': 'warn', 'Em reparo': 'info', 'Pronta': 'ready', 'Sem conserto': 'mute', 'Entregue': 'ok', 'Cancelada': 'mute' };
export const useConfig = () => useQuery({ queryKey: ['config'], queryFn: () => api('/config') }).data || {};

const FILTROS = [
  ['bancada', 'Em bancada', (o) => OS_EM_BANCADA.includes(o.status)],
  ['atrasadas', 'Atrasadas', (o) => OS_EM_BANCADA.includes(o.status) && o.prazo && o.prazo < hoje()],
  ['retirar', 'Prontas para retirar', (o) => OS_PARA_RETIRAR.includes(o.status)],
  ['entregues', 'Entregues', (o) => o.status === 'Entregue'],
  ['todas', 'Todas', () => true],
];

const IconeZap = () => <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4 5.2 5.2 0 0 0 3.2.7 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z" /></svg>;

export function mensagemPronta(os, cliente, aparelho, cfg) {
  const t = totaisOS(os);
  const nome = (cliente?.nome || '').split(' ')[0];
  const pronta = os.status === 'Pronta';
  return `Olá, ${nome}! Aqui é da ${cfg.nomeEmpresa || 'assistência técnica'}. ` +
    (pronta ? `Seu ${aparelho?.marca || ''} ${aparelho?.modelo || ''} (OS ${numeroOS(os.numero)}) está pronto para retirada.` : `A avaliação do seu ${aparelho?.marca || ''} ${aparelho?.modelo || ''} (OS ${numeroOS(os.numero)}) foi concluída e ele já pode ser retirado.`) +
    (t.saldo > 0 ? ` Valor a pagar: ${brl(t.saldo)}.` : '') + (cfg.endereco ? ` Endereço: ${cfg.endereco}.` : '') + ' Obrigado!';
}

export default function Ordens() {
  const L = useApoio();
  const cfg = useConfig();
  const [params, setParams] = useSearchParams();
  const [filtro, setFiltro] = useState(params.get('f') || 'bancada');
  const [q, setQ] = useState('');
  const [aberta, setAberta] = useState(null);
  const { usuario } = useAuth();
  const [soMinhas, setSoMinhas] = useState(usuario?.perfil === 'TECNICO');

  useEffect(() => {
    const id = params.get('os');
    if (id && L.ordensPorId[id]) { setAberta({ registro: L.ordensPorId[id] }); params.delete('os'); setParams(params, { replace: true }); }
    if (params.get('nova') === '1') { setAberta({ registro: null }); params.delete('nova'); setParams(params, { replace: true }); }
  }, [params, L.ordensPorId, setParams]);

  const desc = (o) => {
    const c = L.clientesPorId[o.clienteId], a = L.aparelhosPorId[o.aparelhoId];
    return [numeroOS(o.numero), c?.nome, c?.whatsapp, c?.telefone, a?.marca, a?.modelo, a?.serie, o.defeito, o.status, L.tecnicosPorId[o.tecnicoId]?.nome].join(' ').toLowerCase();
  };
  const base = L.ordens.filter((o) => !soMinhas || o.tecnicoId === usuario?.tecnicoId);
  const fn = FILTROS.find((f) => f[0] === filtro)[2];
  const linhas = base.filter(fn).filter((o) => !q.trim() || desc(o).includes(q.trim().toLowerCase()))
    .sort((a, b) => (filtro === 'bancada' || filtro === 'atrasadas' ? (a.prazo || '9').localeCompare(b.prazo || '9') : b.numero - a.numero));

  const exportar = () => baixarCsv('ordens-de-servico', ['OS', 'Entrada', 'Cliente', 'Aparelho', 'Técnico', 'Situação', 'Prazo', 'Peças', 'Mão de obra', 'Desconto', 'Total', 'Pago', 'Retirada'],
    linhas.map((o) => { const t = totaisOS(o); const a = L.aparelhosPorId[o.aparelhoId]; return [numeroOS(o.numero), fdt(o.entrada), L.clientesPorId[o.clienteId]?.nome, `${a?.marca} ${a?.modelo}`, L.tecnicosPorId[o.tecnicoId]?.nome || '', o.status, fd(o.prazo), t.pecas.toFixed(2), t.servicos.toFixed(2), t.desconto.toFixed(2), t.total.toFixed(2), o.valorPago, fd(o.dataEntrega)]; }));

  return (
    <>
      <Cabecalho sobre="Entrada, bancada e retirada" titulo="Ordens de serviço">
        <button className="btn primary so-desktop" onClick={() => setAberta({ registro: null })}><IconeMais />Nova OS</button>
      </Cabecalho>
      <div className="board" role="group" aria-label="Filtrar ordens">
        {FILTROS.map(([k, rotulo, f]) => (
          <button key={k} className={filtro === k ? 'on' : ''} onClick={() => setFiltro(k)}>
            <b className={k === 'atrasadas' && base.filter(f).length ? 'txt-bad' : ''}>{base.filter(f).length}</b><span>{rotulo}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <label className="search"><IconeBusca /><input type="search" placeholder="Buscar por número, cliente, telefone, aparelho, IMEI…" aria-label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {usuario?.tecnicoId ? <label className="check"><input type="checkbox" checked={soMinhas} onChange={(e) => setSoMinhas(e.target.checked)} /> Só as minhas</label> : null}
        <span className="count">{linhas.length} OS</span>
        <button className="btn ghost sm" onClick={exportar} disabled={!linhas.length}><IconeBaixar />Exportar</button>
      </div>
      <div className="tablewrap">
        {L.carregando ? <div className="empty"><strong>Carregando…</strong></div> : !linhas.length ? (
          <div className="empty"><strong>Nenhuma OS neste filtro.</strong>{L.ordens.length ? 'Mude o filtro ou a busca.' : 'Use “Nova OS” para registrar o primeiro aparelho.'}</div>
        ) : (
          <table className="t cards">
            <thead><tr><th>OS</th><th>Cliente</th><th>Aparelho</th><th>Técnico</th><th>Prazo</th><th className="num">Total</th><th>Situação</th></tr></thead>
            <tbody>
              {linhas.map((o) => {
                const c = L.clientesPorId[o.clienteId], a = L.aparelhosPorId[o.aparelhoId], t = totaisOS(o), s = situacaoPrazo(o, cfg);
                return (
                  <tr key={o.id} className="click" tabIndex={0} onClick={() => setAberta({ registro: o })} onKeyDown={(e) => e.key === 'Enter' && setAberta({ registro: o })}>
                    <td className="nw" data-label="OS"><span className="cv" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span><strong className="os-num">{numeroOS(o.numero)}</strong><span className="sub">{fdt(o.entrada)}</span></span><span className="so-celular">{o.prioridade === 'Urgente' && OS_EM_BANCADA.includes(o.status) ? <Pill tom="bad">Urgente</Pill> : null}<Pill tom={TOM_OS[o.status]}>{o.status}</Pill></span></span></td>
                    <td data-label="Cliente"><span className="cv"><strong>{c?.nome}</strong><span className="sub nw">{c?.whatsapp || c?.telefone}</span></span></td>
                    <td data-label="Aparelho"><span className="cv">{a ? `${a.marca} ${a.modelo}` : '—'}<span className="sub">{(o.defeito || '').slice(0, 48)}{(o.defeito || '').length > 48 ? '…' : ''}</span></span></td>
                    <td data-label="Técnico"><span className="cv">{L.tecnicosPorId[o.tecnicoId]?.nome?.split(' ')[0] || <span className="sub">a definir</span>}</span></td>
                    <td className="nw" data-label={o.status === 'Entregue' ? 'Retirada' : 'Prazo'}><span className="cv">{o.status === 'Entregue' ? <><span>{fd(o.dataEntrega)}</span><span className="sub so-desktop-inline">retirada</span></> : <>{fd(o.prazo)}{s ? <span className={`sub txt-${s.tom === 'ok' ? '' : s.tom}`}>{s.texto}</span> : null}</>}</span></td>
                    <td className="num" data-label="Total"><span className="cv">{brl(t.total)}{t.saldo > 0.009 && o.status !== 'Cancelada' ? <span className="sub txt-warn">falta {brl(t.saldo)}</span> : null}</span></td>
                    <td className="so-desktop-cell" data-label="Situação"><span className="cv">{o.prioridade === 'Urgente' && OS_EM_BANCADA.includes(o.status) ? <><Pill tom="bad">Urgente</Pill> </> : null}<Pill tom={TOM_OS[o.status]}>{o.status}</Pill></span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {aberta ? <OSForm registro={aberta.registro} L={L} cfg={cfg} onFechar={() => setAberta(null)} /> : null}
    </>
  );
}

// ======================================================================
export function OSForm({ registro, L, cfg, onFechar }) {
  const novo = !registro?.id;
  const { usuario, pode } = useAuth();
  const avisar = useAviso();
  const qc = useQueryClient();
  const salvar = useSalvar('ordens');
  const excluir = useExcluir('ordens');
  const [form, setForm] = useState(() => registro ? { ...registro, itens: (registro.itens || []).map((i) => ({ ...i })) } : {
    status: 'Aberta', prioridade: 'Normal', entrada: isoDateTime(), prazo: somarDias(hoje(), cfg.prazoPadraoDias ?? 3), itens: [], desconto: 0, valorPago: 0,
    atendenteId: usuario?.atendenteId || null, tecnicoId: usuario?.tecnicoId || null, garantiaDias: cfg.garantiaDias ?? 90,
  });
  const [erro, setErro] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [rapido, setRapido] = useState(null); // cadastro rapido de cliente/aparelho
  const [confirmar, setConfirmar] = useState(false);
  const [zoom, setZoom] = useState(null);
  const [pendentes, setPendentes] = useState([]); // fotos ainda nao enviadas (OS nova)
  const { data: fotos = [], refetch: recarregarFotos } = useQuery({ queryKey: ['fotos', registro?.id], queryFn: () => api('/fotos?osId=' + registro.id), enabled: !novo });
  const arquivoRef = useRef();

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); if (erro[k]) setErro((e) => ({ ...e, [k]: undefined })); };
  const t = totaisOS(form);
  const cliente = L.clientesPorId[form.clienteId];
  const aparelho = L.aparelhosPorId[form.aparelhoId];
  const aparelhosDoCliente = L.aparelhos.filter((a) => a.clienteId === form.clienteId);
  const saldoInicial = useMemo(() => { const m = {}; if (registro && registro.status !== 'Cancelada') for (const i of registro.itens || []) if (i.pecaId) m[i.pecaId] = (m[i.pecaId] || 0) + Number(i.qtd); return m; }, [registro]);
  const disponivel = (pecaId) => (L.pecasPorId[pecaId]?.quantidade || 0) + (saldoInicial[pecaId] || 0);
  const usadoNaOS = (pecaId) => form.itens.filter((i) => i.pecaId === pecaId).reduce((s, i) => s + Number(i.qtd || 0), 0);

  const mudarItem = (idx, k, v) => set('itens', form.itens.map((it, j) => {
    if (j !== idx) return it;
    const n = { ...it, [k]: v };
    if (k === 'pecaId') { const p = L.pecasPorId[v]; if (p) Object.assign(n, { desc: p.descricao, valor: p.preco, custo: undefined }); }
    return n;
  }));

  async function adicionarFotos(lista) {
    for (const f of [...lista]) {
      const arq = await comprimirImagem(f);
      if (novo) setPendentes((p) => [...p, { arq, url: URL.createObjectURL(arq) }]);
      else {
        try { await enviarArquivo('/fotos', { osId: registro.id, foto: arq }); } catch (ex) { avisar(ex.message, true); }
      }
    }
    if (!novo) recarregarFotos();
  }
  async function removerFoto(f) {
    try { await api('/fotos/' + f.id, { method: 'DELETE' }); recarregarFotos(); } catch (ex) { avisar(ex.message, true); }
  }

  async function enviar(e) {
    e?.preventDefault();
    const err = {};
    if (!form.clienteId) err.clienteId = 'Escolha o cliente.';
    if (!form.aparelhoId) err.aparelhoId = 'Escolha o aparelho.';
    if (!form.defeito?.trim()) err.defeito = 'Descreva o defeito relatado.';
    setErro(err); setErroGeral('');
    if (Object.keys(err).length) return;
    const dados = { ...form, itens: form.itens.filter((i) => i.desc || i.pecaId || i.valor).map((i) => ({ ...i, qtd: Number(i.qtd) || 1, valor: Number(i.valor) || 0 })) };
    for (const k of ['desconto', 'valorPago', 'garantiaDias']) dados[k] = dados[k] === '' || dados[k] == null ? null : Number(dados[k]);
    try {
      const salvo = await salvar.mutateAsync({ id: registro?.id, dados });
      for (const p of pendentes) { try { await enviarArquivo('/fotos', { osId: salvo.id, foto: p.arq }); } catch (ex) { avisar(`Foto não enviada: ${ex.message}`, true); } }
      qc.invalidateQueries({ queryKey: ['fotos'] });
      avisar(novo ? `OS ${numeroOS(salvo.numero)} aberta.` : salvo.status === 'Entregue' && registro.status !== 'Entregue' ? `OS ${numeroOS(salvo.numero)} entregue.` : 'Alterações salvas.');
      onFechar();
    } catch (ex) {
      if (ex.campo) setErro({ [ex.campo]: ex.message }); else setErroGeral(ex.message);
      if (ex.campo === 'itens' || !ex.campo) setErroGeral(ex.message);
    }
  }

  const titulo = novo ? 'Nova ordem de serviço' : `OS ${numeroOS(registro.numero)}`;
  const zap = !novo && OS_PARA_RETIRAR.includes(form.status) && linkWhatsapp(cliente?.whatsapp || cliente?.telefone, mensagemPronta(form, cliente, aparelho, cfg));
  const sit = !novo ? situacaoPrazo(form, cfg) : null;
  const Campo = ({ k, l, children, span, obrig }) => (
    <div className={`f ${span ? 'span2' : ''} ${erro[k] ? 'bad' : ''}`}>
      <label htmlFor={'f_' + k}>{l}{obrig ? <span className="req"> *</span> : null}</label>
      {children}
      {erro[k] ? <span className="err">{erro[k]}</span> : null}
    </div>
  );
  const inp = (k, extra = {}) => ({ id: 'f_' + k, value: form[k] ?? '', onChange: (e) => set(k, e.target.value), ...extra });

  if (confirmar) {
    return (
      <Modal titulo="Excluir OS?" onFechar={() => setConfirmar(false)} pequeno>
        <ModalTopo titulo={`Excluir a OS ${numeroOS(registro.numero)}?`} onFechar={() => setConfirmar(false)} />
        <div className="confirm"><p style={{ margin: 0 }}>A OS e as fotos serão excluídas de forma permanente. As peças usadas voltam para o estoque.</p><p className="sub" style={{ margin: 0 }}>Para manter o histórico, prefira mudar a situação para “Cancelada”.</p></div>
        <div className="sheet-f"><button className="btn" onClick={() => setConfirmar(false)}>Voltar</button>
          <button className="btn danger" disabled={excluir.isPending} onClick={async () => { try { await excluir.mutateAsync(registro.id); avisar('OS excluída.'); onFechar(); } catch (ex) { setConfirmar(false); setErroGeral(ex.message); } }}>Excluir OS</button></div>
      </Modal>
    );
  }

  return (
    <Modal titulo={titulo} onFechar={onFechar} largo>
        <form onSubmit={enviar} noValidate>
          <div className="sheet-h">
            <div><h2>{titulo}</h2>{!novo ? <span className="sub">Aberta em {fdt(registro.entrada)}{L.atendentesPorId[registro.atendenteId] ? ` por ${L.atendentesPorId[registro.atendenteId].nome}` : ''}</span> : null}</div>
            <div className="actions">
              {!novo ? <Link className="btn sm" to={`/ordens/${registro.id}/imprimir`}>Imprimir</Link> : null}
              {zap ? <a className="btn sm wa" href={zap} target="_blank" rel="noreferrer"><IconeZap />Avisar cliente</a> : null}
              <button type="button" className="x" onClick={onFechar} aria-label="Fechar">×</button>
            </div>
          </div>
          <div className="os-form">
            <div className="sheet-b">
              {erroGeral ? <div className="form-err" role="alert">{erroGeral}</div> : null}
              <div className="sec-title">Cliente e aparelho</div>
              {Campo({ k: 'clienteId', l: 'Cliente', obrig: true, span: true, children: (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select {...inp('clienteId')} onChange={(e) => { const v = e.target.value || null; setForm((f) => ({ ...f, clienteId: v, aparelhoId: L.aparelhos.filter((a) => a.clienteId === v).length === 1 ? L.aparelhos.find((a) => a.clienteId === v).id : null })); }} style={{ flex: 1 }}>
                    <option value="">Selecione…</option>
                    {[...L.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.whatsapp || c.telefone ? ` · ${c.whatsapp || c.telefone}` : ''}</option>)}
                  </select>
                  {pode(['ADMIN', 'ATENDENTE']) ? <button type="button" className="btn sm" onClick={() => setRapido('cliente')}>+ Novo</button> : null}
                </div>) })}
              {Campo({ k: 'aparelhoId', l: 'Aparelho', obrig: true, span: true, children: (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select {...inp('aparelhoId')} onChange={(e) => set('aparelhoId', e.target.value || null)} disabled={!form.clienteId} style={{ flex: 1 }}>
                    <option value="">{form.clienteId ? (aparelhosDoCliente.length ? 'Selecione…' : 'Nenhum aparelho cadastrado para este cliente') : 'Escolha o cliente primeiro'}</option>
                    {aparelhosDoCliente.map((a) => <option key={a.id} value={a.id}>{a.tipo} · {a.marca} {a.modelo}{a.serie ? ` · ${a.serie}` : ''}</option>)}
                  </select>
                  {pode(['ADMIN', 'ATENDENTE']) ? <button type="button" className="btn sm" disabled={!form.clienteId} onClick={() => setRapido('aparelho')}>+ Novo</button> : null}
                </div>) })}
              {aparelho?.senha ? <p className="sub span2" style={{ gridColumn: '1/-1', margin: '-6px 0 0' }}>Senha de desbloqueio: <strong className="mono">{aparelho.senha}</strong></p> : null}

              <div className="sec-title">Entrada</div>
              {Campo({ k: 'entrada', l: 'Data e hora de entrada', obrig: true, children: <input type="datetime-local" {...inp('entrada')} /> })}
              {Campo({ k: 'prazo', l: 'Prazo de entrega', children: <input type="date" {...inp('prazo')} /> })}
              {Campo({ k: 'atendenteId', l: 'Atendente', children: <select {...inp('atendenteId')} onChange={(e) => set('atendenteId', e.target.value || null)}><option value="">—</option>{L.atendentes.filter((a) => a.ativo || a.id === form.atendenteId).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select> })}
              {Campo({ k: 'prioridade', l: 'Prioridade', children: <select {...inp('prioridade')}><option>Normal</option><option>Urgente</option></select> })}
              {Campo({ k: 'defeito', l: 'Defeito relatado pelo cliente', obrig: true, span: true, children: <textarea {...inp('defeito')} /> })}
              {Campo({ k: 'estado', l: 'Estado do aparelho na entrada', children: <input placeholder="Riscos, trincas, amassados…" {...inp('estado')} /> })}
              {Campo({ k: 'acessorios', l: 'Acessórios deixados', children: <input placeholder="Carregador, capa, chip…" {...inp('acessorios')} /> })}

              <div className="sec-title">Bancada</div>
              {Campo({ k: 'tecnicoId', l: 'Técnico responsável', children: <select {...inp('tecnicoId')} onChange={(e) => set('tecnicoId', e.target.value || null)}><option value="">A definir</option>{L.tecnicos.filter((x) => x.ativo || x.id === form.tecnicoId).map((x) => <option key={x.id} value={x.id}>{x.nome}{x.especialidade ? ` · ${x.especialidade}` : ''}</option>)}</select> })}
              {Campo({ k: 'garantiaDias', l: 'Garantia (dias)', children: <input type="number" min="0" {...inp('garantiaDias')} /> })}
              {Campo({ k: 'diagnostico', l: 'Diagnóstico', span: true, children: <textarea {...inp('diagnostico')} /> })}
              {Campo({ k: 'servicoExecutado', l: 'Serviço executado', span: true, children: <textarea {...inp('servicoExecutado')} /> })}

              <div className="items" style={erro.itens ? { borderColor: 'var(--bad)' } : undefined}>
                <table>
                  <thead><tr><th style={{ width: 110 }}>Tipo</th><th>Peça do estoque / descrição do serviço</th><th style={{ width: 80 }}>Qtd</th><th style={{ width: 120 }}>Valor unit.</th><th style={{ textAlign: 'right' }}>Subtotal</th><th /></tr></thead>
                  <tbody>
                    {form.itens.map((it, i) => {
                      const p = L.pecasPorId[it.pecaId];
                      const falta = it.tipo === 'Peça' && it.pecaId && form.status !== 'Cancelada' && usadoNaOS(it.pecaId) > disponivel(it.pecaId);
                      return (
                        <tr key={i}>
                          <td><select aria-label="Tipo" value={it.tipo} onChange={(e) => mudarItem(i, 'tipo', e.target.value)}><option>Peça</option><option value="Serviço">Mão de obra</option></select></td>
                          <td className="peca">
                            {it.tipo === 'Peça' ? (
                              <>
                                <select aria-label="Peça" value={it.pecaId || ''} onChange={(e) => mudarItem(i, 'pecaId', e.target.value)}>
                                  <option value="">Escolha a peça…</option>
                                  {L.pecas.filter((x) => x.ativo || x.id === it.pecaId).sort((a, b) => a.descricao.localeCompare(b.descricao)).map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.descricao} ({num(disponivel(x.id))} {x.unidade})</option>)}
                                </select>
                                {p ? <span className={`est ${falta ? 'bad' : ''}`}>{falta ? `Estoque insuficiente: disponível ${num(disponivel(p.id))} ${p.unidade}` : `${p.localizacao ? p.localizacao + ' · ' : ''}disponível ${num(disponivel(p.id))} ${p.unidade}`}</span> : null}
                              </>
                            ) : <input aria-label="Descrição" placeholder="Ex.: troca de tela, micro solda…" value={it.desc || ''} onChange={(e) => mudarItem(i, 'desc', e.target.value)} />}
                          </td>
                          <td><input aria-label="Quantidade" type="number" min="0" step="1" value={it.qtd ?? 1} onChange={(e) => mudarItem(i, 'qtd', e.target.value)} /></td>
                          <td><input aria-label="Valor unitário" type="number" min="0" step="0.01" value={it.valor ?? ''} onChange={(e) => mudarItem(i, 'valor', e.target.value)} /></td>
                          <td className="sum">{brl((Number(it.qtd) || 0) * (Number(it.valor) || 0))}</td>
                          <td><button type="button" className="x" aria-label="Remover item" onClick={() => set('itens', form.itens.filter((_, j) => j !== i))}>×</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="items-foot">
                  <span className="actions">
                    <button type="button" className="btn sm ghost" onClick={() => set('itens', [...form.itens, { tipo: 'Peça', qtd: 1 }])}><IconeMais />Peça</button>
                    <button type="button" className="btn sm ghost" onClick={() => set('itens', [...form.itens, { tipo: 'Serviço', qtd: 1, desc: '' }])}><IconeMais />Mão de obra</button>
                  </span>
                  <span className="sub" style={{ display: 'inline' }}>As peças saem do estoque ao salvar e voltam se a OS for cancelada.</span>
                </div>
              </div>
              {Campo({ k: 'obs', l: 'Observações internas', span: true, children: <textarea {...inp('obs')} /> })}
            </div>

            <aside className="lado">
              <div>
                <h3>Situação</h3>
                <select id="f_status" value={form.status} onChange={(e) => set('status', e.target.value)} style={{ width: '100%', padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', marginTop: 6, fontWeight: 600 }}>
                  {OS_STATUS.map((s) => <option key={s}>{s}</option>)}
                </select>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Pill tom={TOM_OS[form.status]}>{form.status}</Pill>
                  {sit ? <span className={`sub txt-${sit.tom === 'ok' ? '' : sit.tom}`} style={{ display: 'inline' }}>{sit.texto}</span> : null}
                </div>
                {erro.tecnicoId ? <p className="err txt-bad" style={{ fontSize: 12, margin: '6px 0 0' }}>{erro.tecnicoId}</p> : null}
                {form.dataPronta ? <p className="sub" style={{ marginTop: 6 }}>Pronta em {fd(form.dataPronta)}</p> : null}
              </div>
              {form.status === 'Entregue' ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <h3>Retirada</h3>
                  <div className="f"><label htmlFor="f_dataEntrega">Data da retirada</label><input type="date" {...inp('dataEntrega')} placeholder={hoje()} /></div>
                  <div className="f"><label htmlFor="f_retiradoPor">Retirado por</label><input placeholder="Nome de quem retirou" {...inp('retiradoPor')} /></div>
                </div>
              ) : null}
              <div>
                <h3>Valores</h3>
                <div className="totais" style={{ marginTop: 8 }}>
                  <span>Peças</span><span className="t">{brl(t.pecas)}</span>
                  <span>Mão de obra</span><span className="t">{brl(t.servicos)}</span>
                  <label htmlFor="f_desconto">Desconto</label><input type="number" min="0" step="0.01" {...inp('desconto')} style={{ width: 110, textAlign: 'right', padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 5, background: 'var(--surface)' }} />
                  <hr /><span style={{ alignSelf: 'end', fontWeight: 600 }}>Total</span><span className="grande">{brl(t.total)}</span>
                  <label htmlFor="f_valorPago">Pago / sinal</label><input type="number" min="0" step="0.01" {...inp('valorPago')} style={{ width: 110, textAlign: 'right', padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 5, background: 'var(--surface)' }} />
                  <span>{t.saldo > 0.009 ? 'Falta receber' : t.saldo < -0.009 ? 'Troco / crédito' : 'Saldo'}</span><span className={`t ${t.saldo > 0.009 ? 'txt-warn' : 'txt-ok'}`} style={{ fontWeight: 700 }}>{brl(Math.abs(t.saldo))}</span>
                </div>
                <div className="f" style={{ marginTop: 10 }}><label htmlFor="f_formaPagamento">Forma de pagamento</label><select {...inp('formaPagamento')} onChange={(e) => set('formaPagamento', e.target.value || null)}><option value="">—</option>{FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}</select></div>
              </div>
              <div>
                <h3>Fotos do aparelho</h3>
                <div className="fotos" style={{ marginTop: 8 }}>
                  {fotos.map((f) => (
                    <figure key={f.id}><img src={f.url} alt="Foto do aparelho" onClick={() => setZoom(f.url)} />
                      {pode(['ADMIN', 'ATENDENTE']) ? <button type="button" className="rm" aria-label="Remover foto" onClick={() => removerFoto(f)}>×</button> : null}</figure>
                  ))}
                  {pendentes.map((p, i) => (
                    <figure key={'p' + i}><img src={p.url} alt="Foto a enviar" onClick={() => setZoom(p.url)} />
                      <button type="button" className="rm" aria-label="Remover foto" onClick={() => setPendentes((l) => l.filter((_, j) => j !== i))}>×</button><span className="pend">envia ao salvar</span></figure>
                  ))}
                  <label className="add-foto">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                    Adicionar foto
                    <input ref={arquivoRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ''; }} />
                  </label>
                </div>
                <p className="sub" style={{ marginTop: 6 }}>No celular, abre a câmera. Registre o estado do aparelho na entrada.</p>
              </div>
            </aside>
          </div>
          <div className="sheet-f">
            {!novo && pode(['ADMIN']) ? <button type="button" className="btn danger left" onClick={() => setConfirmar(true)}>Excluir</button> : null}
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={salvar.isPending}>{salvar.isPending ? 'Salvando…' : novo ? 'Abrir OS' : 'Salvar'}</button>
          </div>
        </form>
      {rapido === 'cliente' ? <FormModal ent={E.clientes} L={L} onFechar={() => setRapido(null)} onSalvo={(c) => setForm((f) => ({ ...f, clienteId: c.id, aparelhoId: null }))} /> : null}
      {rapido === 'aparelho' ? <FormModal ent={E.aparelhos} L={L} preset={{ clienteId: form.clienteId }} onFechar={() => setRapido(null)} onSalvo={(a) => setForm((f) => ({ ...f, aparelhoId: a.id }))} /> : null}
      {zoom ? <div className="zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Foto ampliada"><img src={zoom} alt="Foto ampliada" /></div> : null}
    </Modal>
  );
}
