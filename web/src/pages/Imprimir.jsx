import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { numeroOS, totaisOS, somarDias } from '@tecnitium/shared';
import { api } from '../lib/api.js';
import { brl, num, fd, fdt } from '../lib/format.js';

// Via da OS para imprimir (entrada no balcao ou comprovante de retirada).
export default function Imprimir() {
  const { id } = useParams();
  const os = useQuery({ queryKey: ['ordens', id], queryFn: () => api('/ordens/' + id) }).data;
  const cfg = useQuery({ queryKey: ['config'], queryFn: () => api('/config') }).data;
  const cli = useQuery({ queryKey: ['clientes', os?.clienteId], queryFn: () => api('/clientes/' + os.clienteId), enabled: !!os }).data;
  const ap = useQuery({ queryKey: ['aparelhos', os?.aparelhoId], queryFn: () => api('/aparelhos/' + os.aparelhoId), enabled: !!os }).data;
  const tec = useQuery({ queryKey: ['tecnicos', os?.tecnicoId], queryFn: () => api('/tecnicos/' + os.tecnicoId), enabled: !!os?.tecnicoId }).data;
  const fotos = useQuery({ queryKey: ['fotos', id], queryFn: () => api('/fotos?osId=' + id) }).data || [];
  if (!os || !cfg || !cli || !ap) return <div className="empty"><strong>Preparando a OS…</strong></div>;
  const t = totaisOS(os);
  const entregue = os.status === 'Entregue';

  return (
    <div className="print-wrap">
      <div className="print-bar"><button className="btn primary" onClick={() => window.print()}>Imprimir</button><button className="btn" onClick={() => window.close()}>Fechar</button></div>
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
        {fotos.length ? <div className="blk"><h4>Fotos do aparelho</h4><div className="fotos-p">{fotos.map((f) => <img key={f.id} src={f.url} alt="Foto do aparelho" />)}</div></div> : null}
        {cfg.termos ? <div className="blk"><h4>Termos</h4><div className="termos">{cfg.termos}</div></div> : null}
        <div className="ass"><div>{cfg.nomeEmpresa}</div><div>{cli.nome}{entregue ? ' (retirada)' : ' (entrega do aparelho)'}</div></div>
      </div>
    </div>
  );
}
