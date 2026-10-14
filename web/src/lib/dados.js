import { useMemo } from 'react';
import { useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';

export const useLista = (recurso, opts = {}) => useQuery({ queryKey: [recurso], queryFn: () => api('/' + recurso), ...opts });

// Tabelas usadas para mostrar nomes no lugar de ids (cliente, aparelho, tecnico...).
const BASE = ['clientes', 'aparelhos', 'tecnicos', 'atendentes', 'pecas', 'ordens'];

export function useApoio() {
  const res = useQueries({ queries: BASE.map((r) => ({ queryKey: [r], queryFn: () => api('/' + r) })) });
  const carregando = res.some((r) => r.isLoading);
  const datas = res.map((r) => r.data);
  return useMemo(() => {
    const L = { carregando };
    BASE.forEach((r, i) => {
      const lista = datas[i] || [];
      L[r] = lista;
      L[r + 'PorId'] = Object.fromEntries(lista.map((x) => [x.id, x]));
    });
    return L;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, ...datas]);
}

// Gravar: qualquer alteracao pode mexer em outras tabelas (ex.: OS muda o veiculo),
// entao todas as consultas sao recarregadas.
export function useSalvar(recurso) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }) => api(`/${recurso}${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', body: dados }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useExcluir(recurso) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/${recurso}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
