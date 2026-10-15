// Funcao da Vercel (/api/email): unica parte do Tecnitium que roda fora do navegador.
// O navegador nao consegue falar SMTP; esta funcao recebe os dados do SMTP configurado
// pelo administrador (ex.: Gmail com senha de app) e entrega a mensagem. Nao guarda nada.
const nodemailer = require('nodemailer');

const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

function traduzirErro(e) {
  const c = e?.code || '';
  if (c === 'EAUTH' || /Invalid login|Username and Password not accepted|535/i.test(e?.message || '')) {
    return 'O Gmail recusou o login. Use uma senha de app (Conta Google → Segurança → Verificação em duas etapas → Senhas de app), não a senha normal da conta.';
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'EDNS'].includes(c)) return 'Não foi possível conectar ao servidor SMTP. Confira o endereço e a porta (Gmail: smtp.gmail.com, porta 465).';
  if (c === 'EENVELOPE') return 'O destinatário foi recusado pelo servidor de e-mail. Confira o endereço.';
  return 'O servidor de e-mail recusou o envio. Confira a configuração do SMTP.';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });
  // So aceita chamadas do proprio site.
  const origem = req.headers.origin;
  if (origem) {
    try { if (new URL(origem).host !== req.headers.host) return res.status(403).json({ erro: 'Origem não permitida.' }); }
    catch { return res.status(403).json({ erro: 'Origem não permitida.' }); }
  }
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const s = b.smtp || {};
  const porta = Number(s.porta);
  if (!s.host || ![465, 587].includes(porta)) return res.status(422).json({ erro: 'Servidor ou porta do SMTP inválidos (use 465 ou 587).' });
  if (!emailValido(s.usuario) || !s.senha) return res.status(422).json({ erro: 'Informe o e-mail e a senha de app do SMTP.' });
  if (!emailValido(b.para)) return res.status(422).json({ erro: 'E-mail do destinatário inválido.' });
  if (!b.assunto || String(b.assunto).length > 200 || String(b.texto || '').length > 20000) return res.status(422).json({ erro: 'Mensagem inválida.' });

  const transporte = nodemailer.createTransport({
    host: String(s.host), port: porta, secure: porta === 465,
    auth: { user: String(s.usuario), pass: String(s.senha).replace(/\s+/g, '') },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  try {
    await transporte.sendMail({
      from: { name: String(s.remetente || 'Tecnitium').slice(0, 80), address: String(s.usuario) },
      to: String(b.para), subject: String(b.assunto), text: String(b.texto || ''), html: b.html ? String(b.html) : undefined,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ erro: traduzirErro(e), codigo: e?.code || null });
  }
};
