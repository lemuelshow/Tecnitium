// Portal do cliente: so a linha do tempo das proprias OS, as fotos de entrada e o documento da OS.
import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { numeroOS, linkWhatsapp } from '@tecnitium/shared';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { brl, fd, fdt } from '../lib/format.js';
import { Marca } from '../components/Layout.jsx';
import { DocumentoOS, DicaImpressao } from './Imprimir.jsx';

const TOM = { 'Aberta': 'info', 'Em análise': 'info', 'Aguardando aprovação': 'warn', 'Aguardando peça': 'warn', 'Em reparo': 'info', 'Pronta': 'ready', 'Sem conserto': 'mute', 'Entregue': 'ok', 'Cancelada': 'mute' };
const ROTULO = { 'Aberta': 'Recebido', 'Em análise': 'Em manutenção', 'Aguardando aprovação': 'Aguardando sua aprovação', 'Aguardando peça': 'Em manutenção', 'Em reparo': 'Em manutenção', 'Pronta': 'Pronto para retirar', 'Sem conserto': 'Pronto para retirar', 'Entregue': 'Retirado', 'Cancelada': 'Cancelada' };

export default function Portal() {
  return (
    <Routes>
      <Route element={<CascaPortal />}>
        <Route index element={<ListaPortal />} />
        <Route path="os/:id" element={<DetalhePortal />} />
      </Route>
      <Route path="os/:id/documento" element={<DocumentoPortal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const usePortal = () => useQuery({ queryKey: ['portal'], queryFn: () => api('/portal') });

function CascaPortal() {
  const { usuario, sair } = useAuth();
  const { data } = usePortal();
  useEffect(() => { document.title = `Minhas ordens de serviço · ${data?.empresa?.nomeEmpresa || 'Tecnitium'}`; }, [data]);
  return (
    <div className="portal">
      <header className="portal-topo">
        <span className="brand"><Marca sub={data?.empresa?.nomeEmpresa || 'Assistência técnica'} /></span>
        <button className="btn sm" onClick={sair}>Sair</button>
      </header>
      <main className="portal-main">
        <p className="eyebrow">Olá, {(usuario?.nome || '').split(' ')[0]}</p>
        <Outlet />
      </main>
    </div>
  );
}

function Linha({ etapas, compacta }) {
  return (
    <ol className={`linha-tempo ${compacta ? 'compacta' : ''}`}>
      {etapas.map((e) => (
        <li key={e.chave} className={e.feito ? 'feito' : e.atual ? 'atual' : ''}>
          <span className="marco" aria-hidden="true">{e.feito ? '✓' : ''}</span>
          <div>
            <strong>{e.titulo}</strong>
            {e.data && (e.feito || e.atual) ? <span className="quando">{e.data.length > 10 ? fdt(e.data) : fd(e.data)}</span> : null}
            {!compacta && (e.atual || (e.feito && e.chave === 'entregue')) ? <p>{e.texto}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Status({ s }) {
  return <span className={`pill tone-${TOM[s] || 'mute'}`}>{ROTULO[s] || s}</span>;
}

function ListaPortal() {
  const { data, error, isLoading } = usePortal();
  if (error) return <div className="empty"><strong>Não foi possível carregar suas ordens.</strong>{error.message}</div>;
  if (isLoading) return <div className="empty"><strong>Carregando…</strong></div>;
  const abertas = data.ordens.filter((o) => !['Entregue', 'Cancelada'].includes(o.status));
  const antigas = data.ordens.filter((o) => ['Entregue', 'Cancelada'].includes(o.status));
  const Cartao = ({ o }) => (
    <Link to={`/os/${o.id}`} className="os-cartao">
      <div className="os-cartao-topo">
        <span><strong>{o.aparelho ? `${o.aparelho.marca} ${o.aparelho.modelo}` : 'Aparelho'}</strong><span className="sub">OS {numeroOS(o.numero)} · entrada {fd(o.entrada)}</span></span>
        <Status s={o.status} />
      </div>
      {o.status === 'Cancelada' ? <p className="sub">Ordem de serviço cancelada.</p> : <Linha etapas={o.etapas} compacta />}
      <div className="os-cartao-pe">
        <span className="sub">{o.status === 'Entregue' ? `Retirado em ${fd(o.dataEntrega)}` : ['Pronta', 'Sem conserto'].includes(o.status) ? 'Já pode ser retirado' : o.prazo ? `Previsão: ${fd(o.prazo)}` : ''}</span>
        <span className="ver">Ver detalhes →</span>
      </div>
    </Link>
  );
  return (
    <>
      <h1>Minhas ordens de serviço</h1>
      {!data.ordens.length ? <div className="empty"><strong>Nenhuma ordem de serviço por aqui.</strong>Quando você deixar um aparelho na loja, ele aparece nesta tela.</div> : null}
      {abertas.length ? <section className="portal-sec"><h2>Em andamento</h2>{abertas.map((o) => <Cartao key={o.id} o={o} />)}</section> : null}
      {antigas.length ? <section className="portal-sec"><h2>Anteriores</h2>{antigas.map((o) => <Cartao key={o.id} o={o} />)}</section> : null}
      <Contato empresa={data.empresa} />
    </>
  );
}

function Contato({ empresa, os }) {
  const zap = linkWhatsapp(empresa.whatsapp, os ? `Olá! Gostaria de falar sobre a OS ${numeroOS(os.numero)}.` : 'Olá! Gostaria de falar sobre minha ordem de serviço.');
  return (
    <div className="portal-contato">
      <strong>{empresa.nomeEmpresa}</strong>
      <span className="sub">{[empresa.telefone, empresa.endereco].filter(Boolean).join(' · ')}</span>
      {zap ? <a className="btn" href={zap} target="_blank" rel="noreferrer">Falar com a loja no WhatsApp</a> : null}
    </div>
  );
}

function DetalhePortal() {
  const { id } = useParams();
  const { data, error } = useQuery({ queryKey: ['portal', id], queryFn: () => api('/portal/' + id), retry: false });
  const [zoom, setZoom] = useState(null);
  if (error) return <div className="empty"><strong>Ordem de serviço não encontrada.</strong><Link to="/">Voltar para minhas ordens</Link></div>;
  if (!data) return <div className="empty"><strong>Carregando…</strong></div>;
  const { os, aparelho, fotos, etapas, config } = data;
  return (
    <>
      <Link to="/" className="voltar">← Minhas ordens</Link>
      <div className="portal-cab">
        <h1>{aparelho.marca} {aparelho.modelo}</h1>
        <Status s={os.status} />
      </div>
      <p className="sub">OS {numeroOS(os.numero)} · {aparelho.tipo}{aparelho.serie ? ` · ${aparelho.serie}` : ''}</p>

      <section className="portal-sec">
        <h2>Andamento</h2>
        <div className="panel">{os.status === 'Cancelada' ? <p>Esta ordem de serviço foi cancelada. Fale com a loja para mais informações.</p> : <Linha etapas={etapas} />}</div>
      </section>

      <section className="portal-sec">
        <h2>Resumo</h2>
        <div className="panel resumo">
          <div><span className="sub">Defeito informado</span>{os.defeito}</div>
          {os.diagnostico ? <div><span className="sub">Diagnóstico</span>{os.diagnostico}</div> : null}
          {os.servicoExecutado ? <div><span className="sub">Serviço executado</span>{os.servicoExecutado}</div> : null}
          <div className="dupla">
            <div><span className="sub">Previsão de entrega</span>{fd(os.prazo)}</div>
            <div><span className="sub">Valor</span>{os.itens.length ? brl(data.os.itens.reduce((s, i) => s + i.qtd * i.valor, 0) - (os.desconto || 0)) : 'após a análise'}</div>
          </div>
        </div>
      </section>

      <section className="portal-sec">
        <h2>Fotos do aparelho na entrada</h2>
        {fotos.length ? (
          <div className="portal-fotos">{fotos.map((f) => <button key={f.id} onClick={() => setZoom(f.url)} aria-label="Ampliar foto"><img src={f.url} alt="Foto do aparelho na entrada" /></button>)}</div>
        ) : <p className="sub">Nenhuma foto registrada na entrada.</p>}
      </section>

      <Link to={`/os/${os.id}/documento`} className="btn primary bloco">Ver ordem de serviço completa</Link>
      <Contato empresa={config} os={os} />
      {zoom ? <div className="zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Foto ampliada"><img src={zoom} alt="Foto ampliada" /></div> : null}
    </>
  );
}

function DocumentoPortal() {
  const { id } = useParams();
  const ir = useNavigate();
  const { data, error } = useQuery({ queryKey: ['portal', id], queryFn: () => api('/portal/' + id), retry: false });
  if (error) return <Navigate to="/" replace />;
  if (!data) return <div className="empty"><strong>Carregando…</strong></div>;
  return (
    <div className="print-wrap">
      <div className="print-bar">
        <button className="btn" onClick={() => ir(`/os/${id}`)}>← Voltar</button>
        <button className="btn primary" onClick={() => window.print()}>Imprimir ou salvar PDF</button>
      </div>
      <DicaImpressao />
      <DocumentoOS os={data.os} cfg={data.config} cli={data.cliente} ap={data.aparelho} tec={data.tecnico} fotos={data.fotos} />
    </div>
  );
}
