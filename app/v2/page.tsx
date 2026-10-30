"use client";

import { useEffect, useMemo, useState } from "react";
import BotView, { MiniCurva, type Activo, type Estado } from "../../components/BotView";
import {
  type EquityPoint,
  type Trade,
  botEquitySeries,
  buildEquityCurve,
  isClosedTrade,
  isOpenTrade,
  isTestTrade,
  latestEquity,
  resolveBots,
  sortTradesNewest,
} from "../../lib/dashboard";
import { fetchEquityHistory, fetchTrades } from "../../lib/queries";
import { comSinal, dataHora, dinheiro, haQuanto, lado, percent, preco, tom } from "../../lib/formato";

const COR_V2 = "#ff8a4c";
const HORA = 3_600_000;

export default function SeleneV2() {
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const carregar = () =>
      Promise.all([fetchEquityHistory(), fetchTrades()])
        .then(([e, t]) => { setEquity(e); setTrades(t); setErro(null); setCarregado(true); })
        .catch((e) => { setErro(String(e)); setCarregado(true); });
    carregar();
    const id = setInterval(carregar, 30_000);
    return () => clearInterval(id);
  }, []);

  const v = useMemo(() => {
    const reais = trades.filter((t) => !isTestTrade(t));
    const bots = resolveBots(equity, reais).filter((b) => equity.some((p) => p.bot === b.id) || reais.some((t) => t.bot === b.id));
    const capital = bots.reduce((s, b) => s + b.capital, 0);
    const actual = bots.reduce((s, b) => s + latestEquity(equity, b.id, b.capital), 0);
    const curva = buildEquityCurve(equity, bots);

    // série em % do capital total, uma amostra por hora para ficar legível
    const porHora = new Map<number, number>();
    let pico = capital;
    let pior = 0;
    for (const linha of curva) {
      let pnl = 0;
      for (const b of bots) { const x = linha.values[b.id]; if (x != null) pnl += x - b.capital; }
      const total = capital + pnl;
      pico = Math.max(pico, total);
      pior = Math.min(pior, (total / pico - 1) * 100);
      porHora.set(Math.floor(linha.time / HORA) * HORA, capital ? (pnl / capital) * 100 : 0);
    }
    const serie = [...porHora.entries()].sort((a, b) => a[0] - b[0]).map(([t, pct]) => ({ rotulo: dataHora(t), total: pct }));

    const abertas = reais.filter(isOpenTrade);
    const fechadas = reais.filter(isClosedTrade);
    const ganhos = fechadas.filter((t) => Number(t.pnl) > 0).length;
    const ultimo = equity.reduce((m, p) => Math.max(m, Date.parse(p.timestamp) || 0), 0);
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
    const pnlHoje = fechadas
      .filter((t) => Date.parse(t.closed_at ?? "") >= inicioHoje.getTime())
      .reduce((s, t) => s + (Number(t.pnl) || 0), 0);

    const activos: Activo[] = bots.map((b) => {
      const eq = latestEquity(equity, b.id, b.capital);
      const pnl = eq - b.capital;
      const nAbertas = abertas.filter((t) => t.bot === b.id).length;
      return {
        nome: b.label,
        valor: `$${dinheiro(eq)}`,
        linha2: `${comSinal(pnl)} $ · ${percent((pnl / b.capital) * 100)}`,
        tom: tom(pnl),
        etiqueta: nAbertas ? `${nAbertas} aberta${nAbertas > 1 ? "s" : ""}` : "Sem posição",
        etiquetaActiva: nAbertas > 0,
        extra: <MiniCurva valores={botEquitySeries(equity, b.id, b.capital)} cor={b.color} />,
      };
    });

    return { bots, capital, actual, serie, abertas, fechadas, ganhos, ultimo, pior, pnlHoje, activos, reais };
  }, [equity, trades]);

  const horas = v.ultimo ? (Date.now() - v.ultimo) / HORA : null;
  const estado: Estado = erro
    ? { texto: "Erro", tipo: "erro", detalhe: erro }
    : !carregado || horas == null
      ? { texto: "A carregar", tipo: "aviso" }
      : horas > 6
        ? { texto: "Parado", tipo: "aviso", detalhe: `último registo ${haQuanto(horas)}` }
        : { texto: "Activo · simulação", tipo: "ok", detalhe: `último registo ${haQuanto(horas)}` };

  const pnl = v.actual - v.capital;

  return (
    <BotView
      nome="Selene_v2"
      motor="Grok"
      cor={COR_V2}
      explicacao="Vários bots de 250 USDT, um por estratégia ou moeda (BTC, ETH, SOL, XRP, grelha e funding). Procuram entradas no gráfico de 4 horas e diário, a comprar ou a vender."
      estado={estado}
      moeda="USDT"
      valorActual={`$${dinheiro(v.actual)}`}
      resultado={{ pct: percent(v.capital ? (pnl / v.capital) * 100 : 0), valor: `${comSinal(pnl)} $`, tom: tom(pnl) }}
      numeros={[
        { rotulo: "Fechado hoje", valor: `${comSinal(v.pnlHoje)} $`, tom: tom(v.pnlHoje) },
        { rotulo: "Pior queda", valor: percent(v.pior, 1), tom: v.pior < -0.01 ? "mau" : "neutro" },
        { rotulo: "Posições abertas", valor: String(v.abertas.length) },
        { rotulo: "Acertos", valor: v.fechadas.length ? `${v.ganhos}/${v.fechadas.length}` : "—" },
      ]}
      grafico={{
        titulo: "Resultado desde o arranque",
        nota: "Em %, somando todos os bots sobre o capital total.",
        dados: v.serie,
        series: [{ chave: "total", nome: "Selene_v2", cor: COR_V2 }],
      }}
      activosTitulo="Bots"
      activosNota="Cada bot começou com 250 USDT."
      activos={v.activos}
      operacoes={sortTradesNewest(v.reais).map((t) => {
        const fechada = isClosedTrade(t);
        const res = Number(t.pnl);
        const quando = Date.parse(t.closed_at || t.opened_at || "");
        const px = fechada ? t.exit_price ?? t.entry_price : t.entry_price;
        return {
          id: String(t.id),
          quando: dataHora(quando),
          activo: `${v.bots.find((b) => b.id === t.bot)?.label ?? t.bot} · ${(t.symbol ?? "").replace("USDT", "").replace("-PERP", "")}`,
          lado: lado(t.side),
          preco: preco(px),
          valor: t.quantity != null && px != null ? `$${dinheiro(Number(t.quantity) * Number(px))}` : "—",
          resultado: fechada && Number.isFinite(res) ? `${comSinal(res)} $` : "aberta",
          tom: fechada && Number.isFinite(res) ? tom(res) : "neutro",
        };
      })}
      semOperacoes="Ainda nenhuma operação."
      ligacaoExtra={{ href: "/v2/terminal", texto: "Vista terminal →" }}
      rodape="Simulação: nenhum valor aqui é dinheiro real. Os bots registam de 2 em 2 horas. Não é aconselhamento financeiro."
    />
  );
}
