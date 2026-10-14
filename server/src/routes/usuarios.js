import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rota, HttpError, falha } from '../lib/http.js';
import { gerarToken, exigirLogin, exigirPerfil, PERFIS } from '../lib/auth.js';

const publico = ({ senhaHash, ...u }) => u;

export function rotasAuth(prisma) {
  const r = Router();

  r.post('/login', rota(async (req, res) => {
    const { email, senha } = req.body || {};
    if (!email || !senha) throw falha('Informe e-mail e senha.');
    const u = await prisma.usuario.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!u || !u.ativo || !(await bcrypt.compare(String(senha), u.senhaHash))) throw new HttpError(401, 'E-mail ou senha incorretos.');
    res.json({ token: gerarToken(u), usuario: publico(u) });
  }));

  r.put('/senha', exigirLogin, rota(async (req, res) => {
    const { atual, nova } = req.body || {};
    const u = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!(await bcrypt.compare(String(atual || ''), u.senhaHash))) throw falha('A senha atual está incorreta.', 'atual');
    if (!nova || String(nova).length < 6) throw falha('A nova senha precisa ter ao menos 6 caracteres.', 'nova');
    await prisma.usuario.update({ where: { id: u.id }, data: { senhaHash: await bcrypt.hash(String(nova), 10) } });
    res.status(204).end();
  }));

  return r;
}

export function rotasUsuarios(prisma) {
  const r = Router();
  r.use(exigirPerfil(['ADMIN']));

  const validar = (b, novo) => {
    if (!b.nome?.trim()) throw falha('Informe o nome.', 'nome');
    if (!/^\S+@\S+\.\S+$/.test(b.email || '')) throw falha('Informe um e-mail válido.', 'email');
    if (!PERFIS[b.perfil]) throw falha('Perfil inválido.', 'perfil');
    if (b.perfil === 'TECNICO' && !b.tecnicoId) throw falha('Escolha o cadastro do técnico ligado a este login.', 'tecnicoId');
    if ((novo || b.senha) && String(b.senha || '').length < 6) throw falha('A senha precisa ter ao menos 6 caracteres.', 'senha');
  };
  const dados = (b) => ({
    nome: b.nome.trim(), email: b.email.trim().toLowerCase(), perfil: b.perfil, ativo: b.ativo !== false,
    tecnicoId: b.perfil === 'TECNICO' ? b.tecnicoId : null, atendenteId: b.perfil === 'ATENDENTE' ? b.atendenteId || null : null,
  });

  r.get('/', rota(async (_req, res) => res.json((await prisma.usuario.findMany({ orderBy: { nome: 'asc' } })).map(publico))));

  r.post('/', rota(async (req, res) => {
    const b = req.body || {};
    validar(b, true);
    res.status(201).json(publico(await prisma.usuario.create({ data: { ...dados(b), senhaHash: await bcrypt.hash(String(b.senha), 10) } })));
  }));

  r.put('/:id', rota(async (req, res) => {
    const b = req.body || {};
    validar(b, false);
    if (req.params.id === req.usuario.id && (b.perfil !== 'ADMIN' || b.ativo === false)) throw falha('Você não pode remover o seu próprio acesso de administrador.', 'perfil');
    const data = dados(b);
    if (b.senha) data.senhaHash = await bcrypt.hash(String(b.senha), 10);
    res.json(publico(await prisma.usuario.update({ where: { id: req.params.id }, data })));
  }));

  r.delete('/:id', rota(async (req, res) => {
    if (req.params.id === req.usuario.id) throw falha('Você não pode excluir o seu próprio usuário.');
    await prisma.usuario.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }));

  return r;
}
