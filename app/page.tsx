"use client";

import { useEffect, useState, useRef } from "react";
import { AreaChart, Area, ResponsiveContainer, LineChart, Line } from "recharts";
import { supabase } from "../lib/supabase";

interface EquityPoint { timestamp: string; equity: number; bot: string; }
interface Trade { id: string; bot: string; side: string; status: string; quantity?: number; entry_price?: number; pnl?: number; }

const STARTING_CAPITAL = 250;
const BOTS = ["BTC", "ETH", "SOL", "XRP"];
const COLORS: Record<string, string> = { BTC: "#d4a017", ETH: "#888", SOL: "#22c55e", XRP: "#a0a0a0" };

export default function Dashboard() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;
    const particles: any[] = [];
    for (let i = 0; i < 70; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 40 + Math.random() * 90,
        speed: 0.001 + Math.random() * 0.0012,
        size: Math.random() * 1 + 0.3,
        color: Math.random() > 0.7 ? "rgba(34,197,94,0.3)" : "rgba(120,120,120,0.15)"
      });
    }
    let anim: number;
    function draw() {
      ctx!.fillStyle = "rgba(5,5,5,0.25)";
      ctx!.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      particles.forEach(p => {
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
    const onResize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(anim); window.removeEventListener("resize", onResize); };
  }, []);

  async function fetchAll() {
    const [eq, tr] = await Promise.all([
      supabase.from("equity_history").select("*").gte("timestamp", "2026-10-27T15:00:00").order("timestamp", { ascending: true }).limit(500),
      supabase.from("trades").select("*").order("opened_at", { ascending: false }).limit(300)
    ]);
    if (eq.data) setEquity(eq.data);
    if (tr.data) setTrades(tr.data);
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

  const closedTrades = trades.filter(t => t.status === "closed");
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
  const winRate = closedTrades.length ? (wins / closedTrades.length) * 100 : 0;

  // Equity curve for total
  const equityCurve = equity.reduce((acc: any[], p) => {
    const time = new Date(p.timestamp).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    let entry = acc.find(e => e.time === time);
    if (!entry) { entry = { time }; acc.push(entry); }
    entry[p.bot] = Number(p.equity);
    return acc;
  }, []);

  // Drawdown calculation (simple peak-to-current)
  let peak = totalStart;
  let maxDD = 0;
  equity.forEach(p => {
    const eq = Number(p.equity);
    if (eq > peak) peak = eq;
    const dd = (peak - eq) / peak;
    if (dd > maxDD) maxDD = dd;
  });
  const currentDD = peak > 0 ? ((peak - totalEquity) / peak) * 100 : 0;

  const getBotChart = (bot: string) => equity.filter(e => e.bot === bot).map(e => ({ equity: Number(e.equity) }));

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#050505", color: "#d4d4d4", fontFamily: "'JetBrains Mono', monospace", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <link rel="manifest" href="/manifest.json" />
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, padding: "0.8rem", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.9rem" }}>
          <div style={{ letterSpacing: "0.12em", fontSize: "0.7rem", color: "#777" }}>TRADING</div>
          <div style={{ fontSize: "0.65rem", color: "#22c55e" }}>● LIVE</div>
        </div>

        {/* Main summary */}
        <div style={{ background: "rgba(10,10,10,0.85)", border: "1px solid #1c1c1c", borderRadius: 14, padding: "1rem", marginBottom: "0.75rem", textAlign: "center" }}>
          <div style={{ fontSize: "0.6rem", color: "#666" }}>TOTAL EQUITY</div>
          <div style={{ fontSize: "1.9rem", fontWeight: 600 }}>${totalEquity.toFixed(2)}</div>
          <div style={{ fontSize: "1.05rem", fontWeight: 600, color: pnlColor }}>
            DIA {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
          </div>
        </div>

        {/* Metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <div style={metricCard}>
            <div style={metricLabel}>WIN RATE</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: winRate >= 50 ? "#22c55e" : "#ef4444" }}>{winRate.toFixed(0)}%</div>
          </div>
          <div style={metricCard}>
            <div style={metricLabel}>DRAWDOWN</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: currentDD > 5 ? "#ef4444" : "#ccc" }}>{currentDD.toFixed(1)}%</div>
          </div>
          <div style={metricCard}>
            <div style={metricLabel}>TRADES</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{closedTrades.length}</div>
          </div>
        </div>

        {/* Total equity chart */}
        <div style={{ background: "rgba(10,10,10,0.75)", border: "1px solid #1c1c1c", borderRadius: 12, padding: "0.8rem", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.6rem", color: "#666", marginBottom: "0.4rem" }}>EQUITY TOTAL</div>
          <div style={{ height: 90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve}>
                <defs>
                  <linearGradient id="totalG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="BTC" stroke="#d4a017" fill="none" strokeWidth={1.2} dot={false} />
                <Area type="monotone" dataKey="ETH" stroke="#888" fill="none" strokeWidth={1.2} dot={false} />
                <Area type="monotone" dataKey="SOL" stroke="#22c55e" fill="none" strokeWidth={1.2} dot={false} />
                <Area type="monotone" dataKey="XRP" stroke="#aaa" fill="none" strokeWidth={1.2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bot cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "0.6rem" }}>
          {BOTS.map(bot => {
            const data = getBotChart(bot);
            const eq = latest[bot];
            const pnl = eq - STARTING_CAPITAL;
            const color = COLORS[bot];
            const botTrades = closedTrades.filter(t => t.bot === bot);
            const botWins = botTrades.filter(t => (t.pnl || 0) > 0).length;
            const botWR = botTrades.length ? (botWins / botTrades.length) * 100 : 0;
            return (
              <div key={bot} style={{ background: "rgba(10,10,10,0.75)", border: "1px solid #1c1c1c", borderRadius: 12, padding: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>{bot}</span>
                  <span style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444", fontSize: "0.8rem" }}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: "1.15rem", fontWeight: 600, margin: "0.2rem 0" }}>${eq.toFixed(2)}</div>
                <div style={{ fontSize: "0.6rem", color: "#666", marginBottom: "0.3rem" }}>WR {botWR.toFixed(0)}% · {botTrades.length} trades</div>
                <div style={{ height: 45 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.length ? data : [{ equity: STARTING_CAPITAL }]}>
                      <Area type="monotone" dataKey="equity" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
                    </AreaChart>
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

const metricCard: React.CSSProperties = {
  background: "rgba(10,10,10,0.75)",
  border: "1px solid #1c1c1c",
  borderRadius: 10,
  padding: "0.7rem",
  textAlign: "center"
};
const metricLabel: React.CSSProperties = {
  fontSize: "0.55rem",
  color: "#666",
  letterSpacing: "0.08em",
  marginBottom: "0.2rem"
};
