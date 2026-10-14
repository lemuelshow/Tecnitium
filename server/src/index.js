import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { tratarErros } from './lib/http.js';
import { exigirLogin } from './lib/auth.js';
import { rotasCrud } from './lib/crud.js';
import { recursos, UPLOADS } from './resources/index.js';
import { rotasAuth, rotasUsuarios } from './routes/usuarios.js';
import { rotasConfig, rotasFotos, rotasPainel, rotasComissoes } from './routes/extras.js';

const prisma = new PrismaClient();
const app = express();
const PORTA = Number(process.env.PORT || 3434);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/saude', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', rotasAuth(prisma));
// Fotos das OS: nomes aleatorios (UUID), servidos como arquivos estaticos.
app.use('/uploads', express.static(UPLOADS, { maxAge: '7d' }));

const api = express.Router();
api.use(exigirLogin);
api.use('/usuarios', rotasUsuarios(prisma));
api.use('/config', rotasConfig(prisma));
api.use('/fotos', rotasFotos(prisma));
api.use('/painel', rotasPainel(prisma));
api.use('/comissoes', rotasComissoes(prisma));
for (const [nome, recurso] of Object.entries(recursos)) api.use(`/${nome}`, rotasCrud(prisma, recurso));
app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(tratarErros);
app.listen(PORTA, () => console.log(`Tecnitium API rodando em http://localhost:${PORTA}`));
