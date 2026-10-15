// Consultas publicas e gratuitas para preencher cadastros.
// CNPJ: BrasilAPI (https://brasilapi.com.br/docs#tag/CNPJ); se falhar, tenta Minha Receita,
//       CNPJ.ws e CNPJa, nessa ordem (todas gratuitas e liberadas para o navegador).
// CEP:  ViaCEP (https://viacep.com.br), com a BrasilAPI como reserva.
// Sao servicos comunitarios, sem garantia: se todos falharem, o usuario preenche a mao.

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

// Cada servico devolve o CNPJ num formato; aqui todos viram o mesmo objeto.
const montarRua = (tipo, rua) => (tipo && rua && !String(rua).toUpperCase().startsWith(String(tipo).toUpperCase()) ? `${tipo} ${rua}` : rua);
const PROVEDORES_CNPJ = [
  {
    nome: 'BrasilAPI', url: (d) => `https://brasilapi.com.br/api/cnpj/v1/${d}`,
    ler: (c) => ({ razao: c.razao_social, fantasia: c.nome_fantasia, situacao: c.descricao_situacao_cadastral, rua: montarRua(c.descricao_tipo_de_logradouro, c.logradouro), numero: c.numero, complemento: c.complemento, bairro: c.bairro, cep: c.cep, cidade: c.municipio, uf: c.uf, telefone: c.ddd_telefone_1, email: c.email }),
  },
  {
    nome: 'Minha Receita', url: (d) => `https://minhareceita.org/${d}`,
    ler: (c) => ({ razao: c.razao_social, fantasia: c.nome_fantasia, situacao: c.descricao_situacao_cadastral, rua: montarRua(c.descricao_tipo_de_logradouro, c.logradouro), numero: c.numero, complemento: c.complemento, bairro: c.bairro, cep: c.cep, cidade: c.municipio, uf: c.uf, telefone: c.ddd_telefone_1, email: c.email }),
  },
  {
    nome: 'CNPJ.ws', url: (d) => `https://publica.cnpj.ws/cnpj/${d}`,
    ler: (c) => {
      const e = c.estabelecimento || {};
      return { razao: c.razao_social, fantasia: e.nome_fantasia, situacao: e.situacao_cadastral, rua: montarRua(e.tipo_logradouro, e.logradouro), numero: e.numero, complemento: e.complemento, bairro: e.bairro, cep: e.cep, cidade: e.cidade?.nome, uf: e.estado?.sigla, telefone: e.ddd1 && e.telefone1 ? e.ddd1 + e.telefone1 : '', email: e.email };
    },
  },
  {
    nome: 'CNPJá', url: (d) => `https://open.cnpja.com/office/${d}`,
    ler: (c) => {
      const a = c.address || {}, f = (c.phones || [])[0];
      return { razao: c.company?.name, fantasia: c.alias, situacao: c.status?.text, rua: a.street, numero: a.number, complemento: a.details, bairro: a.district, cep: a.zip, cidade: a.city, uf: a.state, telefone: f ? f.area + f.number : '', email: (c.emails || [])[0]?.address };
    },
  },
];

// Tenta os servicos em ordem. "Nao encontrado" de um servico basta; falha tecnica passa para o proximo.
async function buscarCnpjEmCadeia(d) {
  let naoEncontrado = 0, limite = false;
  for (const p of PROVEDORES_CNPJ) {
    try {
      const { status, corpo } = await buscarJson(p.url(d), 8);
      if (status === 200 && corpo) {
        const dados = p.ler(corpo);
        if (dados.razao) return { ...dados, fonte: p.nome };
      }
      if (status === 404) naoEncontrado++;
      if (status === 429) limite = true;
      if (naoEncontrado >= 2) break; // dois servicos confirmaram que o CNPJ nao existe
    } catch (e) {
      if (!navigator.onLine) throw e; // sem internet: nao adianta tentar os outros
    }
  }
  if (naoEncontrado) throw new Error('CNPJ não encontrado na Receita Federal. Confira os números.');
  if (limite) throw new Error('Os serviços gratuitos de CNPJ atingiram o limite de consultas agora. Aguarde um minuto e tente de novo, ou preencha à mão.');
  throw new Error('Os serviços de consulta de CNPJ estão fora do ar no momento. Tente de novo em alguns minutos ou preencha os dados à mão.');
}

// Retorna { patch, aviso, alerta } para mesclar no formulario do cliente.
export async function consultarCnpj(valor, form = {}) {
  const d = digitos(valor);
  if (d.length === 11) throw new Error('A busca funciona só com CNPJ. Para CPF não existe consulta pública: preencha os dados à mão.');
  if (d.length !== 14) throw new Error('Digite os 14 números do CNPJ para buscar.');
  if (!cnpjValido(d)) throw new Error('CNPJ inválido. Confira os números digitados.');
  const c = await buscarCnpjEmCadeia(d);

  const num = String(c.numero || '').trim();
  const rua = [titulo(c.rua), num && !/^S\/?N$/i.test(num) ? num : num ? 's/n' : ''].filter(Boolean).join(', ');
  const endereco = [rua, titulo(String(c.complemento || '').replace(/\s{2,}/g, ' ')), titulo(c.bairro)].filter(Boolean).join(' - ');
  const fantasia = c.fantasia && c.fantasia.trim() && c.fantasia.trim().toUpperCase() !== String(c.razao).toUpperCase() ? titulo(c.fantasia) : '';
  const patch = {
    documento: formatarCnpj(d),
    nome: titulo(c.razao),
    cep: c.cep ? formatarCep(c.cep) : form.cep,
    endereco: endereco || form.endereco,
    cidade: c.cidade ? titulo(c.cidade) : form.cidade,
    uf: c.uf || form.uf,
  };
  // Telefone e e-mail so entram se o campo estiver vazio (nao sobrescreve o contato que o atendente ja digitou).
  if (!form.telefone && c.telefone) patch.telefone = formatarFone(c.telefone);
  if (!form.email && c.email) patch.email = String(c.email).toLowerCase();
  if (fantasia && !(form.obs || '').includes(fantasia)) patch.obs = [`Nome fantasia: ${fantasia}`, form.obs].filter(Boolean).join('\n');
  const situacao = String(c.situacao || '').toUpperCase();
  const inativa = !!situacao && situacao !== 'ATIVA';
  const aviso = inativa
    ? `Dados preenchidos. Atenção: a situação deste CNPJ na Receita é "${titulo(situacao)}".`
    : `Dados de ${fantasia || titulo(c.razao)} preenchidos. Confira antes de salvar.`;
  return { patch, aviso, alerta: inativa, fonte: c.fonte };
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
