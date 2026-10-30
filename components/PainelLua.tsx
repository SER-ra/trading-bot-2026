"use client";

import { useEffect, useState } from "react";
import type { Vela } from "./GraficoMedias";

/** As mesmas 4 condições da lista de cada moeda. */
export function condicoesCumpridas(velas: Vela[]): number {
  const u = velas.at(-1);
  if (!u || u.ma50 == null || u.ma100 == null || u.ma200 == null) return 0;
  return [u.preco > u.ma50, u.preco > u.ma100, u.preco > u.ma200, u.ma50 > u.ma100 && u.ma100 > u.ma200].filter(Boolean).length;
}

const FASES = ["Lua nova", "Crescente", "Quarto crescente", "Quase cheia", "Lua cheia"];

/**
 * Lua cuja fase mostra quão perto a Selene_v1 está de entrar:
 * 0/4 condições = lua nova, 4/4 = lua cheia. Usa a moeda mais adiantada.
 */
export default function PainelLua({ progresso }: { progresso: { moeda: string; n: number }[] }) {
  const melhor = progresso.reduce((a, b) => (b.n > a.n ? b : a), progresso[0] ?? { moeda: "—", n: 0 });
  const fracao = melhor.n / 4;
  const cheia = melhor.n === 4;

  return (
    <section className={`lua-painel${cheia ? " cheia" : ""}`}>
      <div className="lua-wrap">
        <Lua fracao={fracao} />
      </div>
      <div className="lua-texto">
        <div className="lua-fase">{FASES[melhor.n]}</div>
        <div className="lua-titulo">
          {cheia ? `${melhor.moeda} pronta: tendência de subida completa` : progresso.length ? `Mais perto de entrar: ${melhor.moeda}` : "A ler o mercado…"}
        </div>
        <div className="lua-moedas">
          {progresso.map((p) => (
            <div key={p.moeda} className="lua-moeda">
              <span>{p.moeda}</span>
              <span className="lua-pontos">
                {[0, 1, 2, 3].map((i) => <i key={i} className={i < p.n ? "on" : ""} />)}
              </span>
              <span className="lua-n">{p.n}/4</span>
            </div>
          ))}
        </div>
        <Contagem />
      </div>
    </section>
  );
}

/** Desenho da lua: o terminador é uma elipse cuja largura depende da fase. */
function Lua({ fracao }: { fracao: number }) {
  const r = 46;
  const c = 60;
  // fracção iluminada 0..1 → crescente a partir da direita
  const k = Math.cos(Math.PI * fracao); // 1 (nova) → -1 (cheia)
  const rx = Math.abs(k) * r;
  const varre = k > 0 ? 0 : 1;
  const luz = fracao <= 0.001
    ? ""
    : fracao >= 0.999
      ? `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c} ${c + r} A ${r} ${r} 0 1 1 ${c} ${c - r} Z`
      : `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${rx} ${r} 0 0 ${varre} ${c} ${c - r} Z`;
  return (
    <svg viewBox="0 0 120 120" className="lua-svg" aria-label={`Lua ${Math.round(fracao * 100)}% iluminada`}>
      <defs>
        <radialGradient id="lua-luz" cx="40%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="70%" stopColor="#e9e4d4" />
          <stop offset="100%" stopColor="#bdb6a2" />
        </radialGradient>
        <radialGradient id="lua-halo" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="rgba(233,228,212,0.22)" />
          <stop offset="100%" stopColor="rgba(233,228,212,0)" />
        </radialGradient>
        <clipPath id="lua-disco"><circle cx={c} cy={c} r={r} /></clipPath>
      </defs>
      <circle className="lua-halo" cx={c} cy={c} r={60} fill="url(#lua-halo)" style={{ opacity: 0.25 + fracao * 0.75 }} />
      <circle cx={c} cy={c} r={r} fill="#15151a" stroke="rgba(233,228,212,0.18)" strokeWidth={1} />
      {luz && <path d={luz} fill="url(#lua-luz)" />}
      <g clipPath="url(#lua-disco)" opacity={0.18}>
        <circle cx={44} cy={46} r={8} fill="#6b6556" />
        <circle cx={72} cy={70} r={11} fill="#6b6556" />
        <circle cx={70} cy={38} r={5} fill="#6b6556" />
        <circle cx={50} cy={78} r={4} fill="#6b6556" />
      </g>
    </svg>
  );
}

/** Contagem para a próxima decisão: a Selene corre às 01h10 UTC, depois do fecho diário. */
function Contagem() {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (agora == null) return <div className="lua-contagem">&nbsp;</div>;
  const d = new Date(agora);
  let alvo = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 1, 10, 0);
  if (alvo <= agora) alvo += 86_400_000;
  const s = Math.floor((alvo - agora) / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <div className="lua-contagem">
      <span className="lua-contagem-rot">Próxima decisão em</span>
      <span className="lua-relogio">{hh}<b>:</b>{mm}<b>:</b>{ss}</span>
    </div>
  );
}
