# Tecnitium

Sistema para assistência técnica: ordens de serviço com fotos, clientes, aparelhos, técnicos, atendentes, estoque de peças, alertas de prazo e de retirada, e comissão dos técnicos.

**Versão atual: só front-end.** Não há servidor nem banco externo. Tudo roda no navegador:

- cadastros, OS, estoque e configuração ficam no `localStorage`;
- as fotos das OS ficam no IndexedDB do navegador (cabe bem mais que o `localStorage`);
- na primeira abertura o sistema já vem com **dados de exemplo** (clientes, técnicos, peças e 17 OS em todas as situações).

Cada navegador tem os seus próprios dados. Em **Configurações → Dados deste navegador** dá para baixar e restaurar um backup (JSON, sem as fotos), recarregar os exemplos ou começar do zero.

Tecnologias: React 18, Vite, React Router, TanStack Query e Recharts.

## Portal do cliente

Na tela de login, a aba **Sou cliente** pede o **CPF ou CNPJ** do cliente como login e como senha (só os números contam). O cliente precisa ter o CPF/CNPJ no cadastro; a lista de clientes mostra quem está liberado. A OS impressa e a mensagem de WhatsApp de aparelho pronto explicam como entrar. O link `/?cliente` já abre nessa aba.

O cliente vê somente:

- a **linha do tempo** de cada OS: recebido → em manutenção → concluído → retirado, com datas e o que está acontecendo agora (ex.: aguardando peça, aguardando aprovação);
- as **fotos do aparelho na entrada** (com as marcações de defeito feitas pela equipe);
- a **OS completa** de cada serviço, para ver, imprimir ou salvar em PDF.

Custos das peças, comissões, observações internas e a senha do aparelho não aparecem para o cliente. Exemplo para testar: `12345678910` no login e na senha (Ana Carolina Prado).

Como o CPF/CNPJ não é segredo, quem souber o documento de um cliente consegue ver as OS dele. Para mais segurança no futuro, dá para trocar a senha por uma escolhida pelo cliente.

**Atenção nesta versão sem servidor:** os dados ficam no navegador da loja. O portal funciona no mesmo aparelho (ex.: tablet no balcão). Para o cliente acompanhar do próprio celular, é preciso voltar a ter um back-end (as rotas `/portal` já estão separadas em `web/src/local/servidor.js`).

## Financeiro (somente administrador)

- **Contas a pagar:** descrição, categoria (aluguel, energia, fornecedor de peças, impostos, contador...), favorecido, valor, vencimento, nº do documento e pagamento (data e forma). Contas com repetição **mensal** criam a do mês seguinte quando são pagas. Totais de vencidas, próximos 7 dias, em aberto e pago no mês; o painel do administrador mostra as vencidas e as que vencem na semana.
- **Simulador de impostos:** compara **MEI**, **Simples Nacional** e **Lucro Presumido** para o mês. Mão de obra entra no Simples pelo Anexo III (reparo e manutenção) e peças pelo Anexo I (comércio), com a faixa definida pela receita dos últimos 12 meses (RBT12). "Usar dados do sistema" puxa a receita das OS entregues no mês e dos 12 meses anteriores. Mostra o detalhamento de cada imposto, aponta o menor e lança o DAS em contas a pagar (vencimento dia 20 do mês seguinte). É uma estimativa: confirme com o contador.

## Busca de CNPJ e CEP no cadastro do cliente

A lupa ao lado do **CPF/CNPJ** e do **CEP** (ou Enter no campo) preenche o cadastro com serviços públicos e gratuitos, chamados direto do navegador:

- **CNPJ:** BrasilAPI → Minha Receita → CNPJ.ws → CNPJá. Se um serviço estiver fora do ar ou no limite, o sistema tenta o próximo sozinho. Preenche razão social, endereço, CEP, cidade, UF, telefone e e-mail (estes dois só se estiverem vazios) e avisa quando o CNPJ não está ativo.
- **CEP:** ViaCEP, com a BrasilAPI de reserva. Preenche rua, bairro, cidade e UF e deixa o cursor no lugar do número.

CPF não tem consulta pública. Se todos os serviços falharem, aparece uma mensagem e o atendente preenche à mão (código em `web/src/lib/consultas.js`).

## Vídeos na OS

Ao lado de "Adicionar foto", o botão **Gravar vídeo** abre a câmera de vídeo no celular (ou escolhe um arquivo no computador). O vídeo é guardado do jeito que foi gravado, no banco do próprio navegador (IndexedDB), com limite de 150 MB por vídeo (uns 2 minutos). Vídeos de **entrada** aparecem para o cliente no portal; na OS impressa sai uma nota com a quantidade de vídeos. Os vídeos não entram no backup em JSON.

## Fotos com marcação de defeitos

Ao tirar uma foto na OS, abre um editor para desenhar sobre ela: caneta livre, círculo e seta, quatro cores, três espessuras, desfazer e limpar (dedo, caneta ou mouse). Qualquer foto pode ser marcada depois pelo botão ✎. Fotos tiradas enquanto a OS está **Aberta** ou **Em análise** ficam como **Entrada** (o cliente vê); depois disso, ficam como **Reparo** (só a equipe vê).

## No celular: funciona como aplicativo

- **Instalável (PWA):** no Android/Chrome aparece o botão **Instalar** (barra superior e menu **Mais**); no iPhone, Safari → Compartilhar → **Adicionar à Tela de Início**. Abre em tela cheia, com ícone próprio e atalhos (Nova OS, Ordens de serviço, Estoque) ao segurar o ícone.
- **Funciona sem internet:** o service worker (`web/public/sw.js`) guarda o app no aparelho e os dados já estão no navegador.
- **Navegação de aplicativo:** abas inferiores (Painel, OS, **Nova OS**, Clientes, Mais), listas em cartões, formulários em tela cheia com o botão de salvar sempre visível, câmera para as fotos e respeito ao entalhe e à barra do sistema.

Para publicar uma versão nova do app instalado, altere `VERSAO` em `web/public/sw.js`; o app atualiza sozinho na próxima abertura.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5174
```

No Windows, dê dois cliques em `iniciar.bat`.

Acessos (senha `tecnitium`):

| E-mail | Perfil | Pode |
|---|---|---|
| admin@tecnitium.com.br | Administrador | tudo: equipe, comissões, usuários, configurações, backup, excluir OS |
| atendimento@tecnitium.com.br | Atendente | abrir e atualizar OS, clientes, aparelhos, estoque e fotos |
| tecnico@tecnitium.com.br | Técnico | atualizar OS (diagnóstico, peças, situação), ver só as próprias comissões |

O login separa o que cada perfil vê. Como os dados estão no próprio navegador, ele não é uma proteção de segurança: serve para demonstração e uso em um único computador.

## Deploy na Vercel

O `vercel.json` já define tudo: `npm ci`, `npm run build` e o redirecionamento das rotas para o `index.html`. O build gera a interface em `web/dist` e copia para `dist/` na raiz, que é a pasta publicada (o padrão da Vercel para Vite). Basta importar o repositório na Vercel, com a raiz do repositório como Root Directory.

O `.npmrc` fixa o registro público do npm (`registry.npmjs.org`), para que a instalação funcione fora da rede interna.

## Funcionalidades

| Pedido | Como ficou |
|---|---|
| Cadastro do cliente | Nome, CPF/CNPJ, WhatsApp, telefone, e-mail, endereço. Pode ser cadastrado de dentro da OS ("+ Novo"). |
| Cadastro do aparelho | Tipo, marca, modelo, IMEI/série, cor, senha de desbloqueio, acessórios, ligado ao cliente. |
| Cadastro do técnico | Contato, especialidade, regime (comissão ou salário fixo), salário e percentuais. |
| Cadastro do atendente | Contato e situação. O login do atendente preenche o atendente da OS sozinho. |
| Comissão | Percentual separado para **peças** e para **mão de obra**. **Salário fixo recebe comissão só de peças.** Calculada e congelada na entrega da OS; o desconto é rateado entre peças e mão de obra. A base das peças pode ser o valor de venda ou o lucro (Configurações). Relatório por período, por técnico e por OS, com exportação. |
| Estoque | Peças com código, localização, mínimo, custo e preço. Entradas (com custo médio), saídas e ajustes. **Peças da OS saem do estoque ao salvar e voltam ao cancelar ou excluir a OS.** Não deixa usar mais do que há em estoque. |
| Ordem de serviço | Número automático, defeito, estado e acessórios na entrada, diagnóstico, serviço executado, peças do estoque e mão de obra, desconto, sinal e forma de pagamento, garantia. Impressão da via de entrada e do comprovante de retirada com os termos. |
| Foto do aparelho na OS | Várias fotos por OS; no celular abre a câmera. As fotos são reduzidas antes de salvar e saem na OS impressa. |
| Alertas: prontos e atrasos | Painel e menu mostram OS atrasadas, que vencem hoje, prontas aguardando retirada (vermelho após o limite configurado, padrão 30 dias) e peças para repor. |
| Prazo de entrega e retirada | Prazo padrão configurável; ao marcar "Pronta" grava a data; na entrega grava data e quem retirou. Botão para avisar o cliente pelo WhatsApp com mensagem pronta. |

## Estrutura

```
shared/regras.js            totais, comissão, situação de prazo, link do WhatsApp
web/src/local/              "back-end" que roda no navegador
  servidor.js               responde às rotas (/ordens, /painel, /comissoes...)
  recursos.js               campos, permissões e regras (estoque, OS, comissão)
  banco.js                  tabelas no localStorage, com transação (desfaz tudo se uma regra falhar)
  fotos.js                  fotos no IndexedDB
  exemplos.js               dados de exemplo da primeira abertura
web/src/pages/              telas (painel, OS, impressão, estoque, comissões, configurações)
web/src/entidades.jsx       telas de cadastro (campos e colunas)
```

As telas chamam `api('/rota')` como chamariam um servidor. Para voltar a ter back-end no futuro, basta trocar a função `api` em `web/src/lib/api.js` por chamadas HTTP; a versão com Node.js, Express e Prisma está no histórico do git (commit `79b22f1`).
