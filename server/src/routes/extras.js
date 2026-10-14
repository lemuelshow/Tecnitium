// Rotas que nao sao cadastro simples: configuracao, fotos, painel e comissoes.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { rota, falha, HttpError } from '../lib/http.js';
import { exigirPerfil } from '../lib/auth.js';
import { lerConfig, UPLOADS } from '../resources/index.js';
import {
  OS_EM_BANCADA, OS_PARA_RETIRAR, hoje, mesDe, isoDate, totaisOS, situacaoPrazo, numeroOS,
} from '@tecnitium/shared';

const soma = (l, f) => l.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const lerOS = async (prisma, where) => (await prisma.ordemServico.findMany({ where, orderBy: { numero: 'desc' } })).map((o) => ({ ...o, itens: JSON.parse(o.itens || '[]') }));

export function rotasConfig(prisma) {
  const r = Router();
  r.get('/', rota(async (_req, res) => res.json(await lerConfig(prisma))));
  r.put('/', exigirPerfil(['ADMIN']), rota(async (req, res) => {
    const b = req.body || {};
    if (!b.nomeEmpresa?.trim()) throw falha('Informe o nome da empresa.', 'nomeEmpresa');
    const n = (v, min, max, campo) => { const x = Math.round(Number(v)); if (!Number.isFinite(x) || x < min || x > max) throw falha(`Valor entre ${min} e ${max}.`, campo); return x; };
    const data = {
      nomeEmpresa: b.nomeEmpresa.trim(), documento: b.documento || null, telefone: b.telefone || null, whatsapp: b.whatsapp || null, endereco: b.endereco || null,
      prazoPadraoDias: n(b.prazoPadraoDias, 0, 90, 'prazoPadraoDias'), garantiaDias: n(b.garantiaDias, 0, 730, 'garantiaDias'), diasAbandono: n(b.diasAbandono, 1, 365, 'diasAbandono'),
      baseComissaoPeca: b.baseComissaoPeca === 'Lucro' ? 'Lucro' : 'Venda', termos: b.termos || null,
    };
    await lerConfig(prisma);
    res.json(await prisma.configuracao.update({ where: { id: 1 }, data }));
  }));
  return r;
}

export function rotasFotos(prisma) {
  const r = Router();
  fs.mkdirSync(UPLOADS, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: UPLOADS,
      filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase() || '.jpg'}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(/^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype) ? null : new HttpError(422, 'Envie uma imagem JPG, PNG ou WEBP.'), true),
  });

  r.get('/', rota(async (req, res) => {
    if (!req.query.osId) throw falha('Informe a OS.');
    res.json(await prisma.fotoOS.findMany({ where: { osId: String(req.query.osId) }, orderBy: { criadoEm: 'asc' } }));
  }));
  r.post('/', upload.single('foto'), rota(async (req, res) => {
    if (!req.file) throw falha('Nenhuma imagem recebida.');
    const os = await prisma.ordemServico.findUnique({ where: { id: String(req.body.osId || '') } });
    if (!os) { fs.rm(req.file.path, { force: true }, () => {}); throw new HttpError(404, 'OS não encontrada.'); }
    res.status(201).json(await prisma.fotoOS.create({ data: { osId: os.id, arquivo: req.file.filename, legenda: req.body.legenda || null } }));
  }));
  r.delete('/:id', exigirPerfil(['ADMIN', 'ATENDENTE']), rota(async (req, res) => {
    const f = await prisma.fotoOS.findUnique({ where: { id: req.params.id } });
    if (!f) throw new HttpError(404, 'Foto não encontrada.');
    await prisma.fotoOS.delete({ where: { id: f.id } });
    fs.rm(path.join(UPLOADS, f.arquivo), { force: true }, () => {});
    res.status(204).end();
  }));
  return r;
}

export function rotasPainel(prisma) {
  const r = Router();
  r.get('/', rota(async (req, res) => {
    const cfg = await lerConfig(prisma);
    const filtro = req.usuario.perfil === 'TECNICO' ? { tecnicoId: req.usuario.tecnicoId } : {};
    const [ordens, clientes, aparelhos, pecas] = await Promise.all([lerOS(prisma, filtro), prisma.cliente.findMany(), prisma.aparelho.findMany(), prisma.peca.findMany({ where: { ativo: true } })]);
    const cli = Object.fromEntries(clientes.map((c) => [c.id, c]));
    const apa = Object.fromEntries(aparelhos.map((a) => [a.id, a]));
    const h = hoje();
    const resumo = (o) => {
      const a = apa[o.aparelhoId];
      return { id: o.id, numero: o.numero, status: o.status, cliente: cli[o.clienteId]?.nome, telefone: cli[o.clienteId]?.whatsapp || cli[o.clienteId]?.telefone, aparelho: a ? `${a.tipo} ${a.marca} ${a.modelo}` : '', prazo: o.prazo, dataPronta: o.dataPronta, total: totaisOS(o).total, saldo: totaisOS(o).saldo, situacao: situacaoPrazo(o, cfg, h), tecnicoId: o.tecnicoId };
    };
    const bancada = ordens.filter((o) => OS_EM_BANCADA.includes(o.status));
    const retirar = ordens.filter((o) => OS_PARA_RETIRAR.includes(o.status));
    const atrasadas = bancada.filter((o) => o.prazo && o.prazo < h);
    const venceHoje = bancada.filter((o) => o.prazo === h);
    const entreguesMes = ordens.filter((o) => o.status === 'Entregue' && mesDe(o.dataEntrega) === h.slice(0, 7));
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const k = isoDate(d).slice(0, 7);
      const doMes = ordens.filter((o) => o.status === 'Entregue' && mesDe(o.dataEntrega) === k);
      meses.push({ chave: k, rotulo: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), pecas: soma(doMes, (o) => totaisOS(o).pecas * (totaisOS(o).bruto ? totaisOS(o).total / totaisOS(o).bruto : 0)), servicos: soma(doMes, (o) => totaisOS(o).servicos * (totaisOS(o).bruto ? totaisOS(o).total / totaisOS(o).bruto : 0)), os: doMes.length });
    }
    const porStatus = {};
    for (const o of ordens) porStatus[o.status] = (porStatus[o.status] || 0) + 1;
    res.json({
      config: { nomeEmpresa: cfg.nomeEmpresa, diasAbandono: cfg.diasAbandono },
      contadores: {
        bancada: bancada.length, retirar: retirar.length, atrasadas: atrasadas.length, venceHoje: venceHoje.length,
        entreguesMes: entreguesMes.length, faturamentoMes: soma(entreguesMes, (o) => totaisOS(o).total),
        comissoesMes: soma(entreguesMes, (o) => o.comissaoPeca + o.comissaoServico),
        aReceber: soma(retirar, (o) => Math.max(0, totaisOS(o).saldo)),
        estoqueBaixo: pecas.filter((p) => p.quantidade <= p.minimo).length,
      },
      atrasadas: atrasadas.map(resumo).sort((a, b) => a.prazo.localeCompare(b.prazo)),
      venceHoje: venceHoje.map(resumo),
      prontas: retirar.map(resumo).sort((a, b) => (a.dataPronta || '').localeCompare(b.dataPronta || '')),
      estoqueBaixo: pecas.filter((p) => p.quantidade <= p.minimo).map((p) => ({ id: p.id, codigo: p.codigo, descricao: p.descricao, quantidade: p.quantidade, minimo: p.minimo, unidade: p.unidade })),
      porStatus, meses,
    });
  }));
  return r;
}

export function rotasComissoes(prisma) {
  const r = Router();
  r.get('/', rota(async (req, res) => {
    const { perfil, tecnicoId } = req.usuario;
    if (perfil === 'ATENDENTE') throw new HttpError(403, 'Seu perfil não tem acesso às comissões.');
    if (perfil === 'TECNICO' && !tecnicoId) throw new HttpError(403, 'Seu login não está ligado a um técnico.');
    const de = String(req.query.de || hoje().slice(0, 8) + '01');
    const ate = String(req.query.ate || hoje());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) throw falha('Período inválido.');
    const where = { status: 'Entregue', dataEntrega: { gte: de, lte: ate }, ...(perfil === 'TECNICO' ? { tecnicoId } : {}) };
    const [ordens, tecnicos, clientes, aparelhos] = await Promise.all([lerOS(prisma, where), prisma.tecnico.findMany({ orderBy: { nome: 'asc' } }), prisma.cliente.findMany(), prisma.aparelho.findMany()]);
    const cli = Object.fromEntries(clientes.map((c) => [c.id, c.nome]));
    const apa = Object.fromEntries(aparelhos.map((a) => [a.id, `${a.marca} ${a.modelo}`]));
    // Meses (inteiros ou parciais) do periodo ate hoje, para o salario fixo.
    const meses = (() => { const fim = ate < hoje() ? ate : hoje(); if (fim < de) return 0; const [y1, m1] = de.split('-').map(Number); const [y2, m2] = fim.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1) + 1; })();
    const lista = tecnicos
      .filter((t) => (perfil === 'TECNICO' ? t.id === tecnicoId : t.ativo || ordens.some((o) => o.tecnicoId === t.id)))
      .map((t) => {
        const os = ordens.filter((o) => o.tecnicoId === t.id);
        const detalhes = os.map((o) => {
          const tt = totaisOS(o);
          const fator = tt.bruto ? tt.total / tt.bruto : 0;
          return { id: o.id, numero: numeroOS(o.numero), dataEntrega: o.dataEntrega, cliente: cli[o.clienteId], aparelho: apa[o.aparelhoId], pecas: tt.pecas * fator, servicos: tt.servicos * fator, regime: o.regime, percPeca: o.percPeca, percServico: o.percServico, comissaoPeca: o.comissaoPeca, comissaoServico: o.comissaoServico };
        });
        const salario = t.regime === 'Salário fixo' ? t.salario * meses : 0;
        const cp = soma(detalhes, (d) => d.comissaoPeca), cs = soma(detalhes, (d) => d.comissaoServico);
        return {
          id: t.id, nome: t.nome, regime: t.regime, percPeca: t.percPeca, percServico: t.percServico, salarioMensal: t.salario,
          os: detalhes.length, pecas: soma(detalhes, (d) => d.pecas), servicos: soma(detalhes, (d) => d.servicos),
          comissaoPeca: cp, comissaoServico: cs, salario, total: cp + cs + salario, detalhes,
        };
      });
    res.json({ de, ate, meses, tecnicos: lista });
  }));
  return r;
}
