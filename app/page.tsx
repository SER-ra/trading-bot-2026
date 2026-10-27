"use client";

import { useEffect, useState, useRef } from "react";
import { AreaChart, Area, ResponsiveContainer, LineChart, Line } from "recharts";
import { supabase } from "../lib/supabase";

interface EquityPoint { timestamp: string; equity: number; bot: string; }
interface Trade { id: string; bot: string; side: string; status: string; quantity?: number; entry_price?: number; pnl?: number; }
interface Candle { time: string; close: number; ema9?: number; ema21?: number; rsi?: number; }

const STARTING_CAPITAL = 250;
const BOTS = ["BTC", "ETH", "SOL", "XRP"];
const SYMBOLS: Record<string, string> = { BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", XRP: "XRPUSDT" };
const COLORS: Record<string, string> = { BTC: "#d4a017", ETH: "#888", SOL: "#22c55e", XRP: "#a0a0a0" };

function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) ema.push(data[i]);
    else if (i === period - 1) ema.push(prev);
    else {
      prev = data[i] * k + prev * (1 - k);
      ema.push(prev);
    }
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = 0; i < closes.length; i++) {
    if (i < period) { rsi.push(50); continue; }
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

export default function Dashboard() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [candles, setCandles] = useState<Record<string, Candle[]>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;
    const particles: { angle: number; radius: number; speed: number; size: number; color: string }[] = [];

    for (let i = 0; i < 100; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 40 + Math.random() * 100,
        speed: 0.001 + Math.random() * 0.0015,
        size: Math.random() * 1.1 + 0.25,
        color: Math.random() > 0.75 ? "rgba(34,197,94,0.35)" : "rgba(130,130,130,0.18)"
      });
    }

    let anim: number;
    function draw() {
      ctx!.fillStyle = "rgba(5,5,5,0.22)";
      ctx!.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      particles.forEach(p => {
        p.angle += p.speed;
        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius * 0.32;
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

  async function fetchAll() {
    const [eq, tr] = await Promise.all([
      supabase.from("equity_history").select("*").gte("timestamp", "2026-10-27T15:00:00").order("timestamp", { ascending: true }).limit(400),
      supabase.from("trades").select("*").order("opened_at", { ascending: false }).limit(200)
    ]);
    if (eq.data) setEquity(eq.data);
    if (tr.data) setTrades(tr.data);

    const candleData: Record<string, Candle[]> = {};
    for (const bot of BOTS) {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${SYMBOLS[bot]}&interval=15m&limit=50`);
        const json = await res.json();
        const closes = json.map((k: any) => parseFloat(k[4]));
        const ema9 = calcEMA(closes, 9);
        const ema21 = calcEMA(closes, 21);
        const rsi = calcRSI(closes, 14);
        candleData[bot] = json.map((k: any, i: number) => ({
          time: new Date(k[0]).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
          close: closes[i],
          ema9: ema9[i],
          ema21: ema21[i],
          rsi: rsi[i]
        }));
      } catch {
        candleData[bot] = [];
      }
    }
    setCandles(candleData);
  }

  const latest: Record<string, number> = {};
  BOTS.forEach(b => {
    const last = [...equity].reverse().find(e => e.bot === b);
    latest[b] = last ? Number(last.equity) : STARTING_CAPITAL;
  });

  const totalEquity = Object.values(latest).reduce((a, b) => a + b, 0);
  const totalStart = STARTING_CAPITAL * BOTS.length;
  const totalPnl = totalEquity - totalStart;
  const pnlColor = totalPnl >= 0 ? "#22c55e" : "#ef4444";

  const getBotStats = (bot: string) => {
    const botTrades = trades.filter(t => t.bot === bot);
    const entries = botTrades.filter(t => t.status === "open" || t.status === "closed").length;
    const exits = botTrades.filter(t => t.status === "closed").length;
    const openTrades = botTrades.filter(t => t.status === "open");
    const allocated = openTrades.reduce((sum, t) => sum + ((t.quantity || 0) * (t.entry_price || 0)), 0);
    return { entries, exits, allocated };
  };

  const getBotChart = (bot: string) =>
    equity.filter(e => e.bot === bot).map(e => ({ equity: Number(e.equity) }));

  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      background: "#050505",
      color: "#d4d4d4",
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Roboto Mono', monospace",
      overflow: "hidden"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, padding: "1rem", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ letterSpacing: "0.15em", fontSize: "0.75rem", color: "#777" }}>TRADING TERMINAL</div>
          <div style={{ fontSize: "0.7rem", color: "#22c55e" }}>● LIVE</div>
        </div>

        <div style={{
          background: "rgba(10,10,10,0.8)",
          border: "1px solid #1c1c1c",
          borderRadius: 12,
          padding: "1.25rem",
          marginBottom: "1rem",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "0.65rem", color: "#666", letterSpacing: "0.12em" }}>TOTAL EQUITY</div>
          <div style={{ fontSize: "2.2rem", fontWeight: 600, margin: "0.2rem 0" }}>${totalEquity.toFixed(2)}</div>
          <div style={{ fontSize: "1.15rem", fontWeight: 600, color: pnlColor }}>
            DIA {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.75rem" }}>
          {BOTS.map(bot => {
            const data = getBotChart(bot);
            const eq = latest[bot];
            const pnl = eq - STARTING_CAPITAL;
            const color = COLORS[bot];
            const candleData = candles[bot] || [];
            const last = candleData[candleData.length - 1];
            const stats = getBotStats(bot);
            const botPnlColor = pnl >= 0 ? "#22c55e" : "#ef4444";
            return (
              <div key={bot} style={{
                background: "rgba(10,10,10,0.75)",
                border: "1px solid #1c1c1c",
                borderRadius: 12,
                padding: "1rem 1.1rem",
                backdropFilter: "blur(6px)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.3rem" }}>
                  <span style={{ fontWeight: 600 }}>{bot}</span>
                  <span style={{ color: botPnlColor, fontSize: "0.85rem", fontWeight: 600 }}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: "0.35rem" }}>${eq.toFixed(2)}</div>

                <div style={{ display: "flex", gap: "1rem", fontSize: "0.68rem", color: "#888", marginBottom: "0.5rem" }}>
                  <span>IN: <strong style={{ color: "#ccc" }}>{stats.entries}</strong></span>
                  <span>OUT: <strong style={{ color: "#ccc" }}>{stats.exits}</strong></span>
                  <span>ALLOC: <strong style={{ color: "#ccc" }}>${stats.allocated.toFixed(0)}</strong></span>
                </div>

                {last && (
                  <div style={{ display: "flex", gap: "0.6rem", fontSize: "0.65rem", color: "#666", marginBottom: "0.4rem" }}>
                    <span>RSI <strong style={{ color: last.rsi! > 70 ? "#ef4444" : last.rsi! < 30 ? "#22c55e" : "#aaa" }}>{last.rsi?.toFixed(0)}</strong></span>
                    <span>EMA9 {last.ema9?.toFixed(1)}</span>
                  </div>
                )}

                <div style={{ height: 55, marginBottom: "0.4rem" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.length ? data : [{ equity: STARTING_CAPITAL }]}>
                      <defs>
                        <linearGradient id={`g-${bot}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="equity" stroke={color} fill={`url(#g-${bot})`} strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ height: 70 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={candleData}>
                      <Line type="monotone" dataKey="close" stroke="#444" strokeWidth={1} dot={false} />
                      <Line type="monotone" dataKey="ema9" stroke={color} strokeWidth={1.2} dot={false} />
                      <Line type="monotone" dataKey="ema21" stroke="#555" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
