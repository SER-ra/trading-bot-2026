"use client";

import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";
import {
  type EquityPoint,
  type Trade,
  buildEquityCurve,
  isOpenTrade,
  isTestTrade,
  latestEquity,
  paddedDomain,
  resolveBots,
} from "../lib/dashboard";
import { fetchEquityHistory, fetchTrades } from "../lib/queries";
import { SELENE_V1_COLOR, type SeleneData, fetchSelene, horasDesde, resumo, serieRetorno, tempoRelativo } from "../lib/selene";

const V2_COLOR = "#ff8a4c";

const pct = (n: number) => `${n > 0.00001 ? "+" : n < -0.00001 ? "−" : ""}${Math.abs(n).toFixed(2).replace(".", ",")}%`;
const money = (n: number) => `$${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Resumo {
  equity: number;
  capital: number;
  retorno: number;
  horas: number | null;
  limite: number;
  detalhe: string[];
  serie: { i: number; v: number }[];
}

export default function Home() {
  const [selene, setSelene] = useState<SeleneData | null>(null);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [mounted, setMounted] = useState(false);
  const [falhas, setFalhas] = useState<{ v1?: string; v2?: string }>({});

  useEffect(() => {
    setMounted(true);
    const load = () => {
      fetchSelene()
        .then((d) => { setSelene(d); setFalhas((f) => ({ ...f, v1: d.erro })); })
        .catch((e) => setFalhas((f) => ({ ...f, v1: String(e) })));
      Promise.all([fetchEquityHistory(), fetchTrades()])
        .then(([e, t]) => { setEquity(e); setTrades(t); setFalhas((f) => ({ ...f, v2: undefined })); })
        .catch((e) => setFalhas((f) => ({ ...f, v2: String(e) })));
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const v1: Resumo = useMemo(() => {
    const r = resumo(selene);
    const moedas = selene?.moedas.filter((m) => m.dia === r.ultimo?.dia) ?? [];
    return {
      equity: r.equity,
      capital: r.capital,
      retorno: r.retornoPct,
      horas: horasDesde(r.ultimoRegisto),
      limite: 26,
      detalhe: [
        `Investido ${Math.round(Number(r.ultimo?.exposicao_pct ?? 0))}%`,
        moedas.map((m) => `${m.moeda}: ${(m.sinal ?? "—").toLowerCase()}`).join(" · ") || "Sem sinais",
        `Pior queda ${pct(r.quedaMaxPct)}`,
      ],
      serie: serieRetorno(selene).map((p, i) => ({ i, v: p.selene })),
    };
  }, [selene]);

  const v2: Resumo = useMemo(() => {
    const live = trades.filter((t) => !isTestTrade(t));
    const bots = resolveBots(equity, live);
    const eq = bots.reduce((s, b) => s + latestEquity(equity, b.id, b.capital), 0);
    const cap = bots.reduce((s, b) => s + b.capital, 0);
    const curve = buildEquityCurve(equity, bots);
    const serie = curve.map((row, i) => {
      let pnl = 0;
      for (const b of bots) { const v = row.values[b.id]; if (v != null) pnl += v - b.capital; }
      return { i, v: cap ? (pnl / cap) * 100 : 0 };
    });
    const ultimo = equity.reduce((best, p) => Math.max(best, Date.parse(p.timestamp) || 0), 0);
    return {
      equity: eq,
      capital: cap,
      retorno: cap ? (eq / cap - 1) * 100 : 0,
      horas: ultimo ? horasDesde(ultimo) : null,
      limite: 6,
      detalhe: [
        `${bots.length} bots`,
        bots.map((b) => b.label).join(" · "),
        `Posições abertas: ${live.filter(isOpenTrade).length}`,
      ],
      serie,
    };
  }, [equity, trades]);

  return (
    <div className="bv-root hm-root" style={{ ["--bv-cor" as string]: "#e9e4d4" }}>
      <div className="hm-shell">
        <header className="hm-head">
          <div className="hm-moon" aria-hidden />
          <div>
            <h1>Selene</h1>
            <div className="hm-sub">Bots de negociação em simulação. Escolhe uma versão.</div>
          </div>
        </header>

        <div className="hm-grid">
          <BotEntry
            href="/v1"
            nome="Selene_v1"
            motor="Claude"
            cor={SELENE_V1_COLOR}
            descricao="Segue a tendência diária de BTC e ETH. Compra ou fica fora, sem alavancagem."
            r={v1}
            erro={falhas.v1}
            mounted={mounted}
          />
          <BotEntry
            href="/v2"
            nome="Selene_v2"
            motor="Grok"
            cor={V2_COLOR}
            descricao="Vários bots de 250 USDT (BTC, ETH, SOL, XRP, grelha e funding), a comprar ou a vender."
            r={v2}
            erro={falhas.v2}
            mounted={mounted}
          />
        </div>

        <footer className="hm-foot">
          Ambas as versões estão em simulação. Isto não é aconselhamento financeiro.
        </footer>
      </div>
    </div>
  );
}

function BotEntry({
  href, nome, motor, cor, descricao, r, erro, mounted,
}: {
  href: string; nome: string; motor: string; cor: string; descricao: string; r: Resumo; erro?: string; mounted: boolean;
}) {
  const parado = r.horas != null && r.horas > r.limite;
  const corRet = r.retorno > 0.0001 ? "var(--bv-bom)" : r.retorno < -0.0001 ? "var(--bv-mau)" : "var(--bv-tinta)";
  const domain = paddedDomain([...r.serie.map((p) => p.v), 0], 0.25);
  return (
    <a className="hm-card" href={href} style={{ ["--hm-accent" as string]: cor }}>
      <div className="hm-card-top">
        <span className="hm-name">{nome}</span>
        <span className="hm-engine">{motor}</span>
        <span className="hm-state" style={{ color: erro ? "var(--bv-mau)" : parado ? "var(--bv-aviso)" : "var(--bv-bom)" }}>
          ● {erro ? "Erro" : parado ? "Parado" : "Activo"}
        </span>
      </div>
      <div className="hm-desc">{descricao}</div>
      <div className="hm-eq">{money(r.equity)}</div>
      <div className="hm-ret" style={{ color: corRet }}>
        {pct(r.retorno)} <span>({r.equity - r.capital >= 0 ? "+" : "−"}{Math.abs(r.equity - r.capital).toFixed(2).replace(".", ",")} $) desde o início</span>
      </div>
      <div className="hm-spark">
        {mounted && r.serie.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={r.serie} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
              <YAxis hide domain={domain} />
              <ReferenceLine y={0} stroke="#2a2a2a" strokeDasharray="3 3" />
              <Line type="linear" dataKey="v" stroke={cor} strokeWidth={1.6} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="hm-meta">
        {r.detalhe.map((d, i) => <span key={i}>{d}</span>)}
        <span style={{ color: parado ? "var(--bv-aviso)" : undefined }}>
          {r.horas == null ? "Sem registos" : `Último registo há ${tempoRelativo(r.horas).toLowerCase()}`}
        </span>
      </div>
      {erro && <div className="hm-err">{erro}</div>}
      <div className="hm-open">Abrir →</div>
    </a>
  );
}
