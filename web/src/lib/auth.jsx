import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, lerSessao, gravarSessao, definirAoExpirar } from './api.js';

const Ctx = createContext(null);

export const PERFIS = { ADMIN: 'Administrador', ATENDENTE: 'Atendente', TECNICO: 'Técnico' };

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(lerSessao);
  const qc = useQueryClient();

  const sair = useCallback(() => { gravarSessao(null); setSessao(null); qc.clear(); }, [qc]);
  useEffect(() => definirAoExpirar(sair), [sair]);

  const entrar = useCallback(async (email, senha) => {
    const s = await api('/auth/login', { method: 'POST', body: { email, senha } });
    gravarSessao(s);
    setSessao(s);
  }, []);

  const entrarCliente = useCallback(async (documento, senha) => {
    const s = await api('/auth/cliente', { method: 'POST', body: { documento, senha } });
    gravarSessao(s);
    setSessao(s);
  }, []);

  const valor = useMemo(() => ({
    usuario: sessao?.usuario || null,
    entrar,
    entrarCliente,
    sair,
    pode: (perfis) => !perfis || perfis.includes(sessao?.usuario?.perfil),
  }), [sessao, entrar, entrarCliente, sair]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
