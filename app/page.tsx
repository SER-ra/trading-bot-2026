 "use client";

import { useEffect, useState, useRef } from "react";
import { AreaChart, Area, ResponsiveContainer, ComposedChart, Bar, Line } from "recharts";
import { supabase } from "../lib/supabase";

interface EquityPoint { timestamp: string; equity: number; bot: string; }
interface Candle { time: string; open: number; high: number; low: number; close: number; }

const STARTING_CAPITAL = 250;
const BOTS = ["BTC", "ETH", "SOL", "XRP"];
const SYMBOLS: Record<string, string> = { BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", XRP: "XRPUSDT" };
const COLORS: Record<string, string> = { BTC: "#d4a017", ETH: "#888", SOL: "#22c55e", XRP: "#a0a0a0" };

export default function Dashboard() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [candles, setCandles] = useState<Record<string, Candle[]>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
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
    const particles: { angle: number; radius: number; speed: number; size: number; color: string }[] = [];

    for (let i = 0; i < 120; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 50 + Math.random() * 90,
        speed: 0.001 + Math.random() * 0.002,
        size: Math.random() * 1.2 + 0.3,
        color: Math.random() > 0.7 ? "rgba(34,197,94,0.4)" : "rgba(140,140,140,0.2)"
      });
    }

    let anim: number;
    function draw() {
      ctx!.fillStyle = "rgba(5,5,5,0.2)";
      ctx!.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      particles.forEach(p => {
        p.angle += p.speed;
        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius * 0.35;
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
    const { data } = await supabase
      .from("equity_history")
      .select("*")
      .gte("timestamp", "2026-10-27T15:00:00")
      .order("timestamp", { ascending: true })
      .limit(400);
    if (data) setEquity(data);

    const candleData: Record<string, Candle[]> = {};
    for (const bot of BOTS) {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${SYMBOLS[bot]}&interval=15m&limit=40`);
        const json = await res.json();
        candleData[bot] = json.map((k: any) => ({
          time: new Date(k[0]).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4])
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

  const getBotChart = (bot: string) =>
    equity.filter(e => e.bot === bot).map(e => ({ equity: Number(e.equity) }));

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#050505", color: "#d4d4d4", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, padding: "1rem", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ letterSpacing: "0.2em", fontSize: "0.75rem", color: "#777" }}>TRADING TERMINAL</div>
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
          <div style={{ fontSize: "0.7rem", color: "#666", letterSpacing: "0.1em" }}>TOTAL EQUITY</div>
          <div style={{ fontSize: "2.4rem", fontWeight: 700, margin: "0.2rem 0" }}>${totalEquity.toFixed(2)}</div>
          <div style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0.75rem" }}>
          {BOTS.map(bot => {
            const data = getBotChart(bot);
            const eq = latest[bot];
            const pnl = eq - STARTING_CAPITAL;
            const color = COLORS[bot];
            const candleData = candles[bot] || [];
            return (
              <div key={bot} style={{
                background: "rgba(10,10,10,0.75)",
                border: "1px solid #1c1c1c",
                borderRadius: 12,
                padding: "1rem 1.1rem",
                backdropFilter: "blur(6px)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
                  <span style={{ fontWeight: 600 }}>{bot}</span>
                  <span style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444", fontSize: "0.9rem" }}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>${eq.toFixed(2)}</div>

                <div style={{ height: 70, marginBottom: "0.6rem" }}>
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

                <div style={{ fontSize: "0.65rem", color: "#555", marginBottom: "0.3rem" }}>15m Candles</div>
                <div style={{ height: 80 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={candleData}>
                      <Bar dataKey="close" fill="#333" />
                      <Line type="monotone" dataKey="close" stroke={color} strokeWidth={1.2} dot={false} />
                    </ComposedChart>
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

