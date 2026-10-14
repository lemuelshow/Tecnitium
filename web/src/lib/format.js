export const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlCurto = (n) => {
  const v = Number(n) || 0;
  return Math.abs(v) >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl(v);
};
export const num = (n, d = 0) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fd = (s) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '—');
export const fdt = (s) => (s ? `${fd(s)} ${s.slice(11, 16)}` : '—');
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Exporta linhas para CSV (abre no Excel com acentos corretos).
export function baixarCsv(nome, cabecalho, linhas) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${nome}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
