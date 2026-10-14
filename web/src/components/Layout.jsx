import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
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

// Botao "Instalar app": Android/Chrome usam o evento beforeinstallprompt; no iPhone mostra a instrucao.
let promptGuardado = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptGuardado = e; window.dispatchEvent(new Event('tecnitium:instalavel')); });
function useInstalar() {
  const [pode, setPode] = useState(!!promptGuardado);
  useEffect(() => {
    const f = () => setPode(!!promptGuardado);
    window.addEventListener('tecnitium:instalavel', f);
    window.addEventListener('appinstalled', () => { promptGuardado = null; setPode(false); });
    return () => window.removeEventListener('tecnitium:instalavel', f);
  }, []);
  const instalado = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !instalado;
  const instalar = async () => { if (!promptGuardado) return; promptGuardado.prompt(); await promptGuardado.userChoice.catch(() => null); promptGuardado = null; setPode(false); };
  return { pode: pode && !instalado, ios, instalar };
}

const Icone = ({ k }) => <svg viewBox="0 0 24 24" aria-hidden="true">{IC[k]}</svg>;
const corBadge = (b) => ({ background: `var(--${b[1] === 'ok' ? 'c4' : b[1]})`, color: '#111' });

export default function Layout() {
  const { usuario, sair, pode } = useAuth();
  const L = useApoio();
  const [trocarSenha, setTrocarSenha] = useState(false);
  const [mais, setMais] = useState(false);
  const inst = useInstalar();
  const local = useLocation();
  useEffect(() => { setMais(false); window.scrollTo(0, 0); }, [local.pathname]);
  const h = hoje();
  const atrasadas = L.ordens.filter((o) => OS_EM_BANCADA.includes(o.status) && o.prazo && o.prazo < h).length;
  const prontas = L.ordens.filter((o) => OS_PARA_RETIRAR.includes(o.status)).length;
  const repor = L.pecas.filter((p) => p.ativo && p.quantidade <= p.minimo).length;
  const badge = { ordens: atrasadas ? [atrasadas, 'bad', 'OS atrasadas'] : prontas ? [prontas, 'ok', 'prontas para retirar'] : null, estoque: repor ? [repor, 'warn', 'peças para repor'] : null };
  const itens = MENU.filter(([k, , perfis]) => k !== 'sep' && (!perfis || pode(perfis)));
  const NAS_ABAS = ['painel', 'ordens', 'clientes'];
  const noMais = itens.filter(([k]) => !NAS_ABAS.includes(k));
  const maisAtivo = noMais.some(([k]) => local.pathname.startsWith('/' + k));
  const iniciais = (usuario?.nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

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
                <Icone k={k} /><span>{rotulo}</span>
                {b ? <span className="badge" title={b[2]} style={corBadge(b)}>{b[0]}</span> : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="side-foot">
          {inst.pode ? <button onClick={inst.instalar}>Instalar como aplicativo</button> : null}
          <span><strong>{usuario?.nome}</strong><br />{PERFIS[usuario?.perfil]}</span>
          <div className="row"><button onClick={() => setTrocarSenha(true)}>Trocar senha</button><button onClick={sair}>Sair</button></div>
        </div>
      </aside>

      {/* celular: barra superior */}
      <header className="appbar">
        <NavLink className="brand" to="/" aria-label="Tecnitium, ir para o painel"><Marca /></NavLink>
        <div className="acoes">
          {inst.pode ? <button onClick={inst.instalar}>Instalar</button> : null}
          <button className="avatar" onClick={() => setMais(true)} aria-label="Menu da conta">{iniciais}</button>
        </div>
      </header>

      <main className="main"><Outlet /></main>

      {/* celular: abas inferiores */}
      <nav className="tabbar" aria-label="Navegação">
        <NavLink to="/" end><Icone k="painel" />Painel</NavLink>
        <NavLink to="/ordens">{badge.ordens ? <span className="badge" style={corBadge(badge.ordens)}>{badge.ordens[0]}</span> : null}<Icone k="ordens" />OS</NavLink>
        <Link className="novo" to="/ordens?nova=1" aria-label="Nova ordem de serviço"><span className="circ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></span>Nova OS</Link>
        <NavLink to="/clientes"><Icone k="clientes" />Clientes</NavLink>
        <button className={maisAtivo ? 'active' : ''} onClick={() => setMais(true)}>{badge.estoque ? <span className="badge" style={corBadge(badge.estoque)}>{badge.estoque[0]}</span> : null}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>Mais</button>
      </nav>

      {mais ? (
        <>
          <div className="mais-fundo" onClick={() => setMais(false)} />
          <div className="mais" role="dialog" aria-modal="true" aria-label="Mais opções">
            <div className="alca" />
            <div className="quem"><span><strong>{usuario?.nome}</strong><span className="sub">{PERFIS[usuario?.perfil]}</span></span><button className="x" onClick={() => setMais(false)} aria-label="Fechar">×</button></div>
            <nav aria-label="Mais seções">
              {noMais.map(([k, rotulo]) => (
                <NavLink key={k} to={'/' + k}><Icone k={k} />{rotulo}{badge[k] ? <span className="badge" style={{ ...corBadge(badge[k]), position: 'static', borderRadius: 8, padding: '0 6px', fontSize: 11 }}>{badge[k][0]}</span> : null}</NavLink>
              ))}
            </nav>
            {inst.pode ? <div className="regra" style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ flex: 1 }}>Instale o Tecnitium na tela inicial para abrir como aplicativo, em tela cheia e sem internet.</span><button className="btn primary" onClick={inst.instalar}>Instalar</button></div> : null}
            {inst.ios ? <div className="regra">Para instalar no iPhone: toque em <strong>Compartilhar</strong> no Safari e depois em <strong>Adicionar à Tela de Início</strong>.</div> : null}
            <div className="linha"><button className="btn" onClick={() => { setMais(false); setTrocarSenha(true); }}>Trocar senha</button><button className="btn" onClick={sair}>Sair</button></div>
          </div>
        </>
      ) : null}
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
