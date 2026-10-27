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
      .limit(200);
    if (data) setEquity(data);
  }

  const bots = ["BTC", "ETH", "SOL"];
  const getBotData = (bot: string) => equity.filter(e => e.bot === bot).map(e => ({ equity: Number(e.equity) }));

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
      background: "linear-gradient(180deg, #0a0f0a 0%, #0d1510 100%)",
      color: "#e8e8e8",
      fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      padding: "1rem"
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem", paddingTop: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "#666", letterSpacing: "0.05em" }}>PAPER TRADING</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, margin: "0.25rem 0" }}>
            ${totalEquity.toFixed(2)}
          </div>
          <div style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444", fontSize: "0.95rem" }}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)} USDT
          </div>
        </div>

        {/* Bots */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {bots.map(bot => {
            const data = getBotData(bot);
            const eq = latest[bot];
            const pnl = eq - 1000;
            return (
              <div key={bot} style={{
                background: "linear-gradient(135deg, #111 0%, #0f1a12 100%)",
                border: "1px solid #1a2a1a",
                borderRadius: 16,
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem"
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontWeight: 600 }}>{bot}</span>
                    <span style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444", fontSize: "0.9rem" }}>
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0.15rem 0" }}>
                    ${eq.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#666" }}>Sem posições • Tendência</div>
                </div>
                <div style={{ width: 90, height: 48 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.length ? data : [{ equity: 1000 }]}>
                      <defs>
                        <linearGradient id={`g-${bot}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="#22c55e"
                        fill={`url(#g-${bot})`}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: "2rem", color: "#444", fontSize: "0.75rem" }}>
          Atualização a cada 20s
        </div>
      </div>
    </div>
  );
}

