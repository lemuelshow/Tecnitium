// Editor para marcar defeitos na foto: caneta livre, circulo e seta, com cores, espessura e desfazer.
// Funciona com dedo, caneta e mouse (Pointer Events). Salva a imagem com os desenhos (JPEG).
import { useEffect, useRef, useState } from 'react';

const CORES = [['#FF2D2D', 'Vermelho'], ['#FFD400', 'Amarelo'], ['#22C55E', 'Verde'], ['#FFFFFF', 'Branco']];
const ESPESSURAS = [['fina', 0.6], ['media', 1], ['grossa', 1.8]];
const FERRAMENTAS = [['caneta', 'Caneta', 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3'], ['circulo', 'Círculo', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'], ['seta', 'Seta', 'M5 19L19 5M10 5h9v9']];

function desenhar(ctx, f, base) {
  ctx.save();
  ctx.strokeStyle = f.cor; ctx.lineWidth = base * f.esp; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = base * 0.6;
  ctx.beginPath();
  if (f.tipo === 'caneta') {
    f.pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (f.pontos.length === 1) ctx.lineTo(f.pontos[0][0] + 0.1, f.pontos[0][1]);
  } else if (f.tipo === 'circulo') {
    const [[x1, y1], [x2, y2]] = [f.pontos[0], f.pontos[f.pontos.length - 1]];
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2 || 1, Math.abs(y2 - y1) / 2 || 1, 0, 0, Math.PI * 2);
  } else {
    const [[x1, y1], [x2, y2]] = [f.pontos[0], f.pontos[f.pontos.length - 1]];
    const ang = Math.atan2(y2 - y1, x2 - x1), ponta = base * f.esp * 5;
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.moveTo(x2, y2); ctx.lineTo(x2 - ponta * Math.cos(ang - 0.45), y2 - ponta * Math.sin(ang - 0.45));
    ctx.moveTo(x2, y2); ctx.lineTo(x2 - ponta * Math.cos(ang + 0.45), y2 - ponta * Math.sin(ang + 0.45));
  }
  ctx.stroke();
  ctx.restore();
}

export default function FotoEditor({ src, onSalvar, onCancelar, titulo = 'Marcar defeitos na foto', rotuloCancelar = 'Cancelar' }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const atualRef = useRef(null);
  const [formas, setFormas] = useState([]);
  const [ferramenta, setFerramenta] = useState('caneta');
  const [cor, setCor] = useState(CORES[0][0]);
  const [esp, setEsp] = useState(1);
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Carrega a imagem e ajusta o canvas a resolucao dela (limitada para nao pesar).
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const max = 1600, esc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = canvasRef.current;
      c.width = Math.round(img.naturalWidth * esc); c.height = Math.round(img.naturalHeight * esc);
      imgRef.current = img; setPronto(true);
    };
    img.src = src;
  }, [src]);

  const base = () => Math.max(canvasRef.current.width, canvasRef.current.height) / 220;
  const redesenhar = (extra) => {
    const c = canvasRef.current, ctx = c.getContext('2d');
    if (!imgRef.current) return;
    ctx.drawImage(imgRef.current, 0, 0, c.width, c.height);
    [...formas, ...(extra ? [extra] : [])].forEach((f) => desenhar(ctx, f, base()));
  };
  useEffect(() => { if (pronto) redesenhar(); }); // eslint-disable-line react-hooks/exhaustive-deps

  const ponto = (e) => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height];
  };
  const inicio = (e) => {
    if (!pronto) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    atualRef.current = { tipo: ferramenta, cor, esp, pontos: [ponto(e)] };
    redesenhar(atualRef.current);
  };
  const mover = (e) => {
    if (!atualRef.current) return;
    e.preventDefault();
    const p = ponto(e), f = atualRef.current;
    if (f.tipo === 'caneta') f.pontos.push(p); else f.pontos = [f.pontos[0], p];
    redesenhar(f);
  };
  const fim = () => {
    const f = atualRef.current;
    atualRef.current = null;
    if (f) setFormas((l) => [...l, f]);
  };

  // Atalhos: Ctrl+Z desfaz, Esc cancela.
  useEffect(() => {
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); setFormas((l) => l.slice(0, -1)); }
      if (e.key === 'Escape') { e.stopPropagation(); onCancelar(); }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onCancelar]);

  async function salvar() {
    setSalvando(true);
    redesenhar();
    const blob = await new Promise((r) => canvasRef.current.toBlob(r, 'image/jpeg', 0.85));
    onSalvar(new File([blob], 'foto-marcada.jpg', { type: 'image/jpeg' }), formas.length);
  }

  return (
    <div className="editor" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="editor-topo">
        <button type="button" className="btn sm" onClick={onCancelar}>{rotuloCancelar}</button>
        <strong>{titulo}</strong>
        <button type="button" className="btn sm primary" onClick={salvar} disabled={!pronto || salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
      <div className="editor-area">
        {!pronto ? <span className="sub">Carregando foto…</span> : null}
        <canvas ref={canvasRef} onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim} onPointerLeave={(e) => e.buttons === 0 && fim()}
          aria-label="Foto: arraste para desenhar" style={{ visibility: pronto ? 'visible' : 'hidden' }} />
      </div>
      <div className="editor-barra">
        <div className="grupo" role="group" aria-label="Ferramenta">
          {FERRAMENTAS.map(([k, rot, d]) => (
            <button key={k} type="button" className={ferramenta === k ? 'on' : ''} onClick={() => setFerramenta(k)} aria-pressed={ferramenta === k} title={rot}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg><span>{rot}</span>
            </button>
          ))}
        </div>
        <div className="grupo" role="group" aria-label="Cor">
          {CORES.map(([c, rot]) => <button key={c} type="button" className={`cor ${cor === c ? 'on' : ''}`} style={{ '--c': c }} onClick={() => setCor(c)} aria-pressed={cor === c} aria-label={rot} title={rot} />)}
        </div>
        <div className="grupo" role="group" aria-label="Espessura">
          {ESPESSURAS.map(([k, v]) => <button key={k} type="button" className={`esp ${esp === v ? 'on' : ''}`} onClick={() => setEsp(v)} aria-pressed={esp === v} aria-label={`Traço ${k}`} title={`Traço ${k}`}><i style={{ height: 2 + v * 4 }} /></button>)}
        </div>
        <div className="grupo" role="group" aria-label="Edição">
          <button type="button" onClick={() => setFormas((l) => l.slice(0, -1))} disabled={!formas.length} title="Desfazer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></svg><span>Desfazer</span></button>
          <button type="button" onClick={() => setFormas([])} disabled={!formas.length} title="Limpar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg><span>Limpar</span></button>
        </div>
      </div>
    </div>
  );
}
