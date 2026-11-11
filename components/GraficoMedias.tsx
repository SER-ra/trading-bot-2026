"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface Vela {
  t: number;
  preco: number;
  ma50: number | null;
  ma100: number | null;
  ma200: number | null;
}

const CORES = { preco: "#ecebe7", ma50: "#5aa9ff", ma100: "#b08cff", ma200: "#ff8a4c" };
const fmt = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: n < 1 ? 4 : n < 1000 ? 2 : 0 });
const fmtData = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const pct = (n: number) => `${Math.abs(n).toFixed(1).replace(".", ",")}%`;

/**
 * Preço e médias de 50/100/200 dias nos últimos meses, mais uma lista simples
 * das condições da regra da Selene_v1 e quanto falta para comprar ou para apostar na descida.
 */
export default function GraficoMedias({ velas }: { velas: Vela[] }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!velas.length) return null;

  const u = velas[velas.length - 1];
  const p = u.preco;
  const m50 = u.ma50 ?? NaN;
  const m100 = u.ma100 ?? NaN;
  const m200 = u.ma200 ?? NaN;

  // regra da Selene_v1: compra com o fecho acima das 3 médias, aposta na descida abaixo das 3, fora no resto
  const condicoes = [
    { ok: p > m50, txt: "Preço acima da média de 50 dias", falta: (m50 / p - 1) * 100 },
    { ok: p > m100, txt: "Preço acima da média de 100 dias", falta: (m100 / p - 1) * 100 },
    { ok: p > m200, txt: "Preço acima da média de 200 dias", falta: (m200 / p - 1) * 100 },
  ];
  const acima = condicoes.filter((c) => c.ok).length;
  const paraComprar = (Math.max(m50, m100, m200) / p - 1) * 100; // subir até passar a média mais alta
  const paraDescida = (1 - Math.min(m50, m100, m200) / p) * 100; // cair até ficar abaixo da média mais baixa

  let leitura: { txt: string; cor: string };
  if (acima === 3) leitura = { txt: "Sinal de compra: preço acima das 3 médias", cor: "var(--bv-bom)" };
  else if (paraDescida <= 0) leitura = { txt: "Sinal de descida: preço abaixo das 3 médias", cor: "var(--bv-mau)" };
  else if (Math.min(paraComprar, paraDescida) <= 3)
    leitura = { txt: paraComprar <= paraDescida ? `Perto de comprar: faltam ${pct(paraComprar)}` : `Perto da descida: faltam ${pct(paraDescida)}`, cor: "var(--bv-aviso)" };
  else leitura = { txt: "Fora: preço entre as médias", cor: "var(--bv-mudo)" };

  const valores = velas.flatMap((v) => [v.preco, v.ma50, v.ma100, v.ma200]).filter((x): x is number => x != null);
  const lo = Math.min(...valores);
  const hi = Math.max(...valores);
  const pad = (hi - lo) * 0.06;

  return (
    <div className="gm">
      <div className="gm-leitura" style={{ color: leitura.cor }}>● {leitura.txt}</div>
      <div className="gm-grafico">
        {montado && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={velas} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(t: number) => fmtData.format(t)} tick={{ fill: "#75746f", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={40} />
              <YAxis domain={[lo - pad, hi + pad]} hide />
              <Tooltip
                contentStyle={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(t: number) => fmtData.format(t)}
                formatter={(v: number, nome: string) => [fmt(v), nome]}
              />
              <Line dataKey="ma200" name="Média 200" stroke={CORES.ma200} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
              <Line dataKey="ma100" name="Média 100" stroke={CORES.ma100} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
              <Line dataKey="ma50" name="Média 50" stroke={CORES.ma50} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
              <Line dataKey="preco" name="Preço" stroke={CORES.preco} strokeWidth={1.8} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="gm-legenda">
        <span><i style={{ background: CORES.preco }} />Preço</span>
        <span><i style={{ background: CORES.ma50 }} />50 dias</span>
        <span><i style={{ background: CORES.ma100 }} />100 dias</span>
        <span><i style={{ background: CORES.ma200 }} />200 dias</span>
      </div>
      <ul className="gm-lista">
        {condicoes.map((c) => (
          <li key={c.txt} className={c.ok ? "ok" : ""}>
            <span className="gm-check">{c.ok ? "✓" : "✗"}</span>
            <span>{c.txt}</span>
            {!c.ok && c.falta != null && Number.isFinite(c.falta) && <span className="gm-falta">falta {pct(c.falta)}</span>}
          </li>
        ))}
      </ul>
      {acima < 3 && paraDescida > 0 && (
        <div className="gm-lados">
          <span>Para comprar: <b className="bom">subir {pct(paraComprar)}</b></span>
          <span>Para apostar na descida: <b className="mau">cair {pct(paraDescida)}</b></span>
        </div>
      )}
    </div>
  );
}
