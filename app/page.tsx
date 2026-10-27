 "use client";

import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabase";

interface EquityPoint { timestamp: string; equity: number; bot: string; }

export default function Dashboard() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => {
      fetchAll();
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 10000);
    return () => clearInterval(interval);
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
    <div style={{
      minHeight: "100vh",
      background: "#050505",
      color: "#e8e8e8",
      fontFamily: "system-ui, sans-serif",
      padding: "1.25rem",
      transition: "all 0.3s ease"
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.3rem", letterSpacing: "0.08em", color: "#ccc" }}>TRADING BOTS</h1>
          <div style={{
            fontSize: "0.75rem",
            color: pulse ? "#22c55e" : "#555",
            transition: "color 0.3s",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem"
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: pulse ? "#22c55e" : "#333",
              boxShadow: pulse ? "0 0 8px #22c55e" : "none",
              transition: "all 0.3s"
            }} />
            LIVE
          </div>
        </div>

        <div style={{
          background: "#0d0d0d",
          border: "1px solid #1a1a1a",
          borderRadius: 14,
          padding: "1.5rem",
          marginBottom: "1rem",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "0.75rem", color: "#666", letterSpacing: "0.1em" }}>EQUITY TOTAL</div>
          <div style={{
            fontSize: "2.8rem",
            fontWeight: 700,
            margin: "0.25rem 0",
            transition: "transform 0.2s",
            transform: pulse ? "scale(1.02)" : "scale(1)"
          }}>
            ${totalEquity.toFixed(2)}
          </div>
          <div style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444", fontSize: "1.1rem" }}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)} USDT
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
          {bots.map(bot => {
            const pnl = latest[bot] - 1000;
            return (
              <div key={bot} style={{
                background: "#0d0d0d",
                border: "1px solid #1a1a1a",
                borderRadius: 12,
                padding: "1.1rem",
                transition: "border-color 0.3s",
                borderColor: pulse ? "#222" : "#1a1a1a"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600 }}>{bot}</span>
                  <span style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444", fontSize: "0.9rem" }}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>${latest[bot].toFixed(2)}</div>
                <div style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.3rem" }}>Sem posições • Tendência</div>
              </div>
            );
          })}
        </div>

        <div style={{
          background: "#0d0d0d",
          border: "1px solid #1a1a1a",
          borderRadius: 14,
          padding: "1.25rem"
        }}>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.08em", color: "#555", marginBottom: "0.75rem" }}>EQUITY CURVE</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="BTC" stroke="#d4a017" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
              <Line type="monotone" dataKey="ETH" stroke="#888" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
              <Line type="monotone" dataKey="SOL" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ textAlign: "center", marginTop: "1.5rem", color: "#333", fontSize: "0.75rem" }}>
          Atualização a cada 10s • Paper Trading
        </div>
      </div>
    </div>
  );
}

