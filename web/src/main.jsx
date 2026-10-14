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
import * as G from './pages/Gestao.jsx';
import './styles/app.css';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: (n, e) => e?.status !== 401 && e?.status !== 403 && e?.status !== 404 && n < 2 } },
});

function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault(); setErro(''); setEnviando(true);
    try { await entrar(email, senha); } catch (ex) { setErro(ex.message); setEnviando(false); }
  }
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
          <h2 style={{ fontSize: 28 }}>Entrar no sistema</h2>
          {erro ? <div className="form-err" role="alert">{erro}</div> : null}
          <div className="f"><label htmlFor="email">E-mail</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></div>
          <div className="f"><label htmlFor="senha">Senha</label><input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></div>
          <button className="btn primary" style={{ justifyContent: 'center', padding: '10px 14px' }} disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
          <div className="demo-users">
            Versão de demonstração: os dados ficam salvos neste navegador e já vêm com exemplos.<br /><br />
            Acessos (senha <code>tecnitium</code>):<br />
            <code>admin@tecnitium.com.br</code> · administrador<br />
            <code>atendimento@tecnitium.com.br</code> · atendente<br />
            <code>tecnico@tecnitium.com.br</code> · técnico
          </div>
        </form>
      </section>
    </div>
  );
}

function Rotas() {
  const { usuario, pode } = useAuth();
  if (!usuario) return <Login />;
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
