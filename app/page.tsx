 "use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { supabase } from "../lib/supabase";

interface EquityPoint {
  timestamp: string;
  equity: number;
  bot: string;
}

export default function Dashboard() {
  const [data, setData] = useState<EquityPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    const { data: rows, error } = await supabase
      .from("equity_history")
      .select("*")
      .order("timestamp", { ascending: true })
      .limit(200);

    if (!error && rows) {
      setData(rows);
    }
    setLoading(false);
  }

  const bots = ["BTC", "ETH", "SOL"];
  const chartData = data.reduce((acc: any[], point) => {
    const time = new Date(point.timestamp).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    let entry = acc.find(e => e.time === time);
    if (!entry) {
      entry = { time };
      acc.push(entry);
    }
    entry[point.bot] = point.equity;
    return acc;
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: 1200, margin: "0 auto" }}>
      <h1>Painel de Controlo — Trading Bots</h1>
      <p style={{ color: "#666" }}>Atualização automática a cada 30s • Paper Trading</p>

      {loading && <p>A carregar dados...</p>}

      <div style={{ marginTop: "2rem" }}>
        <h2>Curva de Equity</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="BTC" stroke="#f7931a" strokeWidth={2} />
            <Line type="monotone" dataKey="ETH" stroke="#627eea" strokeWidth={2} />
            <Line type="monotone" dataKey="SOL" stroke="#14f195" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <h2>Resumo por Bot</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
          {bots.map(bot => {
            const last = [...data].reverse().find(d => d.bot === bot);
            return (
              <div key={bot} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem" }}>
                <h3>{bot}</h3>
                <p style={{ fontSize: "1.5rem", margin: 0 }}>
                  {last ? `$${last.equity.toFixed(2)}` : "—"}
                </p>
                <p style={{ color: "#666", margin: "0.5rem 0 0" }}>Capital atual</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

