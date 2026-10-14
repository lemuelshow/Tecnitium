-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" TEXT NOT NULL DEFAULT 'ATENDENTE',
    "tecnicoId" TEXT,
    "atendenteId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nomeEmpresa" TEXT NOT NULL DEFAULT 'Tecnitium Assistência Técnica',
    "documento" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "endereco" TEXT,
    "prazoPadraoDias" INTEGER NOT NULL DEFAULT 3,
    "garantiaDias" INTEGER NOT NULL DEFAULT 90,
    "diasAbandono" INTEGER NOT NULL DEFAULT 30,
    "baseComissaoPeca" TEXT NOT NULL DEFAULT 'Venda',
    "termos" TEXT
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "cep" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "obs" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Aparelho" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "serie" TEXT,
    "cor" TEXT,
    "senha" TEXT,
    "acessorios" TEXT,
    "obs" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Tecnico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "especialidade" TEXT,
    "regime" TEXT NOT NULL DEFAULT 'Comissão',
    "salario" REAL NOT NULL DEFAULT 0,
    "percPeca" REAL NOT NULL DEFAULT 0,
    "percServico" REAL NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "obs" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Atendente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "obs" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Peca" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "marca" TEXT,
    "compatibilidade" TEXT,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "quantidade" REAL NOT NULL DEFAULT 0,
    "minimo" REAL NOT NULL DEFAULT 0,
    "custo" REAL NOT NULL DEFAULT 0,
    "preco" REAL NOT NULL DEFAULT 0,
    "localizacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "obs" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MovEstoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pecaId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "custoUnit" REAL,
    "origem" TEXT,
    "osId" TEXT,
    "automatico" BOOLEAN NOT NULL DEFAULT false,
    "obs" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrdemServico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "aparelhoId" TEXT NOT NULL,
    "atendenteId" TEXT,
    "tecnicoId" TEXT,
    "entrada" TEXT NOT NULL,
    "prazo" TEXT,
    "prioridade" TEXT NOT NULL DEFAULT 'Normal',
    "status" TEXT NOT NULL DEFAULT 'Aberta',
    "defeito" TEXT NOT NULL,
    "estado" TEXT,
    "acessorios" TEXT,
    "diagnostico" TEXT,
    "servicoExecutado" TEXT,
    "itens" TEXT NOT NULL DEFAULT '[]',
    "desconto" REAL NOT NULL DEFAULT 0,
    "valorPago" REAL NOT NULL DEFAULT 0,
    "formaPagamento" TEXT,
    "garantiaDias" INTEGER,
    "dataPronta" TEXT,
    "dataEntrega" TEXT,
    "retiradoPor" TEXT,
    "regime" TEXT,
    "percPeca" REAL,
    "percServico" REAL,
    "comissaoPeca" REAL NOT NULL DEFAULT 0,
    "comissaoServico" REAL NOT NULL DEFAULT 0,
    "obs" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FotoOS" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "osId" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "legenda" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Peca_codigo_key" ON "Peca"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_numero_key" ON "OrdemServico"("numero");
