 "use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabase";

interface EquityPoint { timestamp: string; equity: number; bot: string; }

export default function Dashboard() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 20000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAll() {
    const { data } = await supabase
      .from("equity_history")
      .select("*")
      .order("timestamp", { ascending: true })
      .limit(300);
    if (data) setEquity(data);
  }

  const bots = ["BTC", "ETH", "SOL"];

  const getBotData = (bot: string) => {
    return equity
      .filter(e => e.bot === bot)
      .map(e => ({ equity: Number(e.equity) }));
  };

  const latest: Record<string, number> = {};
  bots.forEach(b => {
    const last = [...equity].reverse().find(e => e.bot === b);
    latest[b] = last ? Number(last.equity) : 1000;
  });

  const totalEquity = Object.values(latest).reduce((a, b) => a + b, 0);
  const totalPnl = totalEquity - 3000;
  const totalPnlPct = (totalPnl / 3000) * 100;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#e5e5e5",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "1.5rem"
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600 }}>Trading Bots</h1>
          <div style={{ color: "#888", fontSize: "0.85rem" }}>Paper Trading • 1.000 $ / bot</div>
        </div>

        {/* Top summary */}
        <div style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 12,
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
          display: "flex",
          gap: "2rem",
          flexWrap: "wrap"
        }}>
          <div>
            <div style={{ color: "#888", fontSize: "0.8rem" }}>Equity Total</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 600 }}>${totalEquity.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ color: "#888", fontSize: "0.8rem" }}>PnL</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 600, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)} ({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%)
            </div>
          </div>
          <div>
            <div style={{ color: "#888", fontSize: "0.8rem" }}>Posições Abertas</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 600 }}>0</div>
          </div>
        </div>

        {/* Bot cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {bots.map(bot => {
            const data = getBotData(bot);
            const eq = latest[bot];
            const pnl = eq - 1000;
            const pnlPct = (pnl / 1000) * 100;
            return (
              <div key={bot} style={{
                background: "#111",
                border: "1px solid #222",
                borderRadius: 12,
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{bot}</div>
                  <div style={{ fontSize: "0.75rem", color: "#888", background: "#1a1a1a", padding: "0.2rem 0.5rem", borderRadius: 6 }}>
                    Paper
                  </div>
                </div>
                <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>${eq.toFixed(2)}</div>
                <div style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444", fontSize: "0.95rem" }}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                </div>
                <div style={{ height: 60, marginTop: "0.5rem" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.length ? data : [{ equity: 1000 }]}>
                      <defs>
                        <linearGradient id={`grad-${bot}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={pnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={pnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke={pnl >= 0 ? "#22c55e" : "#ef4444"}
                        fill={`url(#grad-${bot})`}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                  Estratégia: Tendência • Sem posições
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "2rem", color: "#555", fontSize: "0.8rem", textAlign: "center" }}>
          Atualização automática a cada 20s • Capital inicial 3.000 $
        </div>
      </div>
    </div>
  );
}

