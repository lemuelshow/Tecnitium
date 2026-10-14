# Tecnitium

Sistema para assistência técnica: ordens de serviço com fotos, clientes, aparelhos, técnicos, atendentes, estoque de peças, alertas de prazo e de retirada, e comissão dos técnicos.

- **API:** Node.js 22, Express, Prisma (SQLite por padrão, troca para PostgreSQL com uma linha) e Multer para as fotos
- **Interface:** React 18, Vite, React Router, TanStack Query e Recharts
- **Regras compartilhadas:** `shared/regras.js` (totais da OS, comissão, prazos), usado pela API e pela interface

## Como rodar

Requisitos: Node.js 20 ou mais novo.

```bash
npm run setup      # instala, cria o banco e carrega dados de exemplo
npm run dev        # API em http://localhost:3434 e interface em http://localhost:5174
```

No Windows, dê dois cliques em `iniciar.bat`. Para começar com o banco vazio (só configuração e usuários), use `npm run setup:vazio`.

Acessos iniciais (senha `tecnitium`; troque em "Trocar senha" no rodapé do menu):

| E-mail | Perfil | Pode |
|---|---|---|
| admin@tecnitium.com.br | Administrador | tudo: equipe, comissões, usuários, configurações, excluir OS |
| atendimento@tecnitium.com.br | Atendente | abrir e atualizar OS, clientes, aparelhos, estoque e fotos |
| tecnico@tecnitium.com.br | Técnico | atualizar OS (diagnóstico, peças, situação), ver só as próprias comissões |

### Produção

```bash
npm run build      # compila a interface em web/dist
npm start          # a API serve a interface, o /api e as fotos na mesma porta (3434)
```

Antes de publicar, troque `JWT_SECRET` em `server/.env`. As fotos ficam em `server/uploads/`: inclua essa pasta no backup junto com o banco.

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
| Foto do aparelho na OS | Várias fotos por OS; no celular abre a câmera. As fotos são reduzidas antes do envio e saem na OS impressa. |
| Alertas: prontos e atrasos | Painel e menu mostram OS atrasadas, que vencem hoje, prontas aguardando retirada (vermelho após o limite configurado, padrão 30 dias) e peças para repor. |
| Prazo de entrega e retirada | Prazo padrão configurável; ao marcar "Pronta" grava a data; na entrega grava data e quem retirou. Botão para avisar o cliente pelo WhatsApp com mensagem pronta. |

## Estrutura

```
shared/regras.js            totais, comissão, situação de prazo, link do WhatsApp
server/prisma/schema.prisma modelo de dados
server/prisma/seed.js       configuração, usuários e dados de exemplo
server/src/resources/       campos, permissões e regras (estoque, OS, comissão)
server/src/routes/          login, usuários, configuração, fotos, painel, comissões
web/src/pages/Ordens.jsx    lista e formulário da OS
web/src/pages/Imprimir.jsx  OS para imprimir
web/src/entidades.jsx       telas de cadastro (campos e colunas)
```
