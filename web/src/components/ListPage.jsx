import { useMemo, useState } from 'react';
import { Cabecalho, IconeMais, IconeBaixar, IconeBusca } from './ui.jsx';
import FormModal from './FormModal.jsx';
import { useApoio, useLista } from '../lib/dados.js';
import { useAuth } from '../lib/auth.jsx';
import { baixarCsv } from '../lib/format.js';

const GESTAO = ['ADMIN'];

// Tela de lista padrao: cabecalho, busca, filtro, tabela, exportacao e formulario.
export default function ListPage({ ent, abas, antes, acoesExtras, cabecalho = true }) {
  const L = useApoio();
  const { data: linhas = [], isLoading, error } = useLista(ent.api);
  const { pode } = useAuth();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState(ent.filtro?.padrao || '');
  const [aberto, setAberto] = useState(null); // { registro?, preset? }
  const podeEscrever = pode(ent.escrita || GESTAO);
  const podeExcluir = pode(GESTAO);

  const visiveis = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = [...linhas];
    if (filtro && ent.filtro) r = r.filter((x) => (ent.filtro.casa ? ent.filtro.casa(x, filtro, L) : (ent.filtro.valor ? ent.filtro.valor(x, L) : x[ent.filtro.k]) === filtro));
    if (t) r = r.filter((x) => ent.texto(x, L).toLowerCase().includes(t));
    return ent.ordenar ? r.sort((a, b) => ent.ordenar(a, b, L)) : r;
  }, [linhas, q, filtro, L, ent]);

  const abrir = (registro, preset) => setAberto({ registro, preset });
  const exportar = () => {
    const cols = ent.colunas.filter((c) => c.csv);
    baixarCsv(ent.api, cols.map((c) => c.l), visiveis.map((r) => cols.map((c) => c.csv(r, L))));
  };

  return (
    <>
      {cabecalho ? (
        <Cabecalho sobre={ent.sobre} titulo={ent.titulo}>
          {acoesExtras?.(abrir, podeEscrever)}
          {podeEscrever ? <button className="btn primary" onClick={() => abrir(null, ent.presetNovo?.())}><IconeMais />{ent.novo}</button> : null}
        </Cabecalho>
      ) : null}
      {abas}
      {antes?.(L, abrir, podeEscrever)}
      <div className="toolbar">
        <label className="search"><IconeBusca />
          <input type="search" placeholder={`Buscar ${ent.titulo.toLowerCase()}…`} aria-label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {ent.filtro ? (
          <select aria-label="Filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">{ent.filtro.l}</option>
            {ent.filtro.o.map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : null}
        <span className="count">{visiveis.length} de {linhas.length}</span>
        {!cabecalho && podeEscrever ? <button className="btn primary" onClick={() => abrir(null, ent.presetNovo?.())}><IconeMais />{ent.novo}</button> : null}
        <button className="btn ghost sm" onClick={exportar} disabled={!visiveis.length} title="Exportar para Excel (CSV)"><IconeBaixar />Exportar</button>
      </div>
      <div className="tablewrap">
        {error ? <div className="empty"><strong>Não foi possível carregar.</strong>{error.message}</div>
          : isLoading || L.carregando ? <div className="empty"><strong>Carregando…</strong></div>
          : !visiveis.length ? (
            <div className="empty">
              {linhas.length ? <><strong>Nenhum resultado para os filtros atuais.</strong>Limpe a busca ou mude o filtro.</>
                : <><strong>Nenhum {ent.um} cadastrad{ent.fem ? 'a' : 'o'} ainda.</strong>{podeEscrever ? `Use “${ent.novo}” para incluir.` : ''}</>}
            </div>
          ) : (
            <table className="t">
              <thead><tr>{ent.colunas.map((c) => <th key={c.l} className={c.c || ''}>{c.l}</th>)}</tr></thead>
              <tbody>
                {visiveis.map((r) => (
                  <tr key={r.id} className="click" tabIndex={0} onClick={() => abrir(r)} onKeyDown={(e) => e.key === 'Enter' && abrir(r)}>
                    {ent.colunas.map((c) => <td key={c.l} className={c.c || ''}>{c.r(r, L, abrir, podeEscrever)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
      {aberto ? (
        <FormModal ent={ent} registro={aberto.registro} preset={aberto.preset} L={L} onFechar={() => setAberto(null)}
          podeEditar={podeEscrever && (!aberto.registro || pode(ent.edicao || ent.escrita || GESTAO))} podeExcluir={podeExcluir} />
      ) : null}
    </>
  );
}
