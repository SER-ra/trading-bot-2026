 "use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
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
  const colors: Record<string, string> = { BTC: "#d4a017", ETH: "#c0c0c0", SOL: "#a8a8a8" };

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
      background: "#0d0d0d",
      color: "#e5e5e5",
      fontFamily: "system-ui, sans-serif",
      padding: "2rem"
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <h1 style={{ fontSize: "2.2rem", color: "#fff", marginBottom: "0.25rem", letterSpacing: "-0.02em" }}>
          Trading Bots
        </h1>
        <p style={{ color: "#888", marginTop: 0, marginBottom: "2rem" }}>
          Paper Trading • 1.000 $ por bot • Atualização a cada 20s
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <Card title="Equity Total" value={`$${totalEquity.toFixed(2)}`} sub={totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `$${totalPnl.toFixed(2)}`} positive={totalPnl >= 0} />
          {bots.map(bot => (
            <Card key={bot} title={bot} value={`$${latest[bot].toFixed(2)}`} sub="Sem posições abertas" />
          ))}
        </div>

        <div style={{
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          padding: "1.5rem",
          marginBottom: "2rem"
        }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", color: "#ccc" }}>Curva de Equity</h2>
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={chartData}>
              <defs>
                {bots.map(bot => (
                  <linearGradient key={bot} id={`g${bot}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[bot]} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={colors[bot]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="#222" strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }} />
              <Legend />
              {bots.map(bot => (
                <Area key={bot} type="monotone" dataKey={bot} stroke={colors[bot]} fill={`url(#g${bot})`} strokeWidth={2} dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          padding: "1.5rem"
        }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", color: "#ccc" }}>Últimos Trades</h2>
          {trades.length === 0 ? (
            <p style={{ color: "#666", margin: 0 }}>Nenhum trade registado. Os bots estão em modo de vigilância.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #333", textAlign: "left", color: "#888" }}>
                  <th style={{ padding: "0.75rem" }}>Bot</th>
                  <th style={{ padding: "0.75rem" }}>Símbolo</th>
                  <th style={{ padding: "0.75rem" }}>Lado</th>
                  <th style={{ padding: "0.75rem" }}>PnL</th>
                  <th style={{ padding: "0.75rem" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: "0.75rem" }}>{t.bot}</td>
                    <td style={{ padding: "0.75rem" }}>{t.symbol}</td>
                    <td style={{ padding: "0.75rem" }}>{t.side}</td>
                    <td style={{ padding: "0.75rem", color: (t.pnl || 0) >= 0 ? "#4ade80" : "#f87171" }}>
                      {t.pnl != null ? `$${Number(t.pnl).toFixed(2)}` : "—"}
                    </td>
                    <td style={{ padding: "0.75rem" }}>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, sub, positive }: any) {
  return (
    <div style={{
      background: "#141414",
      border: "1px solid #2a2a2a",
      borderRadius: 10,
      padding: "1.25rem"
    }}>
      <div style={{ color: "#888", fontSize: "0.85rem" }}>{title}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 600, color: "#fff", margin: "0.25rem 0" }}>{value}</div>
      {sub && <div style={{ color: positive === false ? "#f87171" : positive ? "#4ade80" : "#666", fontSize: "0.9rem" }}>{sub}</div>}
    </div>
  );
}

