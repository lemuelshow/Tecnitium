import { useMemo, useState } from 'react';
const totalItens = (l) => (l || []).reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valor) || 0), 0);
import { Modal, ModalTopo, IconeMais, useAviso } from './ui.jsx';
import { useSalvar, useExcluir } from '../lib/dados.js';
import { brl, cap } from '../lib/format.js';

// Formulario gerado a partir da configuracao da entidade (src/entidades.jsx).
export default function FormModal({ ent, registro, preset, L, onFechar, onSalvo, podeEditar = true, podeExcluir = true }) {
  const novo = !registro?.id;
  const inicial = useMemo(() => {
    const d = { ...(registro || {}) };
    if (novo) for (const f of ent.campos) if (f.padrao != null && d[f.k] == null) d[f.k] = typeof f.padrao === 'function' ? f.padrao() : f.padrao;
    return { ...d, ...(preset || {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [form, setForm] = useState(inicial);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const salvar = useSalvar(ent.api);
  const excluir = useExcluir(ent.api);
  const avisar = useAviso();

  const set = (k, v) => {
    setForm((atual) => {
      let prox = { ...atual, [k]: v };
      const campo = ent.campos.find((f) => f.k === k);
      if (campo?.aoMudar) prox = campo.aoMudar(v, prox, L) || prox;
      return prox;
    });
    if (erros[k]) setErros((e) => ({ ...e, [k]: undefined }));
  };

  const visivel = (f) => !f.mostrar || f.mostrar(form);
  const titulo = novo ? (ent.tituloNovo ? ent.tituloNovo(form) : ent.novo) : podeEditar ? `Editar ${ent.um}` : cap(ent.um);

  async function enviar(e) {
    e.preventDefault();
    if (!podeEditar) return;
    const err = {};
    for (const f of ent.campos) {
      if (!f.obrig || !visivel(f)) continue;
      const v = form[f.k];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) err[f.k] = 'Campo obrigatório.';
    }
    setErros(err);
    setErroGeral('');
    if (Object.keys(err).length) return;
    const dados = {};
    for (const f of ent.campos) {
      if (f.t === 'secao' || f.t === 'somenteLeitura') continue;
      if (!visivel(f)) { dados[f.k] = null; continue; }
      let v = form[f.k];
      if ((f.t === 'numero' || f.t === 'dinheiro') && v !== '' && v != null) v = Number(v);
      if (f.t === 'itens') v = (v || []).filter((i) => i.desc || i.valor);
      dados[f.k] = v ?? null;
    }
    try {
      const salvo = await salvar.mutateAsync({ id: registro?.id, dados });
      avisar(ent.msgSalvo ? ent.msgSalvo(salvo, novo) : novo ? `${cap(ent.um)} registrad${ent.fem ? 'a' : 'o'}.` : 'Alterações salvas.');
      onSalvo?.(salvo);
      onFechar();
    } catch (ex) {
      if (ex.campo && ent.campos.some((f) => f.k === ex.campo)) setErros({ [ex.campo]: ex.message });
      else setErroGeral(ex.message);
    }
  }

  async function confirmarExclusao() {
    try { await excluir.mutateAsync(registro.id); avisar('Registro excluído.'); onFechar(); }
    catch (ex) { setConfirmando(false); setErroGeral(ex.message); }
  }

  if (confirmando) {
    return (
      <Modal titulo={`Excluir ${ent.um}?`} onFechar={() => setConfirmando(false)} pequeno>
        <ModalTopo titulo={`Excluir ${ent.um}?`} onFechar={() => setConfirmando(false)} />
        <div className="confirm">
          <p style={{ margin: 0 }}><strong>{ent.nomeDe ? ent.nomeDe(registro, L) : ent.um}</strong> será excluído de forma permanente.</p>
          <p className="sub" style={{ margin: 0 }}>Registros ligados a ele continuam no histórico.</p>
        </div>
        <div className="sheet-f">
          <button type="button" className="btn" onClick={() => setConfirmando(false)}>Cancelar</button>
          <button type="button" className="btn danger" onClick={confirmarExclusao} disabled={excluir.isPending}>Excluir</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <form onSubmit={enviar} noValidate>
        <ModalTopo titulo={titulo} onFechar={onFechar} />
        <fieldset disabled={!podeEditar} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="sheet-b">
          {erroGeral ? <div className="form-err" role="alert">{erroGeral}</div> : null}
          {ent.campos.filter(visivel).map((f) => <Campo key={f.k} f={f} valor={form[f.k]} form={form} set={set} erro={erros[f.k]} L={L} registro={registro} />)}
        </div>
        </fieldset>
        <div className="sheet-f">
          {!novo && podeExcluir ? <button type="button" className="btn danger left" onClick={() => setConfirmando(true)}>Excluir</button> : null}
          <button type="button" className="btn" onClick={onFechar}>{podeEditar ? 'Cancelar' : 'Fechar'}</button>
          {podeEditar ? <button type="submit" className="btn primary" disabled={salvar.isPending}>{salvar.isPending ? 'Salvando…' : 'Salvar'}</button> : null}
        </div>
      </form>
    </Modal>
  );
}

function Campo({ f, valor, form, set, erro, L, registro }) {
  const id = `f_${f.k}`;
  if (f.t === 'oculto') return null;
  if (f.t === 'secao') return <div className="sec-title">{f.l}</div>;
  if (f.t === 'itens') return <Itens valor={valor || []} set={(v) => set(f.k, v)} erro={erro} />;
  if (f.t === 'checklist') return <Checklist valor={valor || []} set={(v) => set(f.k, v)} erro={erro} />;

  let input;
  if (f.t === 'somenteLeitura') input = <div className="ro" id={id}>{f.valor(registro, form, L)}</div>;
  else if (f.t === 'select' || f.t === 'ref') {
    const opcoes = f.t === 'ref' ? f.o(L, form) : f.o.map((o) => [o, o]);
    if (valor && !opcoes.some(([v]) => v === valor)) opcoes.unshift([valor, f.t === 'ref' ? '(registro inativo ou removido)' : valor]);
    input = (
      <select id={id} value={valor ?? ''} onChange={(e) => set(f.k, e.target.value || null)}>
        <option value="">{f.obrig ? 'Selecione…' : '—'}</option>
        {opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    );
  } else if (f.t === 'texto-longo') input = <textarea id={id} value={valor ?? ''} onChange={(e) => set(f.k, e.target.value)} />;
  else if (f.t === 'bool') {
    return (
      <div className={`f ${f.span ? 'span2' : ''}`}>
        <label className="check" htmlFor={id}><input id={id} type="checkbox" checked={!!valor} onChange={(e) => set(f.k, e.target.checked)} /> {f.l}</label>
        {f.dica ? <span className="hint">{f.dica}</span> : null}
      </div>
    );
  } else {
    const type = { numero: 'number', dinheiro: 'number', data: 'date', dataHora: 'datetime-local', senha: 'password', email: 'email' }[f.t] || 'text';
    input = (
      <input
        id={id} type={type} value={valor ?? ''} autoComplete="off"
        step={f.t === 'dinheiro' ? '0.01' : f.passo || undefined} min={f.t === 'numero' || f.t === 'dinheiro' ? '0' : undefined}
        maxLength={f.t === 'placa' ? 8 : undefined}
        style={f.t === 'placa' ? { textTransform: 'uppercase', fontFamily: 'var(--f-mono)' } : undefined}
        onChange={(e) => set(f.k, f.t === 'placa' ? e.target.value.toUpperCase() : e.target.value)}
      />
    );
  }
  return (
    <div className={`f ${f.span ? 'span2' : ''} ${erro ? 'bad' : ''}`}>
      <label htmlFor={id}>{f.l}{f.obrig ? <span className="req"> *</span> : null}</label>
      {input}
      {erro ? <span className="err">{erro}</span> : f.dica ? <span className="hint">{f.dica}</span> : null}
    </div>
  );
}

function Itens({ valor, set, erro }) {
  const mudar = (i, k, v) => set(valor.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  return (
    <div className="items" style={erro ? { borderColor: 'var(--bad)' } : undefined}>
      <table>
        <thead><tr><th style={{ width: '44%' }}>Descrição</th><th style={{ width: 118 }}>Tipo</th><th style={{ width: 80 }}>Qtd</th><th style={{ width: 120 }}>Valor unit.</th><th style={{ textAlign: 'right' }}>Subtotal</th><th /></tr></thead>
        <tbody>
          {valor.map((it, i) => (
            <tr key={i}>
              <td><input aria-label="Descrição" value={it.desc || ''} onChange={(e) => mudar(i, 'desc', e.target.value)} /></td>
              <td><select aria-label="Tipo" value={it.tipo || 'Peça'} onChange={(e) => mudar(i, 'tipo', e.target.value)}><option>Peça</option><option>Serviço</option></select></td>
              <td><input aria-label="Quantidade" type="number" min="0" step="0.01" value={it.qtd ?? 1} onChange={(e) => mudar(i, 'qtd', Number(e.target.value))} /></td>
              <td><input aria-label="Valor unitário" type="number" min="0" step="0.01" value={it.valor ?? ''} onChange={(e) => mudar(i, 'valor', Number(e.target.value))} /></td>
              <td className="sum">{brl((it.qtd ?? 1) * (it.valor || 0))}</td>
              <td><button type="button" className="x" aria-label="Remover item" onClick={() => set(valor.filter((_, j) => j !== i))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="items-foot">
        <button type="button" className="btn sm ghost" onClick={() => set([...valor, { desc: '', tipo: 'Peça', qtd: 1, valor: '' }])}><IconeMais />Adicionar peça ou serviço</button>
        <span>{erro ? <span className="txt-bad" style={{ marginRight: 10 }}>{erro}</span> : null}Total <strong>{brl(totalItens(valor))}</strong></span>
      </div>
    </div>
  );
}

function Checklist({ valor, set, erro }) {
  const mudar = (i, k, v) => set(valor.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  return (
    <div className="checklist" style={erro ? { borderColor: 'var(--bad)' } : undefined}>
      {valor.map((it, i) => (
        <div className="ci" key={it.item}>
          <span>{it.item}</span>
          <span className="seg" role="group" aria-label={it.item}>
            <button type="button" className={`ok ${it.conforme === true ? 'on' : ''}`} onClick={() => mudar(i, 'conforme', true)}>Conforme</button>
            <button type="button" className={`bad ${it.conforme === false ? 'on' : ''}`} onClick={() => mudar(i, 'conforme', false)}>Não conforme</button>
          </span>
          <input aria-label={`Observação: ${it.item}`} placeholder="Observação" value={it.obs || ''} onChange={(e) => mudar(i, 'obs', e.target.value)} />
        </div>
      ))}
    </div>
  );
}
