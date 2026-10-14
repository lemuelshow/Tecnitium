import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

export function Placa({ placa }) {
  const p = (placa || '').toUpperCase();
  return <span className="plate" title={`Placa ${p}`}><i>BRASIL</i><b>{p}</b></span>;
}

export function Pill({ tom = 'mute', children }) {
  return <span className={`pill tone-${tom}`}>{children}</span>;
}

export function VeiculoCel({ v, ano = true }) {
  if (!v) return <span className="sub">Veículo removido</span>;
  return (
    <span className="vcell">
      <Placa placa={v.placa} />
      <span>{v.marca} {v.modelo}{ano && v.ano ? <span className="sub">{v.ano}</span> : null}</span>
    </span>
  );
}

export function Cabecalho({ sobre, titulo, children }) {
  useEffect(() => { document.title = titulo === 'Painel' ? 'Tecnitium' : `${titulo} · Tecnitium`; }, [titulo]);
  return (
    <header className="top">
      <div><p className="eyebrow">{sobre}</p><h1>{titulo}</h1></div>
      {children ? <div className="actions">{children}</div> : null}
    </header>
  );
}

export function Abas({ itens }) {
  return (
    <nav className="tabs" aria-label="Seções">
      {itens.map(([to, rotulo]) => <NavLink key={to} to={to} end>{rotulo}</NavLink>)}
    </nav>
  );
}

// Esc fecha so o modal de cima: o evento para no primeiro modal que o recebe.
export function Modal({ titulo, onFechar, children, pequeno, largo }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus({ preventScroll: true }); }, []);
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onFechar(); } }}>
      <div className={`sheet ${pequeno ? 'sm' : ''} ${largo ? 'xl' : ''}`} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={ref} style={{ outline: 'none' }}>
        {children}
      </div>
    </div>
  );
}

export function ModalTopo({ titulo, onFechar }) {
  return (
    <div className="sheet-h">
      <h2>{titulo}</h2>
      <button type="button" className="x" onClick={onFechar} aria-label="Fechar">×</button>
    </div>
  );
}

export const IconeMais = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
export const IconeBaixar = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
export const IconeBusca = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;

// ---------- avisos ----------
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [lista, setLista] = useState([]);
  const avisar = useCallback((texto, erro = false) => {
    const id = Math.random();
    setLista((l) => [...l, { id, texto, erro }]);
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), erro ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={avisar}>
      {children}
      <div id="toasts" aria-live="polite">
        {lista.map((t) => <div key={t.id} className={`toast ${t.erro ? 'bad' : ''}`}>{t.texto}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useAviso = () => useContext(ToastCtx);
