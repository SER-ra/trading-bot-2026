 "use client";

import { useEffect, useState, useRef } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabase";

interface EquityPoint { timestamp: string; equity: number; bot: string; }

export default function Dashboard() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;
    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.2 + 0.3
      });
    }

    let anim: number;
    function draw() {
      ctx!.fillStyle = "rgba(5,5,5,0.15)";
      ctx!.fillRect(0, 0, w, h);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(34,197,94,0.35)";
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
      .order("timestamp", { ascending: true })
      .limit(200);
    if (data) setEquity(data);
  }

  const bots = ["BTC", "ETH", "SOL"];
  const latest: Record<string, number> = {};
  bots.forEach(b => {
    const last = [...equity].reverse().find(e => e.bot === b);
    latest[b] = last ? Number(last.equity) : 1000;
  });

  const totalEquity = Object.values(latest).reduce((a, b) => a + b, 0);
  const totalPnl = totalEquity - 3000;

  const chartData = equity.reduce((acc: any[], point) => {
    const time = new Date(point.timestamp).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    let entry = acc.find(e => e.time === time);
    if (!entry) { entry = { time }; acc.push(entry); }
    entry[point.bot] = Number(point.equity);
    return acc;
  }, []);

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#050505", color: "#d0d0d0", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, padding: "1.25rem", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ letterSpacing: "0.15em", fontSize: "0.85rem", color: "#888" }}>TRADING TERMINAL</div>
          <div style={{ fontSize: "0.75rem", color: "#22c55e" }}>● LIVE</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div style={panel}>
            <div style={label}>EQUITY</div>
            <div style={{ fontSize: "2rem", fontWeight: 700 }}>${totalEquity.toFixed(2)}</div>
            <div style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444", marginTop: "0.25rem" }}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
            </div>
          </div>

          <div style={{ ...panel, height: 220 }}>
            <div style={label}>EQUITY CURVE</div>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="BTC" stroke="#d4a017" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="ETH" stroke="#888" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="SOL" stroke="#22c55e" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={panel}>
            <div style={label}>STATUS</div>
            <div style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
              Posições abertas: <strong>0</strong><br />
              Limite diário: <strong>300 $</strong><br />
              Risco / trade: <strong>1%</strong>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          {bots.map(bot => {
            const pnl = latest[bot] - 1000;
            return (
              <div key={bot} style={panel}>
                <div style={label}>{bot}</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>${latest[bot].toFixed(2)}</div>
                <div style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444", fontSize: "0.85rem" }}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "rgba(12,12,12,0.85)",
  border: "1px solid #1a1a1a",
  borderRadius: 8,
  padding: "1rem",
  backdropFilter: "blur(4px)"
};

const label: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.1em",
  color: "#666",
  marginBottom: "0.5rem"
};

