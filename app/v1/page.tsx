"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  SELENE_V1_COLOR,
  type SeleneData,
  type SeleneMoeda,
  fetchSelene,
  horasDesde,
  moedasDoDia,
  resumo,
  serieRetorno,
  tempoRelativo,
} from "../../lib/selene";
import { formatPnl, formatTime, paddedDomain, axisTicks } from "../../lib/dashboard";

const pct = (n: number | null | undefined, d = 2) =>
  n == null || !Number.isFinite(n) ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}%`;
const usd = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n)) ? "—" : `$${Number(n).toFixed(2)}`;
const px = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: Number(n) < 1000 ? 2 : 0 });

export default function SeleneV1() {
  const [data, setData] = useState<SeleneData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const load = () =>
      fetchSelene()
        .then((d) => {
          setData(d);
          setErro(d.erro ?? null);
        })
        .catch((e) => setErro(String(e)));
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const r = useMemo(() => resumo(data), [data]);
  const serie = useMemo(() => serieRetorno(data), [data]);
  const moedas = useMemo(() => moedasDoDia(data), [data]);
  const ops = useMemo(() => [...(data?.operacoes ?? [])].sort((a, b) => b.ts.localeCompare(a.ts)), [data]);
  const domain = paddedDomain(serie.flatMap((s) => [s.selene, s.btc ?? 0, s.eth ?? 0, 0]), 0.15);
  const h = horasDesde(r.ultimoRegisto);
  const parada = h != null && h > 26;
  const pnlColor = r.pnl > 0.0001 ? "#3dff9a" : r.pnl < -0.0001 ? "#ff5d6c" : "#d4d4d4";
  const real = (r.ultimo?.modo ?? "simulacao").toLowerCase().startsWith("real");

  return (
    <div className="s1-root">
      <div className="s1-shell">
        <div className="td-ticker">
          <a className="td-brand td-home-link" href="/">← INÍCIO</a>
          <span className="td-brand">SELENE_V1 · CLAUDE</span>
          <span className="td-live" style={{ color: parada ? "#fab219" : "#22c55e" }}>
            ● {parada ? "SEM DADOS" : real ? "REAL" : "SIMULAÇÃO"}
          </span>
          <span>EQ {usd(r.equity)}</span>
          <span style={{ color: pnlColor }}>P&L {formatPnl(r.pnl)}</span>
          <span>EXP {Math.round(Number(r.ultimo?.exposicao_pct ?? 0))}%</span>
        </div>

        {(parada || erro) && (
          <div className="s1-alert">
            {erro
              ? `Erro a ler a Selene_v1: ${erro}`
              : `Sem dados novos há ${tempoRelativo(h!)} — a Selene_v1 devia publicar todos os dias às 01h10.`}
          </div>
        )}

        <div className="s1-top">
          <div className="td-card s1-wallet">
            <div className="td-label">WALLET · SELENE_V1</div>
            <div className="td-total" style={{ color: SELENE_V1_COLOR }}>{usd(r.equity)}</div>
            <div className="td-wallet-stats">
              <span style={{ color: pnlColor }}>DESDE INÍCIO {pct(r.retornoPct)}</span>
              <span>HOJE {pct(Number(r.ultimo?.pnl_dia_pct ?? 0))}</span>
              <span>DD MÁX {pct(r.quedaMaxPct, 1)}</span>
              <span>CAPITAL {usd(r.capital)}</span>
            </div>
            <div className="s1-desc">
              Tendência diária em BTC e ETH: comprada quando o preço está acima das médias de 50/100/200 dias, fora quando não está.
            </div>
          </div>

          <div className="td-card s1-chartcard">
            <div className="td-chart-head">
              <div className="td-label">RETORNO % DESDE O ARRANQUE</div>
              <div className="s1-legend">
                <span><i style={{ background: SELENE_V1_COLOR }} />SELENE_V1</span>
                <span><i className="dash" style={{ borderColor: "#d4a017" }} />BTC HOLD</span>
                <span><i className="dash" style={{ borderColor: "#7a7a7a" }} />ETH HOLD</span>
              </div>
            </div>
            <div className="s1-chart">
              {mounted && serie.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serie} margin={{ top: 8, right: 22, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#141414" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={32} />
                    <YAxis domain={domain} ticks={axisTicks(domain)} width={52} tickFormatter={(v: number) => pct(v, 1)} tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <ReferenceLine y={0} stroke="#3a3a3a" />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                      labelStyle={{ color: "#888" }}
                      formatter={(v: number, name: string) => [pct(v), name]}
                    />
                    <Line type="linear" dataKey="btc" name="BTC HOLD" stroke="#d4a017" strokeDasharray="4 4" strokeWidth={1.2} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="linear" dataKey="eth" name="ETH HOLD" stroke="#7a7a7a" strokeDasharray="4 4" strokeWidth={1.2} dot={false} isAnimationActive={false} connectNulls />
                    <Line type="linear" dataKey="selene" name="SELENE_V1" stroke={SELENE_V1_COLOR} strokeWidth={2} dot={{ r: 2.5, fill: SELENE_V1_COLOR }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="td-card s1-signals">
          <div className="td-chart-head">
            <div className="td-label">SINAIS DE HOJE</div>
            <div className="td-range">
              VELA {r.ultimo?.vela_sinal ? r.ultimo.vela_sinal.slice(8, 10) + "/" + r.ultimo.vela_sinal.slice(5, 7) : "—"}
            </div>
          </div>
          {moedas.length === 0 ? (
            <div className="td-empty">Sem sinais</div>
          ) : (
            <div className="s1-coins">
              {moedas.map((m) => <CoinRow key={m.moeda} m={m} />)}
            </div>
          )}
        </div>

        <div className="td-card s1-tape">
          <div className="td-label">OPERAÇÕES</div>
          <div className="s1-tape-head s1-tape-grid">
            <span>TIME</span><span>MOEDA</span><span>LADO</span><span>PREÇO</span><span>VALOR</span><span>NOTA</span>
          </div>
          <div className="s1-tape-body">
            {ops.length === 0 ? (
              <div className="td-empty">Ainda sem operações — a Selene_v1 está fora do mercado à espera de sinal.</div>
            ) : (
              ops.map((o) => (
                <div key={o.id} className="s1-tape-row s1-tape-grid">
                  <span>{formatTime(Date.parse(o.ts))}</span>
                  <span style={{ color: SELENE_V1_COLOR }}>{o.moeda}</span>
                  <span>{o.lado.toUpperCase()}</span>
                  <span>{px(o.preco)}</span>
                  <span>{usd(o.valor_usd)}</span>
                  <span>{o.nota ?? ""}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="s1-foot">
          <span>MOEDAS {moedas.length}</span>
          <span>DIAS {data?.diario.length ?? 0}</span>
          <span>OPS {ops.length}</span>
          <span>ÚLTIMO REGISTO {h == null ? "—" : `HÁ ${tempoRelativo(h)}`}</span>
        </div>
      </div>
    </div>
  );
}

function CoinRow({ m }: { m: SeleneMoeda }) {
  const p = Number(m.preco);
  const mas = [m.ma50, m.ma100, m.ma200].map(Number);
  const all = [p, ...mas].filter(Number.isFinite);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pos = (x: number) => ((x - lo) / (hi - lo || 1)) * 100;
  const acima = mas.filter((x) => p > x).length;
  const dentro = /dentro|compr|long/i.test(m.sinal ?? "");
  return (
    <div className="s1-coin">
      <div className="s1-coin-head">
        <span className="s1-coin-name">{m.moeda}</span>
        <span className="s1-coin-px">{px(m.preco)}</span>
        <span className="s1-coin-sig" style={{ color: dentro ? "#3dff9a" : "#8a8a8a" }}>● {(m.sinal ?? "—").toUpperCase()}</span>
      </div>
      <div className="s1-bar" title={`MA50 ${px(m.ma50)} · MA100 ${px(m.ma100)} · MA200 ${px(m.ma200)}`}>
        {mas.map((x, i) => (
          <i key={i} style={{ left: `${pos(x)}%`, opacity: 0.9 - i * 0.25 }} />
        ))}
        <b style={{ left: `${pos(p)}%` }} />
      </div>
      <div className="s1-coin-meta">
        <span>ACIMA DE {acima}/3 MÉDIAS</span>
        <span>VOL {m.vol_pct == null ? "—" : `${Math.round(Number(m.vol_pct))}%`}</span>
        <span>ALVO {usd(m.alvo_usd)} · ACTUAL {usd(m.actual_usd)}</span>
        <span>{(m.accao ?? "").toUpperCase()}</span>
      </div>
    </div>
  );
}
