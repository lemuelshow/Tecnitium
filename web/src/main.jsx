import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { ToastProvider } from './components/ui.jsx';
import Layout, { Marca } from './components/Layout.jsx';
import Painel from './pages/Painel.jsx';
import Ordens from './pages/Ordens.jsx';
import Imprimir from './pages/Imprimir.jsx';
import Portal from './pages/Portal.jsx';
import * as G from './pages/Gestao.jsx';
import './styles/app.css';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: (n, e) => e?.status !== 401 && e?.status !== 403 && e?.status !== 404 && n < 2 } },
});

function Login() {
  const { entrar, entrarCliente } = useAuth();
  const [modo, setModo] = useState(() => (new URLSearchParams(window.location.search).get('cliente') != null ? 'cliente' : 'equipe'));
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [doc, setDoc] = useState('');
  const [senhaCli, setSenhaCli] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault(); setErro(''); setEnviando(true);
    try { modo === 'cliente' ? await entrarCliente(doc, senhaCli) : await entrar(email, senha); } catch (ex) { setErro(ex.message); setEnviando(false); }
  }
  const trocar = (m) => { setModo(m); setErro(''); };
  return (
    <div className="login">
      <section className="login-art">
        <div>
          <h1>Do balcão<br />à <span>retirada</span>.</h1>
          <p>Ordens de serviço com fotos, estoque de peças, prazos, avisos de aparelho pronto e comissão dos técnicos em um só lugar.</p>
        </div>
        <span className="eyebrow" style={{ color: 'var(--nav-ink)' }}>Tecnitium · Assistência técnica</span>
      </section>
      <section className="login-box">
        <form onSubmit={enviar}>
          <span className="brand"><Marca /></span>
          <div className="seg-login" role="tablist" aria-label="Tipo de acesso">
            <button type="button" role="tab" aria-selected={modo === 'equipe'} className={modo === 'equipe' ? 'on' : ''} onClick={() => trocar('equipe')}>Equipe</button>
            <button type="button" role="tab" aria-selected={modo === 'cliente'} className={modo === 'cliente' ? 'on' : ''} onClick={() => trocar('cliente')}>Sou cliente</button>
          </div>
          <h2 style={{ fontSize: 28 }}>{modo === 'cliente' ? 'Acompanhe seu aparelho' : 'Entrar no sistema'}</h2>
          {erro ? <div className="form-err" role="alert">{erro}</div> : null}
          {modo === 'cliente' ? (
            <>
              <div className="f"><label htmlFor="doc">CPF ou CNPJ</label><input id="doc" inputMode="numeric" value={doc} onChange={(e) => setDoc(e.target.value)} autoComplete="username" placeholder="Somente números" required /></div>
              <div className="f"><label htmlFor="senhaCli">Senha</label><input id="senhaCli" type="password" inputMode="numeric" value={senhaCli} onChange={(e) => setSenhaCli(e.target.value)} autoComplete="current-password" required /><span className="hint">A senha também é o seu CPF ou CNPJ.</span></div>
            </>
          ) : (
            <>
              <div className="f"><label htmlFor="email">E-mail</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></div>
              <div className="f"><label htmlFor="senha">Senha</label><input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></div>
            </>
          )}
          <button className="btn primary" style={{ justifyContent: 'center', padding: '10px 14px' }} disabled={enviando}>{enviando ? 'Entrando…' : modo === 'cliente' ? 'Ver minhas ordens' : 'Entrar'}</button>
          <div className="demo-users">
            {modo === 'cliente' ? (
              <>Use o CPF ou CNPJ do seu cadastro como login e como senha.<br /><br />Exemplo para testar: <code>12345678910</code> no login e na senha (Ana Carolina Prado).</>
            ) : (
              <>
                Versão de demonstração: os dados ficam salvos neste navegador e já vêm com exemplos.<br /><br />
                Acessos (senha <code>tecnitium</code>):<br />
                <code>admin@tecnitium.com.br</code> · administrador<br />
                <code>atendimento@tecnitium.com.br</code> · atendente<br />
                <code>tecnico@tecnitium.com.br</code> · técnico
              </>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function Rotas() {
  const { usuario, pode } = useAuth();
  if (!usuario) return <Login />;
  if (usuario.perfil === 'CLIENTE') return <Portal />;
  const admin = pode(['ADMIN']);
  return (
    <Routes>
      <Route path="ordens/:id/imprimir" element={<Imprimir />} />
      <Route element={<Layout />}>
        <Route index element={<Painel />} />
        <Route path="ordens" element={<Ordens />} />
        <Route path="clientes" element={<G.Clientes />} />
        <Route path="aparelhos" element={<G.Aparelhos />} />
        <Route path="estoque" element={<G.Estoque />} />
        <Route path="estoque/movimentacoes" element={<G.Movimentacoes />} />
        {pode(['ADMIN', 'TECNICO']) ? <Route path="comissoes" element={<G.Comissoes />} /> : null}
        {admin ? <Route path="tecnicos" element={<G.Tecnicos />} /> : null}
        {admin ? <Route path="atendentes" element={<G.Atendentes />} /> : null}
        {admin ? <Route path="usuarios" element={<G.Usuarios />} /> : null}
        {admin ? <Route path="configuracoes" element={<G.Configuracoes />} /> : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

// Aplicativo instalavel (PWA): o service worker guarda o app para abrir sem internet.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const tinhaControle = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    // Versao nova publicada: recarrega uma vez para usar os arquivos novos.
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (tinhaControle) window.location.reload(); });
  });
}

// Outra aba gravou dados: recarrega as telas desta aba.
window.addEventListener('storage', (e) => { if (e.key === 'tecnitium:banco:v1') qc.invalidateQueries(); });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Rotas />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
