"use client";

/**
 * Esquema comum às duas versões (Selene_v1 e Selene_v2): a mesma ordem de leitura,
 * os mesmos blocos e a mesma tipografia. Cada página só prepara os dados.
 */

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisTicks, paddedDomain } from "../lib/dashboard";

export interface Estado {
  texto: string; // "Activo", "Parado", "Sem dados"
  tipo: "ok" | "aviso" | "erro";
  detalhe?: string; // "último registo há 3 h"
}

export interface Numero {
  rotulo: string;
  valor: string;
  tom?: "bom" | "mau" | "neutro";
}

export interface SerieGrafico {
  chave: string;
  nome: string;
  cor: string;
  tracejada?: boolean;
}

export interface Activo {
  nome: string;
  valor: string;
  linha2: string;
  tom?: "bom" | "mau" | "neutro";
  etiqueta: string; // "Fora", "Comprado", "Long aberto"...
  etiquetaActiva?: boolean;
  extra?: React.ReactNode;
}

export interface Operacao {
  id: string;
  quando: string;
  activo: string;
  lado: string;
  preco: string;
  valor: string;
  resultado: string;
  tom?: "bom" | "mau" | "neutro";
}

export interface BotViewProps {
  nome: string;
  motor: string;
  cor: string;
  explicacao: string;
  estado: Estado;
  moeda: string; // "USD" / "USDT"
  valorActual: string;
  resultado: { pct: string; valor: string; tom: "bom" | "mau" | "neutro" };
  numeros: Numero[];
  grafico: { titulo: string; nota?: string; dados: Array<Record<string, number | string | null>>; series: SerieGrafico[] };
  activosTitulo: string;
  activosNota?: string;
  activos: Activo[];
  operacoes: Operacao[];
  semOperacoes: string;
  ligacaoExtra?: { href: string; texto: string };
  rodape: string;
}

const TOM: Record<string, string> = { bom: "var(--bv-bom)", mau: "var(--bv-mau)", neutro: "var(--bv-tinta)" };
const pct = (v: number) => `${v > 0.000001 ? "+" : v < -0.000001 ? "−" : ""}${Math.abs(v).toFixed(Math.abs(v) < 10 ? 2 : 1).replace(".", ",")}%`;

export default function BotView(p: BotViewProps) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const valores = p.grafico.dados.flatMap((linha) =>
    p.grafico.series.map((s) => linha[s.chave]).filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  );
  const dominio = paddedDomain([...valores, 0], 0.18);

  return (
    <div className="bv-root" style={{ ["--bv-cor" as string]: p.cor }}>
      <div className="bv-shell">
        <nav className="bv-nav">
          <a href="/" className="bv-voltar">← Início</a>
          {p.ligacaoExtra && <a href={p.ligacaoExtra.href} className="bv-voltar">{p.ligacaoExtra.texto}</a>}
        </nav>

        <header className="bv-head">
          <div>
            <div className="bv-titulo">
              <span className="bv-nome">{p.nome}</span>
              <span className="bv-motor">{p.motor}</span>
            </div>
            <p className="bv-explica">{p.explicacao}</p>
          </div>
          <div className={`bv-estado bv-estado-${p.estado.tipo}`}>
            <span className="bv-estado-linha"><span className="bv-ponto" />{p.estado.texto}</span>
            {p.estado.detalhe && <small>{p.estado.detalhe}</small>}
          </div>
        </header>

        <section className="bv-card bv-resumo">
          <div className="bv-principal">
            <div className="bv-rotulo">Valor da carteira</div>
            <div className="bv-valor">
              {p.valorActual} <small>{p.moeda}</small>
            </div>
            <div className="bv-resultado" style={{ color: TOM[p.resultado.tom] }}>
              {p.resultado.pct} <span>({p.resultado.valor}) desde o início</span>
            </div>
          </div>
          <div className="bv-numeros">
            {p.numeros.map((n) => (
              <div key={n.rotulo} className="bv-numero">
                <div className="bv-rotulo">{n.rotulo}</div>
                <div className="bv-num" style={{ color: TOM[n.tom ?? "neutro"] }}>{n.valor}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bv-card">
          <div className="bv-sec-head">
            <h2>{p.grafico.titulo}</h2>
            <div className="bv-legenda">
              {p.grafico.series.map((s) => (
                <span key={s.chave}>
                  <i className={s.tracejada ? "tracejada" : ""} style={{ borderColor: s.cor, background: s.tracejada ? "transparent" : s.cor }} />
                  {s.nome}
                </span>
              ))}
            </div>
          </div>
          {p.grafico.nota && <p className="bv-nota">{p.grafico.nota}</p>}
          <div className="bv-grafico">
            {montado && p.grafico.dados.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={p.grafico.dados} margin={{ top: 10, right: 34, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fill: "#8a8a8a", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={48} />
                  <YAxis domain={dominio} ticks={axisTicks(dominio)} width={60} tickFormatter={(v: number) => pct(v)} tick={{ fill: "#8a8a8a", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={0} stroke="#444" />
                  <Tooltip
                    contentStyle={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 13 }}
                    labelStyle={{ color: "#999", marginBottom: 4 }}
                    formatter={(v: number, nome: string) => [pct(v), nome]}
                  />
                  {p.grafico.series.map((s) => (
                    <Line
                      key={s.chave}
                      type="linear"
                      dataKey={s.chave}
                      name={s.nome}
                      stroke={s.cor}
                      strokeWidth={s.tracejada ? 1.4 : 2.4}
                      strokeDasharray={s.tracejada ? "5 5" : undefined}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="bv-vazio">Ainda sem dados suficientes para o gráfico.</div>
            )}
          </div>
        </section>

        <section className="bv-card">
          <div className="bv-sec-head"><h2>{p.activosTitulo}</h2></div>
          {p.activosNota && <p className="bv-nota">{p.activosNota}</p>}
          <div className="bv-activos">
            {p.activos.map((a) => (
              <div key={a.nome} className="bv-activo">
                <div className="bv-activo-top">
                  <span className="bv-activo-nome">{a.nome}</span>
                  <span className={`bv-tag ${a.etiquetaActiva ? "on" : ""}`}>{a.etiqueta}</span>
                </div>
                <div className="bv-activo-valor">{a.valor}</div>
                <div className="bv-activo-l2" style={{ color: TOM[a.tom ?? "neutro"] }}>{a.linha2}</div>
                {a.extra}
              </div>
            ))}
          </div>
        </section>

        <section className="bv-card">
          <div className="bv-sec-head"><h2>Últimas operações</h2></div>
          {p.operacoes.length === 0 ? (
            <div className="bv-vazio">{p.semOperacoes}</div>
          ) : (
            <div className="bv-tabela-wrap">
              <table className="bv-tabela">
                <thead>
                  <tr><th>Quando</th><th>Activo</th><th>Lado</th><th className="r">Preço</th><th className="r esc">Valor</th><th className="r">Resultado</th></tr>
                </thead>
                <tbody>
                  {p.operacoes.slice(0, 30).map((o) => (
                    <tr key={o.id}>
                      <td>{o.quando}</td>
                      <td><b>{o.activo}</b></td>
                      <td>{o.lado}</td>
                      <td className="r">{o.preco}</td>
                      <td className="r esc">{o.valor}</td>
                      <td className="r" style={{ color: TOM[o.tom ?? "neutro"] }}>{o.resultado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="bv-rodape">{p.rodape}</footer>
      </div>
    </div>
  );
}

/** Barra simples: onde está o preço face às médias móveis. */
export function BarraMedias({ preco, medias, cor }: { preco: number; medias: number[]; cor: string }) {
  const todos = [preco, ...medias].filter(Number.isFinite);
  if (todos.length < 2) return null;
  const lo = Math.min(...todos);
  const hi = Math.max(...todos);
  const pos = (x: number) => ((x - lo) / (hi - lo || 1)) * 100;
  const acima = medias.filter((m) => preco > m).length;
  return (
    <div className="bv-medias">
      <div className="bv-medias-barra">
        {medias.map((m, i) => <i key={i} style={{ left: `${pos(m)}%`, opacity: 0.85 - i * 0.22 }} />)}
        <b style={{ left: `${pos(preco)}%`, background: cor }} />
      </div>
      <div className="bv-medias-txt">Preço acima de {acima} das 3 médias (50, 100 e 200 dias)</div>
    </div>
  );
}

/** Mini-curva para cada activo/bot. */
export function MiniCurva({ valores, cor }: { valores: number[]; cor: string }) {
  if (valores.length < 2) return <div className="bv-mini" />;
  const lo = Math.min(...valores);
  const hi = Math.max(...valores);
  const pts = valores.map((v, i) => `${(i / (valores.length - 1)) * 100},${26 - ((v - lo) / (hi - lo || 1)) * 22}`).join(" ");
  return (
    <svg className="bv-mini" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={cor} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
