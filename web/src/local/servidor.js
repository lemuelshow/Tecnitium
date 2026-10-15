// "Servidor" que roda dentro do navegador: recebe as mesmas rotas que a API Node recebia
// (/ordens, /painel, /comissoes...) e responde com os dados do localStorage.
import { OS_EM_BANCADA, OS_PARA_RETIRAR, hoje, mesDe, isoDate, totaisOS, situacaoPrazo, numeroOS, etapasOS, documentoDoCliente, documentoValidoParaPortal, somenteDigitos } from '@tecnitium/shared';
import { HttpError, falha } from './erros.js';
import { banco, transacao, carregar, bancoVazio, hashSenha, exportarBanco, importarBanco, limparBanco } from './banco.js';
import { recursos, lerConfig } from './recursos.js';
import { carregarExemplos } from './exemplos.js';
import { listarFotos, salvarFoto, obterFoto, apagarFoto, apagarTodasFotos, atualizarFoto } from './fotos.js';

const SESSAO = 'tecnitium:sessao';
export const LIMITE_VIDEO = 150 * 1024 * 1024; // 150 MB por video
const PERFIS = { ADMIN: 'Administrador', ATENDENTE: 'Atendente', TECNICO: 'Técnico' };
const soma = (l, f) => l.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const publico = ({ senhaHash, resetHash, resetExpira, resetTentativas, ...u }) => u;
const exigir = (usuario, perfis) => { if (!perfis.includes(usuario.perfil)) throw new HttpError(403, 'Seu perfil não tem permissão para esta ação.'); };

// Na primeira abertura, carrega os dados de exemplo.
let preparando = null;
async function preparar() {
  if (bancoVazio()) {
    preparando ||= transacao(() => carregarExemplos(true)).finally(() => { preparando = null; });
    await preparando;
  }
}

async function usuarioLogado() {
  let sessao = null;
  try { sessao = JSON.parse(localStorage.getItem(SESSAO))?.usuario; } catch { /* sem sessao */ }
  if (sessao?.perfil === 'CLIENTE') {
    // Cliente: vale enquanto o CPF/CNPJ do cadastro nao mudar.
    const c = await banco.cliente.findUnique({ where: { id: sessao.clienteId } });
    if (!c || documentoDoCliente(c) !== sessao.documento) throw new HttpError(401, 'Seu acesso expirou. Entre de novo com o seu CPF ou CNPJ.');
    return { id: 'cliente:' + c.id, perfil: 'CLIENTE', clienteId: c.id, nome: c.nome };
  }
  const id = sessao?.id;
  const u = id && (await banco.usuario.findUnique({ where: { id } }));
  if (!u || !u.ativo) throw new HttpError(401, 'Faça login para continuar.');
  return u;
}

export async function servidor(method, caminho, corpo) {
  await preparar();
  carregar();
  const [rota, qs] = caminho.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const [base, id, sub] = rota.split('/').filter(Boolean);
  const body = corpo == null ? {} : corpo;

  if (base === 'auth' && id === 'login' && method === 'POST') return login(body);
  if (base === 'auth' && id === 'cliente' && method === 'POST') return loginCliente(body);
  if (base === 'auth' && id === 'esqueci' && method === 'POST') return esqueciSenha(body);
  if (base === 'auth' && id === 'redefinir' && method === 'POST') return redefinirSenha(body);
  const usuario = await usuarioLogado();
  // O cliente so enxerga o portal (as proprias OS); nada do restante do sistema.
  if (usuario.perfil === 'CLIENTE') {
    if (base === 'portal' && method === 'GET') return portal(usuario, id, sub);
    throw new HttpError(403, 'Acesso restrito ao acompanhamento das suas ordens de serviço.');
  }
  if (base === 'auth' && id === 'senha') return trocarSenha(usuario, body);
  if (base === 'usuarios') return usuarios(method, id, body, usuario);
  if (base === 'config' && id === 'teste-email') return testarEmail(body, usuario);
  if (base === 'config') return config(method, body, usuario);
  if (base === 'fotos') return fotos(method, id, body, query, usuario);
  if (base === 'painel') return painel(usuario);
  if (base === 'comissoes') return comissoes(usuario, query);
  if (base === 'dados') return dados(id, body, usuario);
  if (base === 'impostos' && id === 'base') return baseImpostos(usuario, query);
  if (recursos[base] && !sub) return crud(recursos[base], method, id, body, usuario);
  throw new HttpError(404, 'Rota não encontrada.');
}

// ---------- login e usuarios ----------
async function login({ email, senha }) {
  if (!email || !senha) throw falha('Informe e-mail e senha.');
  const u = await banco.usuario.findUnique({ where: { email: String(email).trim().toLowerCase() } });
  if (!u || !u.ativo || u.senhaHash !== (await hashSenha(u.email, String(senha)))) throw new HttpError(401, 'E-mail ou senha incorretos.');
  return { token: 'local', usuario: publico(u) };
}

// Login do cliente: CPF/CNPJ como usuario e como senha (so os numeros contam).
async function loginCliente({ documento, senha }) {
  const doc = somenteDigitos(documento);
  if (!doc || !senha) throw falha('Informe o seu CPF ou CNPJ no login e na senha.');
  if (!documentoValidoParaPortal(doc)) throw falha('Digite o CPF (11 números) ou o CNPJ (14 números).', 'documento');
  const c = (await banco.cliente.findMany()).find((x) => documentoDoCliente(x) === doc);
  if (!c || somenteDigitos(senha) !== doc) throw new HttpError(401, 'CPF/CNPJ ou senha incorretos. A senha é o seu CPF ou CNPJ. Se não conseguir, fale com a loja.');
  return { token: 'local', usuario: { id: 'cliente:' + c.id, perfil: 'CLIENTE', clienteId: c.id, nome: c.nome, documento: doc } };
}

// ---------- e-mail (SMTP pela funcao /api/email) e recuperacao de senha ----------
async function enviarEmail(cfg, { para, assunto, texto, html }) {
  if (!cfg.smtpUsuario || !cfg.smtpSenha) throw new HttpError(422, 'O envio de e-mail não está configurado. O administrador precisa cadastrar o SMTP em Configurações.');
  let resp;
  try {
    resp = await fetch('/api/email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtp: { host: cfg.smtpHost, porta: cfg.smtpPorta, usuario: cfg.smtpUsuario, senha: cfg.smtpSenha, remetente: cfg.smtpRemetente || cfg.nomeEmpresa }, para, assunto, texto, html }),
    });
  } catch {
    throw new HttpError(503, navigator.onLine ? 'Não foi possível acessar o serviço de e-mail. Tente de novo em instantes.' : 'Sem internet: o e-mail não pôde ser enviado.');
  }
  const corpo = await resp.json().catch(() => null);
  if (resp.status === 404) throw new HttpError(503, 'O serviço de e-mail (/api/email) não está disponível neste endereço. Ele funciona no sistema publicado na Vercel e no "npm run dev".');
  if (!resp.ok) throw new HttpError(502, corpo?.erro || 'O e-mail não pôde ser enviado.');
}

async function testarEmail({ para }, usuario) {
  exigir(usuario, ['ADMIN']);
  const cfg = await transacao((tx) => lerConfig(tx));
  const destino = String(para || cfg.smtpUsuario || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) throw falha('Informe para qual e-mail enviar o teste.', 'para');
  await enviarEmail(cfg, {
    para: destino, assunto: `Teste de e-mail - ${cfg.nomeEmpresa}`,
    texto: `Este é um e-mail de teste do Tecnitium.\n\nSe você recebeu esta mensagem, o envio de e-mails de ${cfg.nomeEmpresa} está funcionando.`,
  });
  return { ok: true, para: destino };
}

const codigoAleatorio = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
const AVISO_GENERICO = 'Se o e-mail estiver cadastrado, enviamos um código de 6 números. Ele vale por 15 minutos.';

async function esqueciSenha({ email }) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw falha('Informe o seu e-mail de acesso.', 'email');
  const cfg = await transacao((tx) => lerConfig(tx));
  if (!cfg.smtpUsuario || !cfg.smtpSenha) throw new HttpError(422, 'A recuperação de senha por e-mail ainda não foi configurada. Peça ao administrador para trocar a sua senha em Usuários.');
  const u = await banco.usuario.findUnique({ where: { email: e } });
  // Mesmo sem cadastro a resposta e igual: nao revela quais e-mails existem.
  if (!u || !u.ativo) return { mensagem: AVISO_GENERICO };
  const codigo = codigoAleatorio();
  const expira = new Date(Date.now() + 15 * 60000).toISOString();
  await transacao((tx) => tx.usuario.update({ where: { id: u.id }, data: { resetHash: '', resetExpira: null } }));
  await enviarEmail(cfg, {
    para: u.email, assunto: `Código para redefinir sua senha - ${cfg.nomeEmpresa}`,
    texto: `Olá, ${u.nome.split(' ')[0]}!\n\nSeu código para redefinir a senha do Tecnitium é: ${codigo}\n\nEle vale por 15 minutos. Se você não pediu, ignore este e-mail: sua senha continua a mesma.`,
    html: `<p>Olá, ${u.nome.split(' ')[0].replace(/[<>&]/g, '')}!</p><p>Seu código para redefinir a senha do Tecnitium é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:monospace">${codigo}</p><p>Ele vale por 15 minutos. Se você não pediu, ignore este e-mail: sua senha continua a mesma.</p><p style="color:#666">${String(cfg.nomeEmpresa).replace(/[<>&]/g, '')}</p>`,
  });
  // So grava o codigo depois que o e-mail saiu.
  const resetHash = await hashSenha(u.email, 'codigo:' + codigo);
  await transacao((tx) => tx.usuario.update({ where: { id: u.id }, data: { resetHash, resetExpira: expira, resetTentativas: 0 } }));
  return { mensagem: AVISO_GENERICO };
}

async function redefinirSenha({ email, codigo, nova }) {
  const e = String(email || '').trim().toLowerCase();
  const c = somenteDigitos(codigo);
  if (c.length !== 6) throw falha('Digite os 6 números do código que chegou no e-mail.', 'codigo');
  if (!nova || String(nova).length < 6) throw falha('A nova senha precisa ter ao menos 6 caracteres.', 'nova');
  const u = await banco.usuario.findUnique({ where: { email: e } });
  const invalido = () => new HttpError(422, 'Código inválido ou vencido. Peça um novo código.');
  if (!u || !u.resetHash || !u.resetExpira) throw invalido();
  if (new Date(u.resetExpira) < new Date()) throw invalido();
  if ((u.resetTentativas || 0) >= 5) throw new HttpError(429, 'Muitas tentativas com código errado. Peça um novo código.');
  if (u.resetHash !== (await hashSenha(u.email, 'codigo:' + c))) {
    await transacao((tx) => tx.usuario.update({ where: { id: u.id }, data: { resetTentativas: (u.resetTentativas || 0) + 1 } }));
    throw falha('Código incorreto. Confira os números no e-mail.', 'codigo');
  }
  const senhaHash = await hashSenha(u.email, String(nova));
  await transacao((tx) => tx.usuario.update({ where: { id: u.id }, data: { senhaHash, resetHash: null, resetExpira: null, resetTentativas: 0 } }));
  return { mensagem: 'Senha alterada. Entre com a nova senha.' };
}

// ---------- portal do cliente ----------
const paraCliente = (o) => {
  const os = { ...o, itens: JSON.parse(o.itens || '[]').map(({ custo, pecaId, ...i }) => i), historico: JSON.parse(o.historico || '[]') };
  for (const k of ['obs', 'regime', 'percPeca', 'percServico', 'comissaoPeca', 'comissaoServico', 'atendenteId']) delete os[k];
  return os;
};
async function portal(usuario, id, sub) {
  const cfg = await transacao((tx) => lerConfig(tx));
  const empresa = { nomeEmpresa: cfg.nomeEmpresa, documento: cfg.documento, telefone: cfg.telefone, whatsapp: cfg.whatsapp, endereco: cfg.endereco, termos: cfg.termos };
  const cliente = await banco.cliente.findUnique({ where: { id: usuario.clienteId } });
  const { obs, ...clientePublico } = cliente;
  const aparelhos = Object.fromEntries((await banco.aparelho.findMany({ where: { clienteId: cliente.id } })).map(({ senha, obs: o, ...a }) => [a.id, a]));
  const ordens = (await banco.ordemServico.findMany({ where: { clienteId: cliente.id }, orderBy: { numero: 'desc' } })).map(paraCliente);
  if (!id) {
    return {
      cliente: { nome: cliente.nome }, empresa,
      ordens: ordens.map((o) => ({ id: o.id, numero: o.numero, status: o.status, entrada: o.entrada, prazo: o.prazo, dataPronta: o.dataPronta, dataEntrega: o.dataEntrega, defeito: o.defeito, aparelho: aparelhos[o.aparelhoId], total: totaisOS(o).total, saldo: totaisOS(o).saldo, etapas: etapasOS(o) })),
    };
  }
  const os = ordens.find((o) => o.id === id);
  if (!os) throw new HttpError(404, 'Ordem de serviço não encontrada.');
  const tec = os.tecnicoId ? await banco.tecnico.findUnique({ where: { id: os.tecnicoId } }) : null;
  const fotos = (await listarFotos(os.id)).filter((f) => (f.momento || 'Entrada') === 'Entrada');
  return { os, cliente: clientePublico, aparelho: aparelhos[os.aparelhoId], tecnico: tec ? { nome: tec.nome } : null, config: empresa, fotos, etapas: etapasOS(os) };
}

async function trocarSenha(usuario, { atual, nova }) {
  if (usuario.senhaHash !== (await hashSenha(usuario.email, String(atual || '')))) throw falha('A senha atual está incorreta.', 'atual');
  if (!nova || String(nova).length < 6) throw falha('A nova senha precisa ter ao menos 6 caracteres.', 'nova');
  const senhaHash = await hashSenha(usuario.email, String(nova));
  await transacao((tx) => tx.usuario.update({ where: { id: usuario.id }, data: { senhaHash } }));
  return null;
}

async function usuarios(method, id, b, eu) {
  exigir(eu, ['ADMIN']);
  if (method === 'GET') return (await banco.usuario.findMany({ orderBy: { nome: 'asc' } })).map(publico);
  if (method === 'DELETE') {
    if (id === eu.id) throw falha('Você não pode excluir o seu próprio usuário.');
    await transacao((tx) => tx.usuario.delete({ where: { id } }));
    return null;
  }
  const novo = method === 'POST';
  if (!b.nome?.trim()) throw falha('Informe o nome.', 'nome');
  if (!/^\S+@\S+\.\S+$/.test(b.email || '')) throw falha('Informe um e-mail válido.', 'email');
  if (!PERFIS[b.perfil]) throw falha('Perfil inválido.', 'perfil');
  if (b.perfil === 'TECNICO' && !b.tecnicoId) throw falha('Escolha o cadastro do técnico ligado a este login.', 'tecnicoId');
  if ((novo || b.senha) && String(b.senha || '').length < 6) throw falha('A senha precisa ter ao menos 6 caracteres.', 'senha');
  if (!novo && id === eu.id && (b.perfil !== 'ADMIN' || b.ativo === false)) throw falha('Você não pode remover o seu próprio acesso de administrador.', 'perfil');
  const email = b.email.trim().toLowerCase();
  const data = {
    nome: b.nome.trim(), email, perfil: b.perfil, ativo: b.ativo !== false,
    tecnicoId: b.perfil === 'TECNICO' ? b.tecnicoId : null, atendenteId: b.perfil === 'ATENDENTE' ? b.atendenteId || null : null,
  };
  if (b.senha) data.senhaHash = await hashSenha(email, String(b.senha));
  else if (!novo) {
    // A senha e protegida pelo e-mail: se o e-mail mudar sem senha nova, pede a senha.
    const atual = await banco.usuario.findUnique({ where: { id } });
    if (atual && atual.email !== email) throw falha('Ao trocar o e-mail, informe também uma nova senha.', 'senha');
  }
  return publico(await transacao((tx) => (novo ? tx.usuario.create({ data }) : tx.usuario.update({ where: { id }, data }))));
}

// ---------- cadastros genericos (mesma logica do crud.js do servidor) ----------
function converter(recurso, corpo, criando) {
  const d = {};
  for (const [k, def] of Object.entries(recurso.campos)) {
    if (!(k in corpo)) {
      if (criando && def.obrigatorio) throw falha(`Informe ${def.rotulo || k}.`, k);
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
    d[k] = v;
  }
  return d;
}
function saida(recurso, reg) {
  if (!reg) return reg;
  const o = { ...reg };
  for (const [k, def] of Object.entries(recurso.campos)) if (def.tipo === 'json' && typeof o[k] === 'string') { try { o[k] = JSON.parse(o[k]); } catch { o[k] = []; } }
  return o;
}
const deJson = (recurso, d) => Object.fromEntries(Object.entries(recurso.campos).filter(([k, def]) => def.tipo === 'json' && typeof d[k] === 'string').map(([k]) => [k, JSON.parse(d[k])]));

async function crud(recurso, method, id, body, usuario) {
  const m = recurso.modelo;
  if (recurso.leitura) exigir(usuario, recurso.leitura);
  if (method === 'GET') {
    if (id) {
      const r = await banco[m].findUnique({ where: { id } });
      if (!r) throw new HttpError(404, 'Registro não encontrado.');
      return saida(recurso, r);
    }
    return (await banco[m].findMany({ orderBy: recurso.ordem || { criadoEm: 'desc' } })).map((x) => saida(recurso, x));
  }
  if (method === 'DELETE') {
    exigir(usuario, recurso.exclusao || ['ADMIN']);
    await transacao(async (tx) => {
      const atual = await tx[m].findUnique({ where: { id } });
      if (!atual) throw new HttpError(404, 'Registro não encontrado.');
      await recurso.aoExcluir?.(saida(recurso, atual), { tx, usuario });
      await tx[m].delete({ where: { id } });
    });
    return null;
  }
  exigir(usuario, recurso.escrita || ['ADMIN']);
  const novo = method === 'POST';
  const dados = converter(recurso, body, novo);
  const reg = await transacao(async (tx) => {
    const atual = novo ? null : saida(recurso, await tx[m].findUnique({ where: { id } }));
    if (!novo && !atual) throw new HttpError(404, 'Registro não encontrado.');
    const ctx = { tx, novo, atual, usuario };
    ctx.final = { ...(atual || {}), ...dados, ...deJson(recurso, dados) };
    await recurso.validar?.(ctx.final, ctx);
    await recurso.antes?.(dados, ctx);
    const salvo = novo ? await tx[m].create({ data: dados }) : await tx[m].update({ where: { id }, data: dados });
    await recurso.depois?.(saida(recurso, salvo), ctx);
    return tx[m].findUnique({ where: { id: salvo.id } });
  });
  return saida(recurso, reg);
}

// ---------- configuracao, fotos e backup ----------
async function config(method, b, usuario) {
  if (method === 'GET') {
    const { smtpSenha, ...cfg } = await transacao((tx) => lerConfig(tx));
    if (usuario.perfil !== 'ADMIN') { for (const k of Object.keys(cfg)) if (k.startsWith('smtp')) delete cfg[k]; return cfg; }
    return { ...cfg, smtpSenhaDefinida: !!smtpSenha };
  }
  exigir(usuario, ['ADMIN']);
  if (!b.nomeEmpresa?.trim()) throw falha('Informe o nome da empresa.', 'nomeEmpresa');
  const n = (v, min, max, campo) => { const x = Math.round(Number(v)); if (!Number.isFinite(x) || x < min || x > max) throw falha(`Valor entre ${min} e ${max}.`, campo); return x; };
  const data = {
    nomeEmpresa: b.nomeEmpresa.trim(), documento: b.documento || null, telefone: b.telefone || null, whatsapp: b.whatsapp || null, endereco: b.endereco || null,
    prazoPadraoDias: n(b.prazoPadraoDias, 0, 90, 'prazoPadraoDias'), garantiaDias: n(b.garantiaDias, 0, 730, 'garantiaDias'), diasAbandono: n(b.diasAbandono, 1, 365, 'diasAbandono'),
    baseComissaoPeca: b.baseComissaoPeca === 'Lucro' ? 'Lucro' : 'Venda', termos: b.termos || null,
  };
  // O SMTP so muda quando vem da secao de e-mail (a tela de dados da empresa nao manda esses campos).
  if ('smtpUsuario' in b) Object.assign(data, {
    smtpHost: String(b.smtpHost || 'smtp.gmail.com').trim(), smtpPorta: [465, 587].includes(Number(b.smtpPorta)) ? Number(b.smtpPorta) : 465,
    smtpUsuario: b.smtpUsuario ? String(b.smtpUsuario).trim().toLowerCase() : null, smtpRemetente: b.smtpRemetente ? String(b.smtpRemetente).trim() : null,
  });
  if (data.smtpUsuario && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.smtpUsuario)) throw falha('Informe um e-mail válido para o SMTP.', 'smtpUsuario');
  // Senha de app: vazia = mantem a atual; "apagar" remove.
  if (b.smtpSenha) data.smtpSenha = String(b.smtpSenha).replace(/\s+/g, '');
  if (b.smtpRemoverSenha) data.smtpSenha = null;
  const { smtpSenha, ...salvo } = await transacao(async (tx) => { await lerConfig(tx); return tx.configuracao.update({ where: { id: 1 }, data }); });
  return { ...salvo, smtpSenhaDefinida: !!smtpSenha };
}

async function fotos(method, id, b, query, usuario) {
  if (method === 'GET') { if (!query.osId) throw falha('Informe a OS.'); return listarFotos(query.osId); }
  if (method === 'POST') {
    const arq = b.foto;
    if (!(arq instanceof Blob)) throw falha('Nenhum arquivo recebido.');
    const video = /^video\//.test(arq.type);
    if (!video && !/^image\//.test(arq.type)) throw falha('Envie uma foto (JPG, PNG, WEBP) ou um vídeo (MP4, MOV, WEBM).');
    if (!video && arq.size > 5 * 1024 * 1024) throw falha('A imagem passa de 5 MB.');
    if (video && arq.size > LIMITE_VIDEO) throw falha(`O vídeo tem ${Math.round(arq.size / 1048576)} MB e o limite é ${LIMITE_VIDEO / 1048576} MB. Grave um vídeo mais curto (até uns 2 minutos).`);
    const os = await banco.ordemServico.findUnique({ where: { id: String(b.osId || '') } });
    if (!os) throw new HttpError(404, 'OS não encontrada.');
    // Foto de entrada (o cliente ve) enquanto a OS ainda nao entrou em reparo; depois, foto do reparo.
    const momento = b.momento || (['Aberta', 'Em análise'].includes(os.status) ? 'Entrada' : 'Reparo');
    return salvarFoto(b.osId, arq, b.legenda, momento);
  }
  if (method === 'PUT') {
    const arq = b.foto;
    if (!(arq instanceof Blob) || !/^image\//.test(arq.type)) throw falha('Imagem inválida.');
    const atual = await obterFoto(id);
    if (atual?.tipo === 'video') throw falha('Só é possível desenhar em fotos.');
    const f = await atualizarFoto(id, arq);
    if (!f) throw new HttpError(404, 'Foto não encontrada.');
    return f;
  }
  if (method === 'DELETE') {
    exigir(usuario, ['ADMIN', 'ATENDENTE']);
    if (!(await obterFoto(id))) throw new HttpError(404, 'Foto não encontrada.');
    await apagarFoto(id);
    return null;
  }
  throw new HttpError(404, 'Rota não encontrada.');
}

async function dados(acao, b, usuario) {
  exigir(usuario, ['ADMIN']);
  if (acao === 'backup') return exportarBanco();
  if (acao === 'restaurar') {
    importarBanco(b.dados);
    if (!(await banco.usuario.findUnique({ where: { id: usuario.id } }))) localStorage.removeItem(SESSAO);
    return null;
  }
  if (acao === 'exemplos' || acao === 'limpar') {
    // Mantem quem esta logado para nao derrubar a sessao.
    const eu = await banco.usuario.findUnique({ where: { id: usuario.id } });
    limparBanco();
    await apagarTodasFotos();
    await transacao(async (tx) => {
      await carregarExemplos(acao === 'exemplos');
      if (!(await tx.usuario.findUnique({ where: { email: eu.email } }))) await tx.usuario.create({ data: { ...eu, tecnicoId: null, atendenteId: null } });
      const novoEu = await tx.usuario.findUnique({ where: { email: eu.email } });
      localStorage.setItem(SESSAO, JSON.stringify({ token: 'local', usuario: publico(novoEu) }));
    });
    return null;
  }
  throw new HttpError(404, 'Rota não encontrada.');
}

// ---------- painel e comissoes (mesma logica do servidor) ----------
const lerOS = async (where) => (await banco.ordemServico.findMany({ where, orderBy: { numero: 'desc' } })).map((o) => ({ ...o, itens: JSON.parse(o.itens || '[]') }));

async function painel(usuario) {
  const cfg = await transacao((tx) => lerConfig(tx));
  const filtro = usuario.perfil === 'TECNICO' ? { tecnicoId: usuario.tecnicoId } : {};
  const [ordens, clientes, aparelhos, pecas] = await Promise.all([lerOS(filtro), banco.cliente.findMany(), banco.aparelho.findMany(), banco.peca.findMany({ where: { ativo: true } })]);
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
  const liquido = (o, k) => { const t = totaisOS(o); return t[k] * (t.bruto ? t.total / t.bruto : 0); };
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    const k = isoDate(d).slice(0, 7);
    const doMes = ordens.filter((o) => o.status === 'Entregue' && mesDe(o.dataEntrega) === k);
    meses.push({ chave: k, rotulo: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), pecas: soma(doMes, (o) => liquido(o, 'pecas')), servicos: soma(doMes, (o) => liquido(o, 'servicos')), os: doMes.length });
  }
  const porStatus = {};
  for (const o of ordens) porStatus[o.status] = (porStatus[o.status] || 0) + 1;
  const baixo = pecas.filter((p) => p.quantidade <= p.minimo);
  return {
    config: { nomeEmpresa: cfg.nomeEmpresa, diasAbandono: cfg.diasAbandono },
    contadores: {
      bancada: bancada.length, retirar: retirar.length, atrasadas: atrasadas.length, venceHoje: venceHoje.length,
      entreguesMes: entreguesMes.length, faturamentoMes: soma(entreguesMes, (o) => totaisOS(o).total),
      comissoesMes: soma(entreguesMes, (o) => o.comissaoPeca + o.comissaoServico),
      aReceber: soma(retirar, (o) => Math.max(0, totaisOS(o).saldo)), estoqueBaixo: baixo.length,
    },
    atrasadas: atrasadas.map(resumo).sort((a, b) => a.prazo.localeCompare(b.prazo)),
    venceHoje: venceHoje.map(resumo),
    prontas: retirar.map(resumo).sort((a, b) => (a.dataPronta || '').localeCompare(b.dataPronta || '')),
    estoqueBaixo: baixo.map((p) => ({ id: p.id, codigo: p.codigo, descricao: p.descricao, quantidade: p.quantidade, minimo: p.minimo, unidade: p.unidade })),
    porStatus, meses,
    contas: usuario.perfil === 'ADMIN' ? await resumoContas() : null,
  };
}

async function resumoContas() {
  const h = hoje();
  const daqui7 = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return isoDate(d); })();
  const abertas = await banco.contaPagar.findMany({ where: { pago: false }, orderBy: { vencimento: 'asc' } });
  const vencidas = abertas.filter((c) => c.vencimento < h);
  const proximas = abertas.filter((c) => c.vencimento >= h && c.vencimento <= daqui7);
  return {
    vencidas: vencidas.length, valorVencidas: soma(vencidas, (c) => c.valor),
    proximas: proximas.length, valorProximas: soma(proximas, (c) => c.valor),
    lista: [...vencidas, ...proximas].slice(0, 8).map((c) => ({ id: c.id, descricao: c.descricao, categoria: c.categoria, valor: c.valor, vencimento: c.vencimento })),
  };
}

// Receita por mes a partir das OS entregues (desconto rateado), para o simulador de impostos.
async function baseImpostos(usuario, query) {
  exigir(usuario, ['ADMIN']);
  const mes = /^\d{4}-\d{2}$/.test(query.mes || '') ? query.mes : hoje().slice(0, 7);
  const ordens = await lerOS({ status: 'Entregue' });
  const porMes = {};
  for (const o of ordens) {
    const k = mesDe(o.dataEntrega); if (!k) continue;
    const t = totaisOS(o); const f = t.bruto ? t.total / t.bruto : 0;
    porMes[k] ||= { servicos: 0, pecas: 0 };
    porMes[k].servicos += t.servicos * f; porMes[k].pecas += t.pecas * f;
  }
  const [y, m] = mes.split('-').map(Number);
  const meses12 = Array.from({ length: 12 }, (_, i) => isoDate(new Date(y, m - 2 - i, 1)).slice(0, 7));
  const r2 = (n) => Math.round(n * 100) / 100;
  const atual = porMes[mes] || { servicos: 0, pecas: 0 };
  return {
    mes, servicos: r2(atual.servicos), pecas: r2(atual.pecas),
    rbt12: r2(meses12.reduce((s, k) => s + (porMes[k] ? porMes[k].servicos + porMes[k].pecas : 0), 0)),
    meses12: meses12.map((k) => ({ mes: k, total: r2(porMes[k] ? porMes[k].servicos + porMes[k].pecas : 0) })),
  };
}

async function comissoes(usuario, query) {
  const { perfil, tecnicoId } = usuario;
  if (perfil === 'ATENDENTE') throw new HttpError(403, 'Seu perfil não tem acesso às comissões.');
  if (perfil === 'TECNICO' && !tecnicoId) throw new HttpError(403, 'Seu login não está ligado a um técnico.');
  const de = String(query.de || hoje().slice(0, 8) + '01');
  const ate = String(query.ate || hoje());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) throw falha('Período inválido.');
  const [ordens, tecnicos, clientes, aparelhos] = await Promise.all([
    lerOS({ status: 'Entregue', dataEntrega: { gte: de, lte: ate }, ...(perfil === 'TECNICO' ? { tecnicoId } : {}) }),
    banco.tecnico.findMany({ orderBy: { nome: 'asc' } }), banco.cliente.findMany(), banco.aparelho.findMany(),
  ]);
  const cli = Object.fromEntries(clientes.map((c) => [c.id, c.nome]));
  const apa = Object.fromEntries(aparelhos.map((a) => [a.id, `${a.marca} ${a.modelo}`]));
  // Meses (inteiros ou parciais) do periodo ate hoje, para o salario fixo.
  const meses = (() => { const fim = ate < hoje() ? ate : hoje(); if (fim < de) return 0; const [y1, m1] = de.split('-').map(Number); const [y2, m2] = fim.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1) + 1; })();
  const lista = tecnicos
    .filter((t) => (perfil === 'TECNICO' ? t.id === tecnicoId : t.ativo || ordens.some((o) => o.tecnicoId === t.id)))
    .map((t) => {
      const detalhes = ordens.filter((o) => o.tecnicoId === t.id).map((o) => {
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
  return { de, ate, meses, tecnicos: lista };
}
