// Dados de exemplo (mockados) carregados na primeira vez que o sistema abre no navegador.
import { isoDate, isoDateTime, calcularComissao } from '@tecnitium/shared';
import { banco as prisma, hashSenha } from './banco.js';
import { apagarTodasFotos } from './fotos.js';

const D = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return isoDate(d); };
const DT = (dias, hora) => { const d = new Date(); d.setDate(d.getDate() + dias); const [h, m] = hora.split(':'); d.setHours(+h, +m, 0, 0); return isoDateTime(d); };

const TERMOS = `1. O orçamento é gratuito. Aparelhos não retirados em até 90 dias após o aviso de conclusão poderão ser descartados ou vendidos para cobrir custos (art. 1.275 do Código Civil).
2. A garantia cobre somente o serviço executado e as peças trocadas, pelo prazo indicado nesta OS, e não cobre quedas, umidade ou violação do lacre.
3. A empresa não se responsabiliza por dados armazenados no aparelho. Faça backup antes de deixar o equipamento.
4. A retirada só será feita mediante apresentação desta OS ou documento do titular.`;

async function base() {
  await prisma.configuracao.upsert({ where: { id: 1 }, update: {}, create: { id: 1, nomeEmpresa: 'Tecnitium Assistência Técnica', termos: TERMOS } });
}

async function usuarios(vinculos = {}) {
  const senhaPara = (email) => hashSenha(email, 'tecnitium');
  const lista = [
    { nome: 'Administrador', email: 'admin@tecnitium.com.br', perfil: 'ADMIN' },
    { nome: 'Bianca Souza', email: 'atendimento@tecnitium.com.br', perfil: 'ATENDENTE', atendenteId: vinculos.atendenteId || null },
    ...(vinculos.tecnicoId ? [{ nome: 'Diego Ramos', email: 'tecnico@tecnitium.com.br', perfil: 'TECNICO', tecnicoId: vinculos.tecnicoId }] : []),
  ];
  for (const u of lista) await prisma.usuario.upsert({ where: { email: u.email }, update: { tecnicoId: u.tecnicoId, atendenteId: u.atendenteId }, create: { ...u, senhaHash: await senhaPara(u.email) } });
}

async function exemplos() {
  await apagarTodasFotos();
  for (const m of ['movEstoque', 'ordemServico', 'peca', 'aparelho', 'cliente', 'tecnico', 'atendente']) await prisma[m].deleteMany();
  await prisma.configuracao.update({ where: { id: 1 }, data: { nomeEmpresa: 'Tecnitium Assistência Técnica', documento: '12.345.678/0001-90', telefone: '(11) 3333-4455', whatsapp: '(11) 98888-7766', endereco: 'Rua Vergueiro, 1200 - Liberdade, São Paulo/SP', termos: TERMOS } });

  const t = {
    diego: await prisma.tecnico.create({ data: { nome: 'Diego Ramos', cpf: '321.654.987-01', telefone: '(11) 97777-1001', especialidade: 'Celulares e tablets (micro solda)', regime: 'Comissão', percPeca: 10, percServico: 40 } }),
    lucas: await prisma.tecnico.create({ data: { nome: 'Lucas Andrade', cpf: '456.123.789-02', telefone: '(11) 97777-1002', especialidade: 'Notebooks e computadores', regime: 'Salário fixo', salario: 2800, percPeca: 5, percServico: 0 } }),
    paulo: await prisma.tecnico.create({ data: { nome: 'Paulo Henrique Costa', cpf: '789.456.123-03', telefone: '(11) 97777-1003', especialidade: 'TVs, monitores e videogames', regime: 'Comissão', percPeca: 8, percServico: 35 } }),
  };
  const at = {
    bianca: await prisma.atendente.create({ data: { nome: 'Bianca Souza', telefone: '(11) 96666-2001' } }),
    mariana: await prisma.atendente.create({ data: { nome: 'Mariana Lopes', telefone: '(11) 96666-2002' } }),
  };

  const clientes = {};
  for (const [k, d] of Object.entries({
    ana: { nome: 'Ana Carolina Prado', documento: '123.456.789-10', whatsapp: '(11) 99123-4501', email: 'ana.prado@email.com', cidade: 'São Paulo', uf: 'SP' },
    bruno: { nome: 'Bruno Tavares', documento: '234.567.891-20', whatsapp: '(11) 99123-4502', cidade: 'São Paulo', uf: 'SP' },
    carla: { nome: 'Carla Menezes', documento: '345.678.912-30', whatsapp: '(11) 99123-4503', telefone: '(11) 3456-7788', cidade: 'Santo André', uf: 'SP' },
    escola: { nome: 'Colégio Horizonte Ltda', documento: '33.444.555/0001-66', telefone: '(11) 3456-9900', whatsapp: '(11) 99123-4504', email: 'ti@colegiohorizonte.com.br', endereco: 'Av. Paulista, 900', cidade: 'São Paulo', uf: 'SP' },
    fernando: { nome: 'Fernando Oliveira', documento: '456.789.123-40', whatsapp: '(11) 99123-4505', cidade: 'Guarulhos', uf: 'SP' },
    gabriela: { nome: 'Gabriela Nunes', documento: '567.891.234-50', whatsapp: '(11) 99123-4506', cidade: 'São Paulo', uf: 'SP' },
    henrique: { nome: 'Henrique Batista', documento: '678.912.345-60', whatsapp: '(11) 99123-4507', cidade: 'Osasco', uf: 'SP' },
    julia: { nome: 'Júlia Ferraz', documento: '789.123.456-70', whatsapp: '(11) 99123-4508', cidade: 'São Paulo', uf: 'SP' },
  })) clientes[k] = await prisma.cliente.create({ data: d });

  const ap = {};
  for (const [k, c, d] of [
    ['a1', 'ana', { tipo: 'Celular', marca: 'Apple', modelo: 'iPhone 13', serie: '356789104512345', cor: 'Azul', senha: '1590', acessorios: 'Capa' }],
    ['a2', 'bruno', { tipo: 'Celular', marca: 'Samsung', modelo: 'Galaxy S22', serie: '351234567890123', cor: 'Preto', senha: 'Padrão em L' }],
    ['a3', 'carla', { tipo: 'Notebook', marca: 'Dell', modelo: 'Inspiron 15 3520', serie: 'CN-0X1234', cor: 'Prata', acessorios: 'Carregador original' }],
    ['a4', 'escola', { tipo: 'Notebook', marca: 'Lenovo', modelo: 'IdeaPad 3', serie: 'PF3ABC12', cor: 'Cinza', acessorios: 'Carregador' }],
    ['a5', 'escola', { tipo: 'Monitor', marca: 'LG', modelo: '24MK430H', serie: '209NTXR1234' }],
    ['a6', 'fernando', { tipo: 'Videogame', marca: 'Sony', modelo: 'PlayStation 5', serie: 'E123456789', acessorios: '1 controle' }],
    ['a7', 'gabriela', { tipo: 'Celular', marca: 'Motorola', modelo: 'Moto G84', serie: '359876543210987', cor: 'Grafite', senha: '2468' }],
    ['a8', 'henrique', { tipo: 'TV', marca: 'Samsung', modelo: 'UN50AU7700', serie: '0B3K3CAR500123' }],
    ['a9', 'julia', { tipo: 'Tablet', marca: 'Apple', modelo: 'iPad 9ª geração', serie: 'DMPXK2ABC', cor: 'Cinza espacial' }],
    ['a10', 'ana', { tipo: 'Smartwatch', marca: 'Apple', modelo: 'Watch SE 44mm', serie: 'GY7XL1234' }],
    ['a11', 'bruno', { tipo: 'Notebook', marca: 'Acer', modelo: 'Aspire 5', serie: 'NXABC123', acessorios: 'Sem carregador' }],
    ['a12', 'gabriela', { tipo: 'Fone / caixa de som', marca: 'JBL', modelo: 'Flip 6', serie: 'JBL6F123' }],
  ]) ap[k] = await prisma.aparelho.create({ data: { clienteId: clientes[c].id, ...d } });

  // Estoque: [codigo, descricao, categoria, compat, saldo final, minimo, custo, preco, local]
  const pc = {};
  for (const [codigo, descricao, categoria, compatibilidade, qtd, minimo, custo, preco, localizacao] of [
    ['TEL-IP13', 'Tela iPhone 13 (OLED)', 'Telas', 'iPhone 13', 2, 2, 520, 890, 'Gaveta A1'],
    ['TEL-S22', 'Tela Galaxy S22 com aro', 'Telas', 'Galaxy S22', 1, 1, 610, 1050, 'Gaveta A2'],
    ['TEL-G84', 'Tela Moto G84', 'Telas', 'Moto G84', 0, 1, 210, 420, 'Gaveta A3'],
    ['BAT-IP13', 'Bateria iPhone 13', 'Baterias', 'iPhone 13', 4, 2, 120, 260, 'Gaveta B1'],
    ['BAT-G84', 'Bateria Moto G84', 'Baterias', 'Moto G84', 3, 2, 75, 180, 'Gaveta B2'],
    ['CON-USBC', 'Conector de carga USB-C (placa)', 'Conectores', 'Samsung / Motorola', 6, 4, 18, 90, 'Gaveta C1'],
    ['CON-LIGHT', 'Flex conector Lightning', 'Conectores', 'iPhone 11 a 13', 1, 3, 45, 150, 'Gaveta C2'],
    ['SSD-480', 'SSD SATA 480 GB', 'Armazenamento', 'Notebooks e desktops', 5, 2, 160, 290, 'Prateleira 2'],
    ['MEM-8DDR4', 'Memória 8 GB DDR4 SODIMM', 'Memória', 'Notebooks', 3, 2, 110, 210, 'Prateleira 2'],
    ['TECL-DELL', 'Teclado Dell Inspiron 15 3000', 'Teclados', 'Inspiron 15 3000/3500', 2, 1, 95, 220, 'Prateleira 3'],
    ['PAS-TERM', 'Pasta térmica prata (seringa)', 'Insumos', 'Universal', 8, 3, 12, 0, 'Bancada'],
    ['HDMI-PS5', 'Conector HDMI PS5', 'Conectores', 'PlayStation 5', 2, 2, 38, 160, 'Gaveta C3'],
    ['LED-UN50', 'Kit barras de LED TV 50"', 'TV', 'Samsung 50" AU7700', 1, 1, 180, 390, 'Prateleira 4'],
    ['FONTE-LG24', 'Placa fonte monitor LG 24"', 'Placas', 'LG 24MK430H', 1, 1, 140, 280, 'Prateleira 4'],
  ]) pc[codigo] = await prisma.peca.create({ data: { codigo, descricao, categoria, compatibilidade, quantidade: qtd, minimo, custo, preco, localizacao } });

  const P = (codigo, qtd = 1) => ({ tipo: 'Peça', pecaId: pc[codigo].id, desc: pc[codigo].descricao, qtd, valor: pc[codigo].preco, custo: pc[codigo].custo });
  const S = (desc, valor, qtd = 1) => ({ tipo: 'Serviço', desc, qtd, valor });

  const ordens = [
    // entregues em meses anteriores (comissoes e faturamento)
    { ap: 'a1', at: 'bianca', tec: 'diego', entrada: DT(-150, '10:12'), prazo: D(-147), status: 'Entregue', defeito: 'Bateria descarregando rápido', diagnostico: 'Saúde da bateria em 71%', servicoExecutado: 'Troca de bateria', itens: [P('BAT-IP13'), S('Mão de obra troca de bateria', 90)], dataPronta: D(-148), dataEntrega: D(-147), valorPago: 350, formaPagamento: 'Pix' },
    { ap: 'a3', at: 'mariana', tec: 'lucas', entrada: DT(-120, '14:30'), prazo: D(-115), status: 'Entregue', defeito: 'Notebook muito lento', diagnostico: 'HD mecânico com setores defeituosos', servicoExecutado: 'Troca do HD por SSD, instalação do sistema e backup', itens: [P('SSD-480'), S('Instalação de sistema e backup', 150)], dataPronta: D(-116), dataEntrega: D(-114), valorPago: 440, formaPagamento: 'Cartão de crédito' },
    { ap: 'a6', at: 'bianca', tec: 'paulo', entrada: DT(-95, '09:40'), prazo: D(-88), status: 'Entregue', defeito: 'Sem imagem na TV', diagnostico: 'Conector HDMI com pinos danificados', servicoExecutado: 'Troca do conector HDMI com micro solda', itens: [P('HDMI-PS5'), S('Micro solda conector HDMI', 220)], dataPronta: D(-90), dataEntrega: D(-89), valorPago: 380, formaPagamento: 'Pix' },
    { ap: 'a4', at: 'mariana', tec: 'lucas', entrada: DT(-70, '11:05'), prazo: D(-66), status: 'Entregue', defeito: 'Superaquecendo e desligando', diagnostico: 'Cooler obstruído e pasta térmica ressecada', servicoExecutado: 'Limpeza interna e troca de pasta térmica, upgrade de memória', itens: [P('PAS-TERM'), P('MEM-8DDR4'), S('Limpeza interna completa', 120)], dataPronta: D(-67), dataEntrega: D(-65), valorPago: 330, formaPagamento: 'Boleto' },
    { ap: 'a2', at: 'bianca', tec: 'diego', entrada: DT(-45, '16:20'), prazo: D(-42), status: 'Entregue', defeito: 'Não carrega', diagnostico: 'Conector de carga oxidado', servicoExecutado: 'Troca do conector de carga', itens: [P('CON-USBC'), S('Mão de obra', 110)], desconto: 20, dataPronta: D(-43), dataEntrega: D(-41), valorPago: 180, formaPagamento: 'Dinheiro' },
    { ap: 'a12', at: 'mariana', tec: 'paulo', entrada: DT(-30, '13:00'), prazo: D(-25), status: 'Entregue', defeito: 'Não liga', diagnostico: 'Placa com curto no circuito de carga', servicoExecutado: 'Reparo em placa (micro solda)', itens: [S('Reparo em placa', 180)], dataPronta: D(-26), dataEntrega: D(-24), valorPago: 180, formaPagamento: 'Pix' },
    // entregues este mes
    { ap: 'a9', at: 'bianca', tec: 'diego', entrada: DT(-12, '10:00'), prazo: D(-9), status: 'Entregue', defeito: 'Vidro trincado', diagnostico: 'Touch funcionando, apenas vidro', servicoExecutado: 'Troca de vidro com laminação', itens: [S('Troca de vidro iPad (laminação)', 380)], dataPronta: D(-9), dataEntrega: D(-8), valorPago: 380, formaPagamento: 'Cartão de débito' },
    { ap: 'a11', at: 'mariana', tec: 'lucas', entrada: DT(-10, '15:15'), prazo: D(-6), status: 'Entregue', defeito: 'Formatação e lentidão', diagnostico: 'Sistema corrompido', servicoExecutado: 'Instalação de SSD e sistema', itens: [P('SSD-480'), S('Instalação de sistema', 120)], dataPronta: D(-7), dataEntrega: D(-5), valorPago: 410, formaPagamento: 'Pix' },
    // prontas aguardando retirada (uma ha mais de 30 dias)
    { ap: 'a5', at: 'mariana', tec: 'paulo', entrada: DT(-48, '09:30'), prazo: D(-41), status: 'Pronta', defeito: 'Monitor não liga', diagnostico: 'Placa fonte queimada', servicoExecutado: 'Troca da placa fonte', itens: [P('FONTE-LG24'), S('Mão de obra', 90)], dataPronta: D(-36), valorPago: 0 },
    { ap: 'a10', at: 'bianca', tec: 'diego', entrada: DT(-6, '11:45'), prazo: D(-2), status: 'Pronta', defeito: 'Não segura carga', diagnostico: 'Bateria estufada', servicoExecutado: 'Troca de bateria', itens: [S('Troca de bateria Apple Watch', 280)], dataPronta: D(-1), valorPago: 100, formaPagamento: 'Pix' },
    { ap: 'a8', at: 'mariana', tec: 'paulo', entrada: DT(-9, '17:10'), prazo: D(-3), status: 'Sem conserto', defeito: 'Tela com manchas', diagnostico: 'Painel LCD danificado; peça custa mais que uma TV nova', servicoExecutado: 'Devolução sem reparo, cobrada apenas a avaliação', itens: [S('Avaliação técnica', 60)], dataPronta: D(-2) },
    // em bancada: atrasadas, vence hoje, no prazo
    { ap: 'a7', at: 'bianca', tec: 'diego', entrada: DT(-5, '10:20'), prazo: D(-1), status: 'Aguardando peça', prioridade: 'Urgente', defeito: 'Tela quebrada após queda', diagnostico: 'Tela e touch danificados; peça fora de estoque', itens: [S('Mão de obra troca de tela', 120)], valorPago: 100, formaPagamento: 'Pix', obs: 'Cliente autorizou o orçamento por WhatsApp.' },
    { ap: 'a3', at: 'mariana', tec: 'lucas', entrada: DT(-4, '14:00'), prazo: D(-2), status: 'Em reparo', defeito: 'Teclado com teclas falhando', diagnostico: 'Teclado com líquido', itens: [P('TECL-DELL'), S('Troca de teclado', 100)] },
    { ap: 'a1', at: 'bianca', tec: 'diego', entrada: DT(-2, '09:15'), prazo: D(0), status: 'Em reparo', defeito: 'Não carrega no cabo', diagnostico: 'Flex do conector Lightning danificado', itens: [P('CON-LIGHT'), S('Mão de obra', 100)] },
    { ap: 'a2', at: 'mariana', tec: 'diego', entrada: DT(-1, '18:00'), prazo: D(2), status: 'Aguardando aprovação', defeito: 'Tela piscando', diagnostico: 'Tela OLED com defeito', itens: [P('TEL-S22'), S('Mão de obra troca de tela', 150)], obs: 'Orçamento enviado ao cliente por WhatsApp.' },
    { ap: 'a6', at: 'bianca', tec: null, entrada: DT(0, '10:30'), prazo: D(4), status: 'Aberta', defeito: 'Desliga sozinho durante os jogos', estado: 'Riscos na lateral', itens: [] },
    { ap: 'a4', at: 'mariana', tec: 'lucas', entrada: DT(0, '11:50'), prazo: D(3), status: 'Em análise', defeito: 'Wi-Fi não conecta', estado: 'Sem avarias aparentes', acessorios: 'Carregador', itens: [] },
  ];

  const usado = {};
  let n = 0;
  for (const o of ordens) {
    n++;
    const tec = o.tec ? t[o.tec] : null;
    const os = {
      numero: n, clienteId: (await prisma.aparelho.findUnique({ where: { id: ap[o.ap].id } })).clienteId, aparelhoId: ap[o.ap].id, atendenteId: at[o.at].id, tecnicoId: tec?.id || null,
      entrada: o.entrada, prazo: o.prazo, prioridade: o.prioridade || 'Normal', status: o.status, defeito: o.defeito, estado: o.estado || null, acessorios: o.acessorios || null,
      diagnostico: o.diagnostico || null, servicoExecutado: o.servicoExecutado || null, itens: o.itens, desconto: o.desconto || 0, valorPago: o.valorPago || 0,
      formaPagamento: o.formaPagamento || null, garantiaDias: 90, dataPronta: o.dataPronta || null, dataEntrega: o.dataEntrega || null, retiradoPor: o.dataEntrega ? 'O próprio cliente' : null, obs: o.obs || null,
    };
    if (o.status === 'Entregue') {
      const ref = { regime: tec.regime, percPeca: tec.percPeca, percServico: tec.percServico };
      const c = calcularComissao(os, ref, 'Venda');
      Object.assign(os, ref, { comissaoPeca: c.peca, comissaoServico: c.servico });
    }
    // Historico plausivel das mudancas de situacao, para a linha do tempo do portal.
    const dia = (dt, n, hora) => { const x = new Date(dt.slice(0, 10) + 'T12:00'); x.setDate(x.getDate() + n); return isoDate(x) + 'T' + hora; };
    const hist = [{ status: 'Aberta', data: os.entrada }];
    if (os.status !== 'Aberta') hist.push({ status: ['Aguardando peça', 'Aguardando aprovação', 'Em análise'].includes(os.status) ? os.status : 'Em reparo', data: dia(os.entrada, 1, '09:30') });
    if (os.dataPronta) hist.push({ status: os.status === 'Sem conserto' ? 'Sem conserto' : 'Pronta', data: os.dataPronta + 'T16:40' });
    if (os.dataEntrega) hist.push({ status: 'Entregue', data: os.dataEntrega + 'T11:15' });
    const criada = await prisma.ordemServico.create({ data: { ...os, itens: JSON.stringify(os.itens), historico: JSON.stringify(hist) } });
    for (const i of o.itens.filter((x) => x.tipo === 'Peça')) {
      usado[i.pecaId] = (usado[i.pecaId] || 0) + i.qtd;
      await prisma.movEstoque.create({ data: { pecaId: i.pecaId, data: o.entrada, tipo: 'Saída OS', quantidade: -i.qtd, custoUnit: i.custo, origem: `OS ${String(n).padStart(5, '0')}`, osId: criada.id, automatico: true } });
    }
  }
  // Entradas de compra que explicam o saldo atual.
  for (const p of Object.values(pc)) {
    const total = p.quantidade + (usado[p.id] || 0);
    if (total > 0) await prisma.movEstoque.create({ data: { pecaId: p.id, data: DT(-160, '08:30'), tipo: 'Entrada', quantidade: total, custoUnit: p.custo, origem: 'NF 4521 - Distribuidora Cell Parts', automatico: false } });
  }
  return { tecnicoId: t.diego.id, atendenteId: at.bianca.id };
}

// demo = true: configuracao, usuarios e exemplos. demo = false: so configuracao e usuarios.
export async function carregarExemplos(demo = true) {
  await base();
  const vinc = demo ? await exemplos() : {};
  await usuarios(vinc);
}
