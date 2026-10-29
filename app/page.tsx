"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TorusSlice } from "../components/ParticleTorus";
import {
  type BotProfile,
  type EquityPoint,
  type Trade,
  botEquitySeries,
  buildEquityCurve,
  chartRows,
  axisTicks,
  curveDomain,
  formatPnl,
  isClosedTrade,
  isOpenTrade,
  isTestTrade,
  latestEquity,
  paddedDomain,
  resolveBots,
  sortTradesNewest,
  tradeSummary,
  winRate,
} from "../lib/dashboard";
import { fetchEquityHistory, fetchTrades } from "../lib/queries";

export default function Dashboard() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const mounted = useMounted();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const load = () => {
      const requestId = ++requestRef.current;
      Promise.all([fetchEquityHistory(), fetchTrades()])
        .then(([nextEquity, nextTrades]) => {
          if (requestId !== requestRef.current) return;
          setEquity(nextEquity);
          setTrades(nextTrades);
        })
        .catch((err) => console.error("dashboard fetch failed", err));
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);
    const particles: { angle: number; radius: number; speed: number; size: number; color: string }[] = [];
    for (let i = 0; i < 70; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 40 + Math.random() * 90,
        speed: 0.001 + Math.random() * 0.0012,
        size: Math.random() * 1 + 0.3,
        color: Math.random() > 0.7 ? "rgba(34,197,94,0.3)" : "rgba(120,120,120,0.15)",
      });
    }
    let anim = 0;
    function draw() {
      ctx!.fillStyle = "rgba(5,5,5,0.25)";
      ctx!.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      particles.forEach((p) => {
        p.angle += p.speed;
        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius * 0.3;
        ctx!.beginPath();
        ctx!.arc(x, y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = p.color;
        ctx!.fill();
      });
      anim = requestAnimationFrame(draw);
    }
    draw();
    const onResize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const liveTrades = useMemo(() => trades.filter((trade) => !isTestTrade(trade)), [trades]);
  const bots = useMemo(() => resolveBots(equity, liveTrades), [equity, liveTrades]);
  const curve = useMemo(() => buildEquityCurve(equity, bots), [equity, bots]);
  const chartData = useMemo(() => chartRows(curve), [curve]);
  const chartBots = useMemo(
    () => bots.filter((bot) => equity.some((point) => point.bot === bot.id)),
    [bots, equity]
  );
  const yDomain = useMemo(() => curveDomain(curve, chartBots.map((bot) => bot.id)), [curve, chartBots]);

  const latest: Record<string, number> = {};
  bots.forEach((bot) => {
    latest[bot.id] = latestEquity(equity, bot.id, bot.capital);
  });
  const totalEquity = bots.reduce((sum, bot) => sum + latest[bot.id], 0);
  const totalStart = bots.reduce((sum, bot) => sum + bot.capital, 0);
  const totalPnl = totalEquity - totalStart;
  const pnlColor = totalPnl >= 0 ? "#22c55e" : "#ef4444";

  const closedTrades = liveTrades.filter(isClosedTrade);
  const rate = winRate(liveTrades);

  let peak = totalStart;
  equity.forEach((point) => {
    const value = Number(point.equity);
    if (value > peak) peak = value;
  });
  const currentDD = peak > 0 ? ((peak - totalEquity) / peak) * 100 : 0;

  const log = sortTradesNewest(liveTrades);
  const singlePointBots = new Set(
    chartBots
      .filter((bot) => curve.filter((row) => row.values[bot.id] != null).length < 2)
      .map((bot) => bot.id)
  );

  return (
    <div className="td-root">
      <canvas ref={canvasRef} className="td-canvas" />

      <div className="td-shell">
        <PanelFeeds />
        <div className="td-kpis">
        <div className="td-top">
          <div className="td-brand">TRADING</div>
          <div className="td-live">● LIVE</div>
        </div>

        <div className="td-card td-summary">
          <div className="td-label">TOTAL EQUITY</div>
          <div className="td-total">{`$${totalEquity.toFixed(2)}`}</div>
          <div className="td-pnl" style={{ color: pnlColor }}>
            {`DIA ${formatPnl(totalPnl)}`}
          </div>
        </div>

        <div className="td-metrics">
          <div className="td-card td-metric">
            <div className="td-label">WIN RATE</div>
            <div className="td-metric-value" style={{ color: rate >= 50 ? "#22c55e" : "#ef4444" }}>
              {`${rate.toFixed(0)}%`}
            </div>
          </div>
          <div className="td-card td-metric">
            <div className="td-label">DRAWDOWN</div>
            <div className="td-metric-value" style={{ color: currentDD > 5 ? "#ef4444" : "#ccc" }}>
              {`${currentDD.toFixed(1)}%`}
            </div>
          </div>
          <div className="td-card td-metric">
            <div className="td-label">TRADES</div>
            <div className="td-metric-value">{closedTrades.length}</div>
          </div>
        </div>
        </div>

        <AllocationDonut bots={bots} latest={latest} total={totalEquity} />

        <div className="td-card td-chart-card">
          <div className="td-chart-head">
            <div className="td-label">EQUITY TOTAL</div>
            {curve.length > 0 && (
              <div className="td-range">
                {curve[0].label} — {curve[curve.length - 1].label}
              </div>
            )}
          </div>
          <div className="td-chart">
            {mounted && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#171717" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={<TimeTick />}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={80}
                  interval="preserveStartEnd"
                  height={28}
                />
                <YAxis
                  domain={yDomain}
                  ticks={axisTicks(yDomain)}
                  width={68}
                  tickFormatter={(value: number) => `$${Number(value).toFixed(2)}`}
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "JetBrains Mono, ui-monospace, monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<EquityTooltip />}
                  cursor={{ stroke: "#333", strokeWidth: 1 }}
                />
                {chartBots.map((bot) => (
                  <Line
                    key={bot.id}
                    type="monotone"
                    dataKey={bot.id}
                    name={bot.label}
                    stroke={bot.color}
                    strokeWidth={1.8}
                    dot={singlePointBots.has(bot.id) ? <SeriesDot color={bot.color} /> : false}
                    activeDot={{ r: 3, strokeWidth: 0, fill: bot.color }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            )}
          </div>
          <div className="td-legend">
            {chartBots.map((bot) => (
              <span key={bot.id} className="td-legend-item">
                <i style={{ background: bot.color }} />
                {bot.label}
              </span>
            ))}
          </div>
        </div>

        <div className="td-bots">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} equity={latest[bot.id]} points={equity} trades={liveTrades} />
          ))}
        </div>

        <div className="td-card td-log-card">
          <div className="td-log">
            <div className="td-log-sticky">ORDERS</div>
            <div className="td-log-section">OPEN</div>
            <OrderRows trades={log.filter(isOpenTrade)} bots={bots} />
            <div className="td-log-section">FILLS</div>
            <OrderRows trades={log.filter(isClosedTrade)} bots={bots} empty="No fills" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AllocationDonut({
  bots,
  latest,
  total,
}: {
  bots: BotProfile[];
  latest: Record<string, number>;
  total: number;
}) {
  const slices: TorusSlice[] = bots.map((bot) => {
    const equity = latest[bot.id] ?? bot.capital;
    const share = total > 0 ? (equity / total) * 100 : 0;
    return { id: bot.id, label: bot.label, color: bot.color, equity, pnl: equity - bot.capital, share };
  });
  const [Torus, setTorus] = useState<typeof import("../components/ParticleTorus").default | null>(null);
  useEffect(() => {
    let live = true;
    import("../components/ParticleTorus").then((mod) => {
      if (live) setTorus(() => mod.default);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="td-card td-alloc">
      <div className="td-label">ALLOCATION</div>
      {Torus ? <Torus slices={slices} total={total} /> : <div className="td-viz" />}
    </div>
  );
}

function BotCard({
  bot,
  equity,
  points,
  trades,
}: {
  bot: BotProfile;
  equity: number;
  points: EquityPoint[];
  trades: Trade[];
}) {
  const mounted = useMounted();
  const series = botEquitySeries(points, bot.id, bot.capital);
  const data = series.map((value, index) => ({ i: index, equity: value }));
  const domain = paddedDomain(series, 0.35);
  const pnl = equity - bot.capital;
  const botTrades = trades.filter((trade) => trade.bot === bot.id);
  const closed = botTrades.filter(isClosedTrade);
  const open = botTrades.filter(isOpenTrade);
  const rate = closed.length ? (closed.filter((trade) => Number(trade.pnl) > 0).length / closed.length) * 100 : 0;

  return (
    <div className="td-card td-bot" data-bot={bot.id} style={{ borderTop: `2px solid ${bot.color}` }} title={bot.id}>
      <div className="td-bot-head">
        <span className="td-bot-name">{bot.label}</span>
        <span style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444" }}>{formatPnl(pnl)}</span>
      </div>
      <div className="td-bot-eq">{`$${equity.toFixed(2)}`}</div>
      <div className="td-bot-status">{open.length ? `${open.length} OPEN` : "FLAT"}</div>
      <div className="td-bot-meta">{tradeSummary(closed.length, open.length, rate)}</div>
      <div className="td-spark">
        {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 2, left: 2, bottom: 8 }}>
            <XAxis hide dataKey="i" />
            <YAxis hide width={0} domain={domain} />
            <Line
              type="monotone"
              dataKey="equity"
              stroke={bot.color}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function OrderRows({ trades, bots, empty = "No open orders" }: { trades: Trade[]; bots: BotProfile[]; empty?: string }) {
  if (!trades.length) return <div className="td-empty">{empty}</div>;
  return (
    <>
      {trades.map((trade) => {
        const bot = bots.find((item) => item.id === trade.bot);
        const pnl = Number(trade.pnl);
        const showPnl = isClosedTrade(trade) && Number.isFinite(pnl);
        const price = trade.entry_price != null ? `$${Number(trade.entry_price).toFixed(2)}` : "";
        return (
          <div key={trade.id} className="td-trade">
            <div className="td-trade-top">
              <span className="td-trade-bot" style={{ color: bot?.color ?? "#d4d4d4" }}>
                {bot?.label ?? trade.bot}
              </span>
              <span className="td-trade-symbol">{trade.symbol || "—"}</span>
              {showPnl && <span style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444" }}>{formatPnl(pnl)}</span>}
            </div>
            <div className="td-trade-sub">
              {(trade.side || "—").toString().toUpperCase()}
              {price ? ` · ${price}` : ""}
              {` · ${(trade.status || "—").toString().toUpperCase()}`}
            </div>
          </div>
        );
      })}
    </>
  );
}

function PanelFeeds() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    const shell = svg?.parentElement;
    if (!svg || !shell) return;
    const draw = () => {
      const wide = window.matchMedia("(min-width: 1280px)").matches;
      svg.replaceChildren();
      if (!wide) return;
      const shellBox = shell.getBoundingClientRect();
      const stage = shell.querySelector(".td-viz-stage");
      if (!stage) return;
      const stageBox = stage.getBoundingClientRect();
      const cards = [...shell.querySelectorAll<HTMLElement>(".td-bot")];
      const book = shell.querySelector(".td-log-card");
      if (!book) return;
      const bookBox = book.getBoundingClientRect();
      cards.forEach((card) => {
        const box = card.getBoundingClientRect();
        const color = getComputedStyle(card).borderTopColor || "#888";
        const y = Math.min(stageBox.bottom - 10, Math.max(stageBox.top + 10, box.top + box.height / 2)) - shellBox.top;
        const y1 = box.top + box.height / 2 - shellBox.top;
        const x1 = box.right - shellBox.left;
        const x2 = stageBox.left - shellBox.left + 4;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const mid = (x1 + x2) / 2;
        path.setAttribute("d", `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y}, ${x2} ${y}`);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", color);
        path.setAttribute("stroke-width", "1.1");
        path.setAttribute("opacity", "0.75");
        svg.appendChild(path);
        const yb = Math.min(bookBox.bottom - 16, Math.max(bookBox.top + 16, box.top + box.height / 2)) - shellBox.top;
        const xb1 = bookBox.left - shellBox.left;
        const xb2 = stageBox.right - shellBox.left - 4;
        const pathR = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const midR = (xb1 + xb2) / 2;
        pathR.setAttribute("d", `M ${xb1} ${yb} C ${midR} ${yb}, ${midR} ${y}, ${xb2} ${y}`);
        pathR.setAttribute("fill", "none");
        pathR.setAttribute("stroke", color);
        pathR.setAttribute("stroke-width", "1.1");
        pathR.setAttribute("opacity", "0.55");
        svg.appendChild(pathR);
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(shell);
    window.addEventListener("resize", draw);
    const timer = window.setInterval(draw, 1000);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", draw);
      window.clearInterval(timer);
    };
  }, []);
  return <svg ref={ref} className="td-feeds" aria-hidden />;
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function TimeTick({
  x = 0,
  y = 0,
  payload,
  index = 0,
  visibleTicksCount = 0,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  index?: number;
  visibleTicksCount?: number;
}) {
  const last = visibleTicksCount > 0 && index === visibleTicksCount - 1;
  const anchor = index === 0 ? "start" : last ? "end" : "middle";
  return (
    <text
      x={x}
      y={y}
      dy={14}
      textAnchor={anchor}
      fill="#737373"
      fontSize={10}
      fontFamily="JetBrains Mono, ui-monospace, monospace"
    >
      {payload?.value}
    </text>
  );
}

function SeriesDot(props: { cx?: number; cy?: number; value?: number | null; color: string }) {
  const { cx, cy, value, color } = props;
  if (value == null || cx == null || cy == null || Number.isNaN(cx) || Number.isNaN(cy)) return null;
  return <circle cx={cx} cy={cy} r={3.5} fill={color} />;
}

function EquityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string | null; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((item) => item.value != null && Number.isFinite(Number(item.value)));
  return (
    <div className="td-tip">
      <div className="td-tip-label">{label}</div>
      {rows.map((item) => (
        <div key={String(item.name)} className="td-tip-row">
          <span style={{ color: item.color }}>{item.name}</span>
          <span>{`$${Number(item.value).toFixed(2)}`}</span>
        </div>
      ))}
    </div>
  );
}
