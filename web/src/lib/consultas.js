// Consultas publicas e gratuitas para preencher cadastros.
// CNPJ: BrasilAPI (https://brasilapi.com.br/docs#tag/CNPJ)
// CEP:  ViaCEP (https://viacep.com.br), com a BrasilAPI como reserva.
// Sao servicos comunitarios, sem garantia: em caso de falha o usuario preenche a mao.

const digitos = (s) => String(s || '').replace(/\D/g, '');
const titulo = (s) => String(s || '').toLowerCase().replace(/(^|\s|-|\/)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase())
  // Siglas societarias no fim do nome: S.A., ME, EPP, EIRELI e Ltda.
  .replace(/\s(Sa|S\.a\.?|S\/a)$/, ' S.A.').replace(/\s(Me|Epp|Eireli)$/, (w) => w.toUpperCase());
export const formatarCnpj = (c) => digitos(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
export const formatarCep = (c) => digitos(c).replace(/^(\d{5})(\d{3})$/, '$1-$2');
function formatarFone(f) {
  const d = digitos(f);
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  return f || '';
}

export function cnpjValido(c) {
  const d = digitos(c);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (base) => {
    let soma = 0, peso = base.length - 7;
    for (const n of base) { soma += Number(n) * peso--; if (peso < 2) peso = 9; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

async function buscarJson(url, segundos = 10) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), segundos * 1000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    const corpo = await r.json().catch(() => null);
    return { status: r.status, corpo };
  } catch (e) {
    if (!navigator.onLine) throw new Error('Sem internet. Preencha os dados à mão ou tente de novo quando estiver conectado.');
    throw new Error(e.name === 'AbortError' ? 'O serviço de consulta demorou para responder. Tente de novo em instantes.' : 'Não foi possível acessar o serviço de consulta. Tente de novo em instantes.');
  } finally {
    clearTimeout(t);
  }
}

// Retorna { patch, aviso, focar } para mesclar no formulario do cliente.
export async function consultarCnpj(valor, form = {}) {
  const d = digitos(valor);
  if (d.length === 11) throw new Error('A busca funciona só com CNPJ. Para CPF não existe consulta pública: preencha os dados à mão.');
  if (d.length !== 14) throw new Error('Digite os 14 números do CNPJ para buscar.');
  if (!cnpjValido(d)) throw new Error('CNPJ inválido. Confira os números digitados.');
  const { status, corpo } = await buscarJson(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
  if (status === 404) throw new Error('CNPJ não encontrado na Receita Federal.');
  if (status === 429) throw new Error('Muitas consultas seguidas no serviço gratuito. Aguarde um minuto e tente de novo.');
  if (status === 403) throw new Error('O serviço de CNPJ recusou a consulta agora. Tente de novo em instantes ou preencha à mão.');
  if (status !== 200 || !corpo) throw new Error(corpo?.message || 'O serviço de CNPJ não respondeu. Tente de novo em instantes.');

  const c = corpo;
  const rua = [titulo(c.descricao_tipo_de_logradouro ? `${c.descricao_tipo_de_logradouro} ${c.logradouro}` : c.logradouro), c.numero && c.numero !== 'S/N' ? c.numero : c.numero === 'S/N' ? 's/n' : ''].filter(Boolean).join(', ');
  const endereco = [rua, titulo(c.complemento), titulo(c.bairro)].filter(Boolean).join(' - ');
  const fantasia = c.nome_fantasia && c.nome_fantasia.trim() && c.nome_fantasia.trim().toUpperCase() !== String(c.razao_social).toUpperCase() ? titulo(c.nome_fantasia) : '';
  const patch = {
    documento: formatarCnpj(d),
    nome: titulo(c.razao_social),
    cep: c.cep ? formatarCep(c.cep) : form.cep,
    endereco: endereco || form.endereco,
    cidade: c.municipio ? titulo(c.municipio) : form.cidade,
    uf: c.uf || form.uf,
  };
  // Telefone e e-mail so entram se o campo estiver vazio (nao sobrescreve o contato que o atendente ja digitou).
  if (!form.telefone && c.ddd_telefone_1) patch.telefone = formatarFone(c.ddd_telefone_1);
  if (!form.email && c.email) patch.email = String(c.email).toLowerCase();
  if (fantasia && !(form.obs || '').includes(fantasia)) patch.obs = [`Nome fantasia: ${fantasia}`, form.obs].filter(Boolean).join('\n');
  const situacao = String(c.descricao_situacao_cadastral || '').toUpperCase();
  const aviso = situacao && situacao !== 'ATIVA'
    ? `Dados preenchidos. Atenção: a situação deste CNPJ na Receita é "${titulo(situacao)}".`
    : `Dados de ${fantasia || titulo(c.razao_social)} preenchidos. Confira antes de salvar.`;
  return { patch, aviso, alerta: !!situacao && situacao !== 'ATIVA' };
}

export async function consultarCep(valor, form = {}) {
  const d = digitos(valor);
  if (d.length !== 8) throw new Error('Digite os 8 números do CEP para buscar.');
  let end = null;
  try {
    const { status, corpo } = await buscarJson(`https://viacep.com.br/ws/${d}/json/`, 8);
    if (status === 200 && corpo && !corpo.erro) end = { rua: corpo.logradouro, complemento: corpo.complemento, bairro: corpo.bairro, cidade: corpo.localidade, uf: corpo.uf };
    else if (status === 200 && corpo?.erro) end = 'nao-existe';
  } catch { /* tenta a reserva */ }
  if (!end) {
    const { status, corpo } = await buscarJson(`https://brasilapi.com.br/api/cep/v1/${d}`, 8);
    if (status === 200 && corpo) end = { rua: corpo.street, bairro: corpo.neighborhood, cidade: corpo.city, uf: corpo.state };
    else if (status === 404) end = 'nao-existe';
    else throw new Error('O serviço de CEP não respondeu. Preencha o endereço à mão ou tente de novo.');
  }
  if (end === 'nao-existe') throw new Error('CEP não encontrado. Confira os números digitados.');
  const endereco = [end.rua ? `${end.rua}, ` : '', end.bairro ? ` - ${end.bairro}` : ''].join('').replace(/^, /, '').trim();
  return {
    patch: { cep: formatarCep(d), endereco: endereco || form.endereco, cidade: end.cidade || form.cidade, uf: end.uf || form.uf },
    aviso: end.rua ? 'Endereço preenchido. Complete com o número.' : 'Cidade preenchida. Este CEP não tem rua: complete o endereço.',
    focar: 'endereco',
    // Posiciona o cursor logo depois de "Rua X, " para digitar o numero.
    cursor: end.rua ? `${end.rua}, `.length : null,
  };
}
