import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { numeroOS, linkWhatsapp } from '@tecnitium/shared';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { brl, num, fd } from '../lib/format.js';
import { Cabecalho, Pill, IconeMais } from '../components/ui.jsx';
import { TOM_OS } from './Ordens.jsx';

const corTom = { bad: 'var(--bad)', warn: 'var(--warn)', ok: 'var(--c4)', mute: 'var(--mute)' };

export default function Painel() {
  const { data: P, error } = useQuery({ queryKey: ['painel'], queryFn: () => api('/painel'), refetchInterval: 60_000 });
  const { usuario, pode } = useAuth();
  const ir = useNavigate();
  const hojeTxt = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const abrir = (id) => ir('/ordens?os=' + id);

  const cab = <Cabecalho sobre={`${usuario?.perfil === 'TECNICO' ? 'Minha bancada' : 'Visão geral'} · ${hojeTxt}`} titulo="Painel"><button className="btn primary" onClick={() => ir('/ordens?nova=1')}><IconeMais />Nova OS</button></Cabecalho>;
  if (error) return <>{cab}<div className="panel">Não foi possível carregar o painel: {error.message}</div></>;
  if (!P) return <>{cab}<div className="empty"><strong>Carregando…</strong></div></>;
  const C = P.contadores;

  const Item = ({ o, tom, direita }) => (
    <li tabIndex={0} onClick={() => abrir(o.id)} onKeyDown={(e) => e.key === 'Enter' && abrir(o.id)}>
      <span className="sev" style={{ background: corTom[tom] }} />
      <span><span className="t"><span className="os-num">{numeroOS(o.numero)}</span> · {o.cliente}</span><span className="d">{o.aparelho}</span></span>
      <span className="r">{direita}</span>
    </li>
  );

  return (
    <>
      {cab}
      <div className="kpi-row">
        <button className="kpi" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => ir('/ordens?f=bancada')}><span className="l">Em bancada</span><span className="v">{C.bancada}</span><span className="s">{C.venceHoje} vence{C.venceHoje === 1 ? '' : 'm'} hoje</span></button>
        <button className="kpi" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => ir('/ordens?f=atrasadas')}><span className="l">Atrasadas</span><span className={`v ${C.atrasadas ? 'txt-bad' : ''}`}>{C.atrasadas}</span><span className="s">prazo de entrega vencido</span></button>
        <button className="kpi" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => ir('/ordens?f=retirar')}><span className="l">Prontas para retirar</span><span className="v" style={{ color: 'var(--ready)' }}>{C.retirar}</span><span className="s">{brl(C.aReceber)} a receber</span></button>
        <div className="kpi"><span className="l">Entregues no mês</span><span className="v">{C.entreguesMes}</span><span className="s">{brl(C.faturamentoMes)} faturados</span></div>
        {pode(['ADMIN']) ? <div className="kpi"><span className="l">Comissões do mês</span><span className="v">{brl(C.comissoesMes)}</span><span className="s"><Link to="/comissoes">ver por técnico</Link></span></div> : null}
      </div>

      <div className="grid">
        <div className="panel span-6">
          <div className="panel-h"><h2>Atrasadas e vencendo hoje</h2><Link to="/ordens?f=atrasadas">Ver todas</Link></div>
          {P.atrasadas.length || P.venceHoje.length ? (
            <ul className="lista-os">
              {P.atrasadas.map((o) => <Item key={o.id} o={o} tom="bad" direita={<><Pill tom="bad">{o.situacao.texto}</Pill><span className="sub">{o.status} · prazo {fd(o.prazo)}</span></>} />)}
              {P.venceHoje.map((o) => <Item key={o.id} o={o} tom="warn" direita={<><Pill tom="warn">vence hoje</Pill><span className="sub">{o.status}</span></>} />)}
            </ul>
          ) : <p className="sub">Nenhuma OS atrasada. Tudo dentro do prazo.</p>}
        </div>

        <div className="panel span-6">
          <div className="panel-h"><h2>Prontas aguardando retirada</h2><Link to="/ordens?f=retirar">Ver todas</Link></div>
          {P.prontas.length ? (
            <ul className="lista-os">
              {P.prontas.map((o) => {
                const zap = linkWhatsapp(o.telefone, `Olá! Aqui é da ${P.config.nomeEmpresa}. Seu ${o.aparelho} (OS ${numeroOS(o.numero)}) já pode ser retirado.${o.saldo > 0 ? ` Valor a pagar: ${brl(o.saldo)}.` : ''} Obrigado!`);
                return (
                  <Item key={o.id} o={o} tom={o.situacao.tom === 'ok' ? 'ok' : o.situacao.tom} direita={<>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {zap ? <a className="btn sm" href={zap} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Avisar pelo WhatsApp">WhatsApp</a> : null}
                      <Pill tom={o.situacao.tom === 'ok' ? 'ready' : o.situacao.tom}>{o.situacao.texto}</Pill>
                    </span>
                    <span className="sub">{o.status}{o.saldo > 0 ? ` · falta ${brl(o.saldo)}` : ''}</span>
                  </>} />
                );
              })}
            </ul>
          ) : <p className="sub">Nenhum aparelho esperando retirada.</p>}
          {P.prontas.some((o) => o.situacao.tom === 'bad') ? <p className="sub" style={{ marginTop: 10 }}>Em vermelho: prontas há {P.config.diasAbandono} dias ou mais sem retirada.</p> : null}
        </div>

        <div className="panel span-7">
          <div className="panel-h"><h2>Faturamento dos últimos 6 meses</h2><span className="count">OS entregues</span></div>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={P.meses} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? `${num(v / 1000)} mil` : num(v))} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v, n) => [brl(v), n]} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar isAnimationActive={false} dataKey="servicos" name="Mão de obra" stackId="a" fill="var(--accent)" />
                <Bar isAnimationActive={false} dataKey="pecas" name="Peças" stackId="a" fill="var(--c2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="legend" style={{ marginTop: 8 }}><span><span className="dot" style={{ background: 'var(--accent)' }} />Mão de obra</span><span><span className="dot" style={{ background: 'var(--c2)' }} />Peças</span></div>
        </div>

        <div className="panel span-5">
          <div className="panel-h"><h2>Estoque para repor</h2><Link to="/estoque">Estoque</Link></div>
          {P.estoqueBaixo.length ? (
            <table className="t" style={{ minWidth: 0 }}>
              <thead><tr><th>Peça</th><th className="num">Saldo</th><th className="num">Mínimo</th></tr></thead>
              <tbody>{P.estoqueBaixo.slice(0, 8).map((p) => <tr key={p.id}><td>{p.descricao}<span className="sub mono">{p.codigo}</span></td><td className={`num ${p.quantidade <= 0 ? 'txt-bad' : 'txt-warn'}`}>{num(p.quantidade)}</td><td className="num">{num(p.minimo)}</td></tr>)}</tbody>
            </table>
          ) : <p className="sub">Nenhuma peça abaixo do mínimo.</p>}
          {P.estoqueBaixo.length > 8 ? <p className="sub">e mais {P.estoqueBaixo.length - 8}.</p> : null}
        </div>

        <div className="panel span-12">
          <div className="panel-h"><h2>OS por situação</h2></div>
          <div className="legend" style={{ gap: 10 }}>
            {Object.entries(TOM_OS).filter(([s]) => P.porStatus[s]).map(([s, tom]) => <span key={s}><Pill tom={tom}>{s}</Pill><b>{P.porStatus[s]}</b></span>)}
          </div>
        </div>
      </div>
    </>
  );
}
