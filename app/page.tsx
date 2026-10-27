 "use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar
} from "recharts";
import { supabase } from "../lib/supabase";

interface EquityPoint { timestamp: string; equity: number; bot: string; }
interface Trade { id: string; bot: string; symbol: string; side: string; pnl: number | null; status: string; opened_at: string; }

export default function Dashboard() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 20000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAll() {
    const [eq, tr] = await Promise.all([
      supabase.from("equity_history").select("*").order("timestamp", { ascending: true }).limit(300),
      supabase.from("trades").select("*").order("opened_at", { ascending: false }).limit(50)
    ]);
    if (eq.data) setEquity(eq.data);
    if (tr.data) setTrades(tr.data);
    setLoading(false);
  }

  const bots = ["BTC", "ETH", "SOL"];
  const colors: Record<string, string> = { BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195" };

  const chartData = equity.reduce((acc: any[], point) => {
    const time = new Date(point.timestamp).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    let entry = acc.find(e => e.time === time);
    if (!entry) { entry = { time }; acc.push(entry); }
    entry[point.bot] = Number(point.equity);
    return acc;
  }, []);

  const latest: Record<string, number> = {};
  bots.forEach(b => {
    const last = [...equity].reverse().find(e => e.bot === b);
    latest[b] = last ? Number(last.equity) : 1000;
  });

  const totalEquity = Object.values(latest).reduce((a, b) => a + b, 0);
  const totalPnl = totalEquity - 3000;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)",
      color: "#e0e0e0",
      fontFamily: "system-ui, sans-serif",
      padding: "2rem"
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{
          fontSize: "2.5rem",
          background: "linear-gradient(90deg, #00f5ff, #a855f7)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "0.5rem"
        }}>
          Trading Bots Control
        </h1>
        <p style={{ color: "#888", marginTop: 0 }}>Paper Trading • Atualização a cada 20s</p>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", margin: "2rem 0" }}>
          <Card title="Equity Total" value={`$${totalEquity.toFixed(2)}`} sub={totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`} positive={totalPnl >= 0} />
          {bots.map(bot => (
            <Card key={bot} title={bot} value={`$${latest[bot].toFixed(2)}`} color={colors[bot]} />
          ))}
        </div>

        {/* Equity chart */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "1.5rem",
          marginBottom: "2rem"
        }}>
          <h2 style={{ marginTop: 0, fontSize: "1.25rem" }}>Curva de Equity</h2>
          <ResponsiveContainer width="100%" height={420}>
            <AreaChart data={chartData}>
              <defs>
                {bots.map(bot => (
                  <linearGradient key={bot} id={`grad${bot}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[bot]} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={colors[bot]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" stroke="#888" />
              <YAxis stroke="#888" domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                labelStyle={{ color: "#fff" }}
              />
              <Legend />
              {bots.map(bot => (
                <Area
                  key={bot}
                  type="monotone"
                  dataKey={bot}
                  stroke={colors[bot]}
                  fill={`url(#grad${bot})`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent trades */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "1.5rem"
        }}>
          <h2 style={{ marginTop: 0, fontSize: "1.25rem" }}>Últimos Trades</h2>
          {trades.length === 0 ? (
            <p style={{ color: "#888" }}>Ainda não há trades registados.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #333", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem" }}>Bot</th>
                    <th style={{ padding: "0.75rem" }}>Símbolo</th>
                    <th style={{ padding: "0.75rem" }}>Lado</th>
                    <th style={{ padding: "0.75rem" }}>PnL</th>
                    <th style={{ padding: "0.75rem" }}>Estado</th>
                    <th style={{ padding: "0.75rem" }}>Aberto</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #222" }}>
                      <td style={{ padding: "0.75rem", color: colors[t.bot] || "#fff" }}>{t.bot}</td>
                      <td style={{ padding: "0.75rem" }}>{t.symbol}</td>
                      <td style={{ padding: "0.75rem", color: t.side === "long" ? "#14f195" : "#ff6b6b" }}>{t.side}</td>
                      <td style={{ padding: "0.75rem", color: (t.pnl || 0) >= 0 ? "#14f195" : "#ff6b6b" }}>
                        {t.pnl != null ? `$${Number(t.pnl).toFixed(2)}` : "—"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>{t.status}</td>
                      <td style={{ padding: "0.75rem", color: "#888" }}>
                        {new Date(t.opened_at).toLocaleString("pt-PT")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, sub, color, positive }: any) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: "1.25rem",
      backdropFilter: "blur(10px)"
    }}>
      <div style={{ color: "#aaa", fontSize: "0.9rem" }}>{title}</div>
      <div style={{ fontSize: "1.75rem", fontWeight: 600, color: color || "#fff", margin: "0.25rem 0" }}>{value}</div>
      {sub && (
        <div style={{ color: positive ? "#14f195" : "#ff6b6b", fontSize: "0.95rem" }}>{sub}</div>
      )}
    </div>
  );
}

