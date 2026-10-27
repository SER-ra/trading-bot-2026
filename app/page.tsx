 "use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, LineChart, Line } from "recharts";
import { supabase } from "../lib/supabase";

interface EquityPoint { timestamp: string; equity: number; bot: string; }
interface Trade { id: string; bot: string; symbol: string; side: string; pnl: number | null; status: string; opened_at: string; }

export default function Dashboard() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 20000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAll() {
    const [eq, tr] = await Promise.all([
      supabase.from("equity_history").select("*").order("timestamp", { ascending: true }).limit(300),
      supabase.from("trades").select("*").order("opened_at", { ascending: false }).limit(20)
    ]);
    if (eq.data) setEquity(eq.data);
    if (tr.data) setTrades(tr.data);
  }

  const bots = ["BTC", "ETH", "SOL"];
  const latest: Record<string, number> = {};
  bots.forEach(b => {
    const last = [...equity].reverse().find(e => e.bot === b);
    latest[b] = last ? Number(last.equity) : 1000;
  });

  const totalEquity = Object.values(latest).reduce((a, b) => a + b, 0);
  const totalPnl = totalEquity - 3000;
  const totalPnlPct = (totalPnl / 3000) * 100;

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
      background: "#0b0e14",
      color: "#c8d0d8",
      fontFamily: "system-ui, sans-serif",
      padding: "1.25rem"
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.25rem", letterSpacing: "0.05em", color: "#7dd3fc" }}>DASHBOARD</h1>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Paper Trading • 1.000 $ / bot</div>
        </div>

        {/* Top stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
          <Widget title="EQUITY TOTAL" value={`$${totalEquity.toFixed(2)}`} sub={`${totalPnl >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%`} positive={totalPnl >= 0} />
          <Widget title="PnL" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`} positive={totalPnl >= 0} />
          <Widget title="POSIÇÕES ABERTAS" value="0" />
          <Widget title="LIMITE DIÁRIO" value="300 $" />
        </div>

        {/* Main chart + side */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div style={widgetStyle}>
            <div style={widgetTitle}>EQUITY CURVE</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="BTC" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ETH" stroke="#94a3b8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="SOL" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {bots.map(bot => (
              <div key={bot} style={{ ...widgetStyle, padding: "0.85rem 1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{bot}</span>
                  <span style={{ color: (latest[bot] - 1000) >= 0 ? "#22c55e" : "#ef4444", fontSize: "0.85rem" }}>
                    {(latest[bot] - 1000) >= 0 ? "+" : ""}{(latest[bot] - 1000).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>${latest[bot].toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Trades */}
        <div style={widgetStyle}>
          <div style={widgetTitle}>ÚLTIMOS TRADES</div>
          {trades.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: "0.9rem" }}>Nenhum trade registado. Bots em vigilância.</div>
          ) : (
            <table style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ color: "#64748b", textAlign: "left" }}>
                  <th style={{ padding: "0.4rem 0" }}>Bot</th>
                  <th>Símbolo</th>
                  <th>Lado</th>
                  <th>PnL</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} style={{ borderTop: "1px solid #1e293b" }}>
                    <td style={{ padding: "0.5rem 0" }}>{t.bot}</td>
                    <td>{t.symbol}</td>
                    <td>{t.side}</td>
                    <td style={{ color: (t.pnl || 0) >= 0 ? "#22c55e" : "#ef4444" }}>
                      {t.pnl != null ? `$${Number(t.pnl).toFixed(2)}` : "—"}
                    </td>
                    <td>{t.status}</td>
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

const widgetStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #1e293b",
  borderRadius: 10,
  padding: "1rem 1.1rem"
};

const widgetTitle: React.CSSProperties = {
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  color: "#64748b",
  marginBottom: "0.75rem"
};

function Widget({ title, value, sub, positive }: any) {
  return (
    <div style={widgetStyle}>
      <div style={widgetTitle}>{title}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 600, color: positive === false ? "#ef4444" : positive ? "#22c55e" : "#e2e8f0" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.8rem", color: positive ? "#22c55e" : "#ef4444", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}

