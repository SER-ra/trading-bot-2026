 "use client";

import { useEffect, useState, useRef } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabase";

interface EquityPoint { timestamp: string; equity: number; bot: string; }

const STARTING_CAPITAL = 250;
const BOTS = ["BTC", "ETH", "SOL", "XRP"];

export default function Dashboard() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 8000);
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

    for (let i = 0; i < 160; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 70 + Math.random() * 70,
        speed: 0.0015 + Math.random() * 0.0025,
        size: Math.random() * 1.4 + 0.3,
        color: Math.random() > 0.65 ? "rgba(34,197,94,0.5)" : "rgba(160,160,160,0.3)"
      });
    }

    let anim: number;
    function draw() {
      ctx!.fillStyle = "rgba(5,5,5,0.18)";
      ctx!.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      particles.forEach(p => {
        p.angle += p.speed;
        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius * 0.4;
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
      .limit(300);
    if (data) setEquity(data);
  }

  const latest: Record<string, number> = {};
  BOTS.forEach(b => {
    const last = [...equity].reverse().find(e => e.bot === b);
    latest[b] = last ? Number(last.equity) : STARTING_CAPITAL;
  });

  const totalEquity = Object.values(latest).reduce((a, b) => a + b, 0);
  const totalStart = STARTING_CAPITAL * BOTS.length;
  const totalPnl = totalEquity - totalStart;

  const chartData = equity.reduce((acc: any[], point) => {
    const time = new Date(point.timestamp).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    let entry = acc.find(e => e.time === time);
    if (!entry) { entry = { time }; acc.push(entry); }
    entry[point.bot] = Number(point.equity);
    return acc;
  }, []);

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#050505", color: "#d4d4d4", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, padding: "1rem", maxWidth: 1500, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ letterSpacing: "0.2em", fontSize: "0.75rem", color: "#777" }}>TRADING TERMINAL</div>
          <div style={{ fontSize: "0.7rem", color: "#22c55e", letterSpacing: "0.1em" }}>● LIVE</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 280px", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div style={panel}>
            <div style={label}>TOTAL EQUITY</div>
            <div style={{ fontSize: "2.1rem", fontWeight: 700 }}>${totalEquity.toFixed(2)}</div>
            <div style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444", marginTop: "0.3rem", fontSize: "1.05rem" }}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
            </div>
            <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#666", lineHeight: 1.7 }}>
              Capital inicial<br />{totalStart} $<br /><br />
              Limite diário<br />125 $<br /><br />
              Risco / trade<br />2.50 $
            </div>
          </div>

          <div style={{ ...panel, minHeight: 260, display: "flex", flexDirection: "column" }}>
            <div style={label}>EQUITY CURVE</div>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line type="monotone" dataKey="BTC" stroke="#d4a017" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="ETH" stroke="#888" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="SOL" stroke="#22c55e" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="XRP" stroke="#aaa" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={panel}>
            <div style={label}>BOTS</div>
            {BOTS.map(bot => {
              const pnl = latest[bot] - STARTING_CAPITAL;
              return (
                <div key={bot} style={{ marginBottom: "0.7rem", paddingBottom: "0.7rem", borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#888" }}>
                    <span>{bot}</span>
                    <span style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444" }}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: "0.1rem" }}>${latest[bot].toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div style={panel}>
            <div style={label}>ESTRATÉGIA</div>
            <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#aaa" }}>
              Tendência (EMAs + RSI + volume)<br />
              Capital: 250 $ por bot<br />
              Stop-loss obrigatório • Max 3x<br />
              Max 2 posições
            </div>
          </div>
          <div style={panel}>
            <div style={label}>STATUS</div>
            <div style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#aaa" }}>
              4 bots em vigilância<br />
              Nenhuma posição aberta<br />
              Total inicial: 1.000 $<br />
              Atualização a cada 8s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "rgba(10,10,10,0.75)",
  border: "1px solid #1c1c1c",
  borderRadius: 10,
  padding: "1rem 1.1rem",
  backdropFilter: "blur(6px)"
};

const label: React.CSSProperties = {
  fontSize: "0.6rem",
  letterSpacing: "0.12em",
  color: "#555",
  marginBottom: "0.6rem"
};

