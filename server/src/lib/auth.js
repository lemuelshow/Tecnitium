import jwt from 'jsonwebtoken';
import { HttpError } from './http.js';

const SEGREDO = () => process.env.JWT_SECRET || 'troque-esta-chave-em-producao';

export const PERFIS = {
  ADMIN: 'Administrador',
  ATENDENTE: 'Atendente',
  TECNICO: 'Técnico',
};

export function gerarToken(usuario) {
  return jwt.sign({ sub: usuario.id, nome: usuario.nome, perfil: usuario.perfil, tecnicoId: usuario.tecnicoId, atendenteId: usuario.atendenteId }, SEGREDO(), { expiresIn: '12h' });
}

export function exigirLogin(req, _res, next) {
  const cab = req.headers.authorization || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Faça login para continuar.'));
  try {
    const p = jwt.verify(token, SEGREDO());
    req.usuario = { id: p.sub, nome: p.nome, perfil: p.perfil, tecnicoId: p.tecnicoId, atendenteId: p.atendenteId };
    next();
  } catch {
    next(new HttpError(401, 'Sua sessão expirou. Faça login de novo.'));
  }
}

export const exigirPerfil = (perfis) => (req, _res, next) => {
  if (!perfis || perfis.includes(req.usuario?.perfil)) return next();
  next(new HttpError(403, 'Seu perfil não tem permissão para esta ação.'));
};
