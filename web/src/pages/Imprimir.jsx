import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { numeroOS, totaisOS, somarDias } from '@tecnitium/shared';
import { api } from '../lib/api.js';
import { brl, num, fd, fdt } from '../lib/format.js';

// Documento da OS: usado na impressao da equipe e no portal do cliente.
// acesso: { codigo } mostra ao cliente como acompanhar a OS pelo portal (so na via da equipe).
export function DocumentoOS({ os, cfg, cli, ap, tec, fotos = [], acesso }) {
  const t = totaisOS(os);
  const entregue = os.status === 'Entregue';
  return (
    <div className="doc">
      <div className="cab">
        <div>
          <h1>{cfg.nomeEmpresa}</h1>
          <div>{[cfg.documento, cfg.telefone, cfg.whatsapp && `WhatsApp ${cfg.whatsapp}`].filter(Boolean).join(' · ')}</div>
          <div>{cfg.endereco}</div>
        </div>
        <div><div className="num">OS {numeroOS(os.numero)}</div><div style={{ textAlign: 'right' }}>{entregue ? 'Comprovante de retirada' : 'Via de entrada'}<br />Entrada: {fdt(os.entrada)}</div></div>
      </div>
      <div className="g2">
        <div className="blk"><h4>Cliente</h4><strong>{cli.nome}</strong><br />{[cli.documento, cli.whatsapp || cli.telefone].filter(Boolean).join(' · ')}<br />{[cli.endereco, cli.cidade && `${cli.cidade}/${cli.uf || ''}`].filter(Boolean).join(' - ')}</div>
        <div className="blk"><h4>Aparelho</h4><strong>{ap.tipo} {ap.marca} {ap.modelo}</strong><br />{ap.serie ? `IMEI/Série: ${ap.serie}` : 'Sem número de série'}{ap.cor ? ` · ${ap.cor}` : ''}<br />Acessórios: {os.acessorios || 'nenhum'}</div>
      </div>
      <div className="blk"><h4>Defeito relatado</h4>{os.defeito}{os.estado ? <><br /><em>Estado na entrada:</em> {os.estado}</> : null}</div>
      {os.diagnostico || os.servicoExecutado ? <div className="blk"><h4>Diagnóstico e serviço</h4>{os.diagnostico}{os.servicoExecutado ? <><br /><strong>Executado:</strong> {os.servicoExecutado}</> : null}</div> : null}
      {os.itens.length ? (
        <div className="blk">
          <h4>Peças e serviços</h4>
          <table>
            <thead><tr><th>Descrição</th><th>Tipo</th><th className="n">Qtd</th><th className="n">Unitário</th><th className="n">Subtotal</th></tr></thead>
            <tbody>{os.itens.map((i, k) => <tr key={k}><td>{i.desc}</td><td>{i.tipo === 'Peça' ? 'Peça' : 'Mão de obra'}</td><td className="n">{num(i.qtd)}</td><td className="n">{brl(i.valor)}</td><td className="n">{brl(i.qtd * i.valor)}</td></tr>)}</tbody>
            <tfoot>
              {t.desconto ? <tr><td colSpan={4}>Desconto</td><td className="n">− {brl(t.desconto)}</td></tr> : null}
              <tr><td colSpan={4}><strong>Total</strong></td><td className="n"><strong>{brl(t.total)}</strong></td></tr>
              <tr><td colSpan={4}>Pago{os.formaPagamento ? ` (${os.formaPagamento})` : ''}</td><td className="n">{brl(os.valorPago)}</td></tr>
              {t.saldo > 0.009 ? <tr><td colSpan={4}><strong>A pagar na retirada</strong></td><td className="n"><strong>{brl(t.saldo)}</strong></td></tr> : null}
            </tfoot>
          </table>
        </div>
      ) : <div className="blk"><h4>Orçamento</h4>A ser informado após a análise técnica.</div>}
      <div className="g2">
        <div className="blk"><h4>Prazos</h4>Previsão de entrega: <strong>{fd(os.prazo)}</strong><br />Técnico: {tec?.nome || 'a definir'}{entregue ? <><br />Retirado em {fd(os.dataEntrega)}{os.retiradoPor ? ` por ${os.retiradoPor}` : ''}</> : null}</div>
        <div className="blk"><h4>Garantia</h4>{os.garantiaDias ? <>{os.garantiaDias} dias{entregue ? `, até ${fd(somarDias(os.dataEntrega, os.garantiaDias))}` : ' a partir da retirada'}, sobre o serviço executado e as peças trocadas.</> : 'Sem garantia.'}</div>
      </div>
      {acesso?.codigo && !entregue ? (
        <div className="blk"><h4>Acompanhe sua OS</h4>Acesse <strong>{window.location.origin}</strong>, toque em “Sou cliente” e entre com seu telefone (ou CPF) e o código <strong className="mono">{acesso.codigo}</strong>.</div>
      ) : null}
      {fotos.length ? <div className="blk"><h4>Fotos do aparelho na entrada</h4><div className="fotos-p">{fotos.map((f) => <img key={f.id} src={f.url} alt="Foto do aparelho" />)}</div></div> : null}
      {cfg.termos ? <div className="blk"><h4>Termos</h4><div className="termos">{cfg.termos}</div></div> : null}
      <div className="ass"><div>{cfg.nomeEmpresa}</div><div>{cli.nome}{entregue ? ' (retirada)' : ' (entrega do aparelho)'}</div></div>
    </div>
  );
}

export const DicaImpressao = () => <p className="dica-print sub">No celular, “Imprimir” abre a tela do sistema, onde dá para escolher a impressora ou salvar em PDF. Se nada abrir, use o menu do navegador → Compartilhar → Imprimir.</p>;

// Via da OS para imprimir (entrada no balcao ou comprovante de retirada).
// Abre na mesma tela (no app instalado, uma aba nova sairia do app e perderia os dados).
export default function Imprimir() {
  const { id } = useParams();
  const ir = useNavigate();
  const voltar = () => ir(`/ordens?os=${id}`);
  const consulta = useQuery({ queryKey: ['ordem', id], queryFn: () => api('/ordens/' + id), retry: false });
  const os = consulta.data;
  const cfg = useQuery({ queryKey: ['config'], queryFn: () => api('/config') }).data;
  const cli = useQuery({ queryKey: ['clientes', os?.clienteId], queryFn: () => api('/clientes/' + os.clienteId), enabled: !!os }).data;
  const ap = useQuery({ queryKey: ['aparelhos', os?.aparelhoId], queryFn: () => api('/aparelhos/' + os.aparelhoId), enabled: !!os }).data;
  const tec = useQuery({ queryKey: ['tecnicos', os?.tecnicoId], queryFn: () => api('/tecnicos/' + os.tecnicoId), enabled: !!os?.tecnicoId }).data;
  const fotos = (useQuery({ queryKey: ['fotos', id], queryFn: () => api('/fotos?osId=' + id) }).data || []).filter((f) => (f.momento || 'Entrada') === 'Entrada');
  if (consulta.error) {
    return (
      <div className="print-wrap"><div className="empty"><strong>Não foi possível abrir esta OS para impressão.</strong>{consulta.error.message}<br /><br /><button className="btn" onClick={() => ir('/ordens')}>Ir para as ordens de serviço</button></div></div>
    );
  }
  if (!os || !cfg || !cli || !ap) return <div className="empty"><strong>Preparando a OS…</strong></div>;
  return (
    <div className="print-wrap">
      <div className="print-bar">
        <button className="btn" onClick={voltar}>← Voltar para a OS</button>
        <button className="btn primary" onClick={() => window.print()}>Imprimir</button>
      </div>
      <DicaImpressao />
      <DocumentoOS os={os} cfg={cfg} cli={cli} ap={ap} tec={tec} fotos={fotos} acesso={{ codigo: cli.codigoAcesso }} />
    </div>
  );
}
