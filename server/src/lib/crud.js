import { Router } from 'express';
import { falha, HttpError, rota } from './http.js';
import { exigirPerfil } from './auth.js';

const GESTAO = ['ADMIN'];

// Converte o corpo da requisicao para os tipos do modelo, ignorando campos desconhecidos.
function converter(recurso, corpo, criando) {
  const dados = {};
  for (const [k, def] of Object.entries(recurso.campos)) {
    if (!(k in corpo)) {
      if (criando && def.obrigatorio && def.padrao == null) throw falha(`Informe ${def.rotulo || k}.`, k);
      continue;
    }
    let v = corpo[k];
    if (v === '' || v === undefined) v = null;
    if (v != null) {
      switch (def.tipo) {
        case 'int': v = Math.round(Number(v)); if (!Number.isFinite(v)) throw falha(`Informe um número válido para ${def.rotulo || k}.`, k); break;
        case 'float': v = Number(v); if (!Number.isFinite(v)) throw falha(`Informe um número válido para ${def.rotulo || k}.`, k); break;
        case 'bool': v = v === true || v === 'true' || v === 1 || v === 'Sim'; break;
        case 'json': v = JSON.stringify(Array.isArray(v) ? v : []); break;
        default: v = String(v).trim(); if (v === '') v = null;
      }
    }
    if (v == null && def.obrigatorio) throw falha(`Informe ${def.rotulo || k}.`, k);
    if (v != null && def.opcoes && !def.opcoes.includes(v)) throw falha(`O valor "${v}" não é aceito para ${def.rotulo || k}.`, k);
    if (v == null && def.tipo === 'json') v = '[]';
    dados[k] = v;
  }
  return dados;
}

// Converte o registro do banco para JSON da API (campos JSON viram arrays).
export function saida(recurso, reg) {
  if (!reg) return reg;
  const o = { ...reg };
  for (const [k, def] of Object.entries(recurso.campos)) {
    if (def.tipo === 'json' && typeof o[k] === 'string') {
      try { o[k] = JSON.parse(o[k]); } catch { o[k] = []; }
    }
  }
  return o;
}

export function rotasCrud(prisma, recurso) {
  const r = Router();
  const escrita = exigirPerfil(recurso.escrita || GESTAO);
  const exclusao = exigirPerfil(recurso.exclusao || GESTAO);

  r.get('/', rota(async (_req, res) => {
    const regs = await prisma[recurso.modelo].findMany({ orderBy: recurso.ordem || { criadoEm: 'desc' } });
    res.json(regs.map((x) => saida(recurso, x)));
  }));

  r.get('/:id', rota(async (req, res) => {
    const reg = await prisma[recurso.modelo].findUnique({ where: { id: req.params.id } });
    if (!reg) throw new HttpError(404, 'Registro não encontrado.');
    res.json(saida(recurso, reg));
  }));

  r.post('/', escrita, rota(async (req, res) => {
    const dados = converter(recurso, req.body || {}, true);
    const reg = await prisma.$transaction(async (tx) => {
      const ctx = { tx, novo: true, atual: null, usuario: req.usuario };
      ctx.final = { ...dados, ...deJson(recurso, dados) };
      await recurso.validar?.(ctx.final, ctx);
      await recurso.antes?.(dados, ctx);
      const criado = await tx[recurso.modelo].create({ data: dados });
      await recurso.depois?.(saida(recurso, criado), ctx);
      return tx[recurso.modelo].findUnique({ where: { id: criado.id } });
    });
    res.status(201).json(saida(recurso, reg));
  }));

  r.put('/:id', escrita, rota(async (req, res) => {
    const dados = converter(recurso, req.body || {}, false);
    const reg = await prisma.$transaction(async (tx) => {
      const atualBruto = await tx[recurso.modelo].findUnique({ where: { id: req.params.id } });
      if (!atualBruto) throw new HttpError(404, 'Registro não encontrado.');
      const atual = saida(recurso, atualBruto);
      const ctx = { tx, novo: false, atual, usuario: req.usuario };
      ctx.final = { ...atual, ...dados, ...deJson(recurso, dados) };
      await recurso.validar?.(ctx.final, ctx);
      await recurso.antes?.(dados, ctx);
      const salvo = await tx[recurso.modelo].update({ where: { id: req.params.id }, data: dados });
      await recurso.depois?.(saida(recurso, salvo), ctx);
      return tx[recurso.modelo].findUnique({ where: { id: salvo.id } });
    });
    res.json(saida(recurso, reg));
  }));

  r.delete('/:id', exclusao, rota(async (req, res) => {
    await prisma.$transaction(async (tx) => {
      const atual = await tx[recurso.modelo].findUnique({ where: { id: req.params.id } });
      if (!atual) throw new HttpError(404, 'Registro não encontrado.');
      await recurso.aoExcluir?.(saida(recurso, atual), { tx, usuario: req.usuario });
      await tx[recurso.modelo].delete({ where: { id: req.params.id } });
    });
    res.status(204).end();
  }));

  return r;
}

// Na validacao de alteracao, campos JSON chegam como texto: devolve-os como arrays.
function deJson(recurso, dados) {
  const o = {};
  for (const [k, def] of Object.entries(recurso.campos)) {
    if (def.tipo === 'json' && typeof dados[k] === 'string') o[k] = JSON.parse(dados[k]);
  }
  return o;
}
