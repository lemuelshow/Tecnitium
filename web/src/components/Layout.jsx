import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { OS_EM_BANCADA, OS_PARA_RETIRAR, hoje } from '@tecnitium/shared';
import { useAuth, PERFIS } from '../lib/auth.jsx';
import { useApoio } from '../lib/dados.js';
import { api } from '../lib/api.js';
import { Modal, ModalTopo, useAviso } from './ui.jsx';

export const Marca = ({ sub = 'Assistência técnica' }) => (
  <>
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <rect x="8" y="8" width="24" height="24" rx="4" fill="var(--accent)" />
      <rect x="14" y="14" width="12" height="12" rx="2" fill="var(--nav)" />
      <path d="M14 4v4M20 4v4M26 4v4M14 32v4M20 32v4M26 32v4M4 14h4M4 20h4M4 26h4M32 14h4M32 20h4M32 26h4" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="20" cy="20" r="2.4" fill="var(--c4)" />
    </svg>
    <span><b>Tecnitium</b><small>{sub}</small></span>
  </>
);

const IC = {
  painel: <path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z" />,
  ordens: <path d="M9 4h6v3H9zM7 5H5v16h14V5h-2M8 12h8M8 16h5" />,
  clientes: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  aparelhos: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>,
  estoque: <path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" />,
  comissoes: <path d="M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3" />,
  tecnicos: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  atendentes: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  usuarios: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  configuracoes: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
};

const MENU = [
  ['painel', 'Painel'],
  ['sep', 'Atendimento'], ['ordens', 'Ordens de serviço'], ['clientes', 'Clientes'], ['aparelhos', 'Aparelhos'],
  ['sep', 'Gestão'], ['estoque', 'Estoque'], ['comissoes', 'Comissões', ['ADMIN', 'TECNICO']],
  ['sep', 'Equipe', ['ADMIN']], ['tecnicos', 'Técnicos', ['ADMIN']], ['atendentes', 'Atendentes', ['ADMIN']], ['usuarios', 'Usuários', ['ADMIN']], ['configuracoes', 'Configurações', ['ADMIN']],
];

export default function Layout() {
  const { usuario, sair, pode } = useAuth();
  const L = useApoio();
  const [trocarSenha, setTrocarSenha] = useState(false);
  const h = hoje();
  const atrasadas = L.ordens.filter((o) => OS_EM_BANCADA.includes(o.status) && o.prazo && o.prazo < h).length;
  const prontas = L.ordens.filter((o) => OS_PARA_RETIRAR.includes(o.status)).length;
  const repor = L.pecas.filter((p) => p.ativo && p.quantidade <= p.minimo).length;
  const badge = { ordens: atrasadas ? [atrasadas, 'bad', 'OS atrasadas'] : prontas ? [prontas, 'ok', 'prontas para retirar'] : null, estoque: repor ? [repor, 'warn', 'peças para repor'] : null };
  return (
    <div className="app">
      <aside className="side">
        <NavLink className="brand" to="/" aria-label="Tecnitium, ir para o painel"><Marca /></NavLink>
        <nav className="nav" aria-label="Menu principal">
          {MENU.map(([k, rotulo, perfis], i) => {
            if (perfis && !pode(perfis)) return null;
            if (k === 'sep') return <div key={i} className="nav-sep">{rotulo}</div>;
            const b = badge[k];
            return (
              <NavLink key={k} to={k === 'painel' ? '/' : '/' + k} end={k === 'painel'}>
                <svg viewBox="0 0 24 24" aria-hidden="true">{IC[k]}</svg><span>{rotulo}</span>
                {b ? <span className="badge" title={b[2]} style={{ background: `var(--${b[1] === 'ok' ? 'c4' : b[1]})`, color: '#111' }}>{b[0]}</span> : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="side-foot">
          <span><strong>{usuario?.nome}</strong><br />{PERFIS[usuario?.perfil]}</span>
          <div className="row"><button onClick={() => setTrocarSenha(true)}>Trocar senha</button><button onClick={sair}>Sair</button></div>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
      {trocarSenha ? <TrocarSenha onFechar={() => setTrocarSenha(false)} /> : null}
    </div>
  );
}

function TrocarSenha({ onFechar }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const avisar = useAviso();
  async function enviar(e) {
    e.preventDefault();
    setSalvando(true); setErro('');
    try { await api('/auth/senha', { method: 'PUT', body: { atual, nova } }); avisar('Senha alterada.'); onFechar(); }
    catch (ex) { setErro(ex.message); setSalvando(false); }
  }
  return (
    <Modal titulo="Trocar senha" onFechar={onFechar} pequeno>
      <form onSubmit={enviar}>
        <ModalTopo titulo="Trocar senha" onFechar={onFechar} />
        <div className="sheet-b" style={{ gridTemplateColumns: '1fr' }}>
          {erro ? <div className="form-err" role="alert">{erro}</div> : null}
          <div className="f"><label htmlFor="s_atual">Senha atual</label><input id="s_atual" type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" /></div>
          <div className="f"><label htmlFor="s_nova">Nova senha</label><input id="s_nova" type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" /><span className="hint">Mínimo de 6 caracteres</span></div>
        </div>
        <div className="sheet-f"><button type="button" className="btn" onClick={onFechar}>Cancelar</button><button className="btn primary" disabled={salvando}>Salvar senha</button></div>
      </form>
    </Modal>
  );
}
