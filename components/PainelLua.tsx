"use client";

import { useEffect, useId, useState } from "react";
import type { Vela } from "./GraficoMedias";

/** Regra da Selene_v1: quantas das 3 médias o preço já passou (3 = compra). */
export function condicoesCumpridas(velas: Vela[]): number {
  const u = velas.at(-1);
  if (!u || u.ma50 == null || u.ma100 == null || u.ma200 == null) return 0;
  return [u.preco > u.ma50, u.preco > u.ma100, u.preco > u.ma200].filter(Boolean).length;
}

/** Preço abaixo das 3 médias: a Selene_v1 aposta na descida. */
export function emDescida(velas: Vela[]): boolean {
  const u = velas.at(-1);
  if (!u || u.ma50 == null || u.ma100 == null || u.ma200 == null) return false;
  return u.preco < u.ma50 && u.preco < u.ma100 && u.preco < u.ma200;
}

const FASES = ["Lua nova", "Crescente", "Quase cheia", "Lua cheia"];

export interface ProgressoMoeda {
  moeda: string;
  n: number; // médias que o preço já passou (0..3)
  descida?: boolean; // abaixo das 3 médias
  paraComprar?: number; // % a subir até passar a média mais alta (<= 0: já passou)
  paraVender?: number; // % a cair até ficar abaixo da média mais baixa (<= 0: já está)
}

/** Distância (%) da moeda ao sinal mais próximo e qual: compra ou venda. 0 = já em sinal. */
export function sinalMaisProximo(p: ProgressoMoeda, semVendas = false): { lado: "compra" | "venda"; dist: number } {
  if (p.n === 3) return { lado: "compra", dist: 0 };
  if (semVendas) return { lado: "compra", dist: Math.max(0, p.paraComprar ?? Infinity) };
  if (p.descida) return { lado: "venda", dist: 0 };
  const c = p.paraComprar ?? Infinity, v = p.paraVender ?? Infinity;
  return c <= v ? { lado: "compra", dist: c } : { lado: "venda", dist: v };
}

const pctTxt = (x: number) => `${x.toFixed(1).replace(".", ",")}%`;

/**
 * Uma lua por moeda, com a fase da regra da Selene_v1:
 * lua cheia = preço acima das 3 médias (compra); lua nova = abaixo das 3 (aposta na descida); no meio = fora.
 * O título fala do sinal mais próximo, seja de compra ou de venda.
 */
export default function PainelLua({ progresso, semVendas = false }: { progresso: ProgressoMoeda[]; semVendas?: boolean }) {
  const comSinal = progresso.map((p) => ({ p, s: sinalMaisProximo(p, semVendas) }));
  const alvo = comSinal.reduce<(typeof comSinal)[number] | null>((a, b) => (!a || b.s.dist < a.s.dist ? b : a), null);
  const emSinal = comSinal.filter((x) => x.s.dist === 0);

  let titulo = "A ler o mercado…";
  if (emSinal.length)
    titulo = emSinal.map((x) => `${x.p.moeda}: ${x.s.lado === "compra" ? "sinal de compra" : "sinal de venda (aposta na descida)"}`).join(" · ");
  else if (alvo)
    titulo = `Mais perto de um sinal: ${alvo.p.moeda}, a ${pctTxt(alvo.s.dist)} de ${alvo.s.lado === "compra" ? "comprar" : "entrar vendido"}`;

  return (
    <section className={`lua-painel luas${emSinal.length ? " cheia" : ""}`}>
      <div className="lua-texto">
        <div className="lua-fase">{semVendas ? "Lua cheia compra · no resto fica fora (este bot não aposta na descida)" : "Lua cheia compra · lua nova vende · no meio fica fora"}</div>
        <div className="lua-titulo">{titulo}</div>
        <div className="luas-grelha">
          {progresso.map((p) => {
            const s = sinalMaisProximo(p, semVendas);
            const estado = p.n === 3 ? "compra" : p.descida && !semVendas ? "venda" : "fora";
            return (
              <div key={p.moeda} className={`lua-cartao ${estado}`}>
                <div className="lua-mini"><Lua fracao={p.n / 3} /></div>
                <div className="lua-info">
                  <div className="lua-moeda-nome">
                    {p.moeda} <span className="lua-fase-moeda">{p.descida ? (semVendas ? "Lua nova · fora" : "Lua nova · vendido") : `${FASES[p.n]}${p.n === 3 ? " · compra" : ""}`}</span>
                  </div>
                  <div className="lua-pontos">
                    {[0, 1, 2].map((i) => <i key={i} className={i < p.n ? "on" : ""} />)}
                    <span className="lua-n">{p.n}/3</span>
                  </div>
                  {estado === "fora" ? (
                    <div className="lua-dist">
                      <span className={s.lado === "compra" ? "perto" : ""}>comprar <b className="bom">+{pctTxt(p.paraComprar ?? 0)}</b></span>
                      {!semVendas && <span className={s.lado === "venda" ? "perto" : ""}>vender <b className="mau">−{pctTxt(p.paraVender ?? 0)}</b></span>}
                    </div>
                  ) : (
                    <div className="lua-dist"><span>{estado === "compra" ? "preço acima das 3 médias" : "preço abaixo das 3 médias"}</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <Contagem />
      </div>
    </section>
  );
}

/** Desenho da lua: o terminador é uma elipse cuja largura depende da fase. */
function Lua({ fracao }: { fracao: number }) {
  const id = useId().replace(/:/g, "");
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
        <radialGradient id={`luz${id}`} cx="40%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="70%" stopColor="#e9e4d4" />
          <stop offset="100%" stopColor="#bdb6a2" />
        </radialGradient>
        <radialGradient id={`halo${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="rgba(233,228,212,0.22)" />
          <stop offset="100%" stopColor="rgba(233,228,212,0)" />
        </radialGradient>
        <clipPath id={`disco${id}`}><circle cx={c} cy={c} r={r} /></clipPath>
      </defs>
      <circle className="lua-halo" cx={c} cy={c} r={60} fill={`url(#halo${id})`} style={{ opacity: 0.25 + fracao * 0.75 }} />
      <circle cx={c} cy={c} r={r} fill="#15151a" stroke="rgba(233,228,212,0.18)" strokeWidth={1} />
      {luz && <path d={luz} fill={`url(#luz${id})`} />}
      <g clipPath={`url(#disco${id})`} opacity={0.18}>
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
