"use client";

import { useEffect, useMemo, useState } from "react";
import BotView, { BarraMedias, type Activo, type Estado } from "../../components/BotView";
import GraficoMedias, { type Vela } from "../../components/GraficoMedias";
import PainelLua, { condicoesCumpridas } from "../../components/PainelLua";
import Estrelas from "../../components/Estrelas";
import { SELENE_V1_COLOR, type SeleneData, fetchSelene, horasDesde, moedasDoDia, resumo, serieRetorno } from "../../lib/selene";
import { comSinal, data, dataHora, dinheiro, haQuanto, lado, percent, preco, tom } from "../../lib/formato";

interface Observacao {
  erro?: string;
  velas: Vela[];
  eventos: { t: number; tipo: "entrada" | "saida"; preco: number }[];
  dentro: boolean;
  desde: number | null;
  retornoRegra: number;
  retornoGuardar: number | null;
  custoPorOperacao: number;
}

export default function SeleneV1() {
  const [dados, setDados] = useState<SeleneData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [velas, setVelas] = useState<Record<string, Vela[] | { erro: string }>>({});
  const [obs, setObs] = useState<Observacao | null>(null);

  useEffect(() => {
    fetch("/api/velas").then((r) => r.json()).then(setVelas).catch(() => {});
    fetch("/api/observacao").then((r) => r.json()).then(setObs).catch(() => {});
  }, []);

  useEffect(() => {
    const carregar = () =>
      fetchSelene()
        .then((d) => { setDados(d); setErro(d.erro ?? null); })
        .catch((e) => setErro(String(e)));
    carregar();
    const id = setInterval(carregar, 60_000);
    return () => clearInterval(id);
  }, []);

  const r = useMemo(() => resumo(dados), [dados]);
  const serie = useMemo(() => serieRetorno(dados), [dados]);
  const moedas = useMemo(() => moedasDoDia(dados), [dados]);
  const ops = useMemo(() => [...(dados?.operacoes ?? [])].sort((a, b) => b.ts.localeCompare(a.ts)), [dados]);

  const horas = horasDesde(r.ultimoRegisto);
  const estado: Estado = erro
    ? { texto: "Erro", tipo: "erro", detalhe: erro }
    : horas == null
      ? { texto: "Sem dados", tipo: "aviso" }
      : horas > 26
        ? { texto: "Parado", tipo: "aviso", detalhe: `último registo ${haQuanto(horas)}` }
        : { texto: (r.ultimo?.modo ?? "").startsWith("real") ? "Activo · real" : "Activo · simulação", tipo: "ok", detalhe: `último registo ${haQuanto(horas)}` };

  const activos: Activo[] = moedas.map((m) => {
    const dentro = /dentro|compr|long/i.test(m.sinal ?? "");
    return {
      nome: m.moeda,
      valor: `$${preco(m.preco)}`,
      linha2: dentro ? `Investido: $${dinheiro(m.actual_usd)}` : "Sem posição",
      etiqueta: dentro ? "Comprado" : "Fora",
      etiquetaActiva: dentro,
      extra: Array.isArray(velas[m.moeda]) && (velas[m.moeda] as Vela[]).length > 0
        ? <GraficoMedias velas={velas[m.moeda] as Vela[]} />
        : <BarraMedias preco={Number(m.preco)} medias={[Number(m.ma50), Number(m.ma100), Number(m.ma200)]} cor={SELENE_V1_COLOR} />,
    };
  });

  // Ergo: só observação, fora da carteira e da lua
  if (obs && !obs.erro && obs.velas?.length) {
    const u = obs.velas[obs.velas.length - 1];
    const ult = obs.eventos.at(-1);
    const sinal = ult
      ? `${ult.tipo === "entrada" ? "Entraria" : "Sairia"} a ${data(ult.t)} ($${preco(ult.preco)})`
      : "Nenhum sinal no último ano";
    activos.push({
      nome: "ERG",
      valor: `$${preco(u.preco)}`,
      linha2: obs.dentro ? `Regra: estaria comprada · ${sinal}` : `Regra: estaria fora · ${sinal}`,
      tom: "neutro",
      etiqueta: "Em observação",
      etiquetaActiva: false,
      extra: (
        <>
          <GraficoMedias velas={obs.velas} />
          <p className="obs-nota">
            Teste sem dinheiro. Desde {obs.desde ? data(obs.desde) : "—"}, a mesma regra teria dado{" "}
            <b className={obs.retornoRegra >= 0 ? "bom" : "mau"}>{percent(obs.retornoRegra)}</b>
            {obs.retornoGuardar != null && <> contra <b className={obs.retornoGuardar >= 0 ? "bom" : "mau"}>{percent(obs.retornoGuardar)}</b> a guardar ERG</>}
            {" "}({(() => { const n = obs.eventos.filter((e) => e.tipo === "entrada").length; return `${n} ${n === 1 ? "entrada" : "entradas"}`; })()}, já com {String(obs.custoPorOperacao).replace(".", ",")}% de custo por operação).
            Preço agregado do CoinGecko; na DEX (Spectrum) a liquidez é pequena e o preço real pode diferir.
          </p>
        </>
      ),
    });
  }

  return (
    <BotView
      fundo={<Estrelas />}
      topo={
        <PainelLua
          progresso={Object.entries(velas)
            .filter((e): e is [string, Vela[]] => Array.isArray(e[1]) && e[1].length > 0)
            .map(([moeda, v]) => ({ moeda, n: condicoesCumpridas(v) }))}
        />
      }
      nome="Selene_v1"
      motor="Claude"
      cor={SELENE_V1_COLOR}
      explicacao="Segue a tendência diária de BTC e ETH. Compra quando o preço está acima das médias móveis e fica fora quando não está. Sem alavancagem, decide uma vez por dia."
      estado={estado}
      moeda="USD"
      valorActual={`$${dinheiro(r.equity)}`}
      resultado={{ pct: percent(r.retornoPct), valor: `${comSinal(r.pnl)} $`, tom: tom(r.pnl) }}
      numeros={[
        { rotulo: "Hoje", valor: percent(Number(r.ultimo?.pnl_dia_pct ?? 0)), tom: tom(Number(r.ultimo?.pnl_dia_pct ?? 0)) },
        { rotulo: "Pior queda", valor: percent(r.quedaMaxPct, 1), tom: r.quedaMaxPct < -0.01 ? "mau" : "neutro" },
        { rotulo: "Investido", valor: `${Math.round(Number(r.ultimo?.exposicao_pct ?? 0))}%` },
        { rotulo: "Operações", valor: String(ops.length) },
      ]}
      grafico={{
        titulo: "Resultado desde o arranque",
        nota: "Em %, comparado com simplesmente comprar e guardar BTC ou ETH no mesmo dia.",
        dados: serie.map((s) => ({ rotulo: s.label, selene: s.selene, btc: s.btc, eth: s.eth })),
        series: [
          { chave: "selene", nome: "Selene_v1", cor: SELENE_V1_COLOR },
          { chave: "btc", nome: "Guardar BTC", cor: "#d4a017", tracejada: true },
          { chave: "eth", nome: "Guardar ETH", cor: "#8a8a8a", tracejada: true },
        ],
      }}
      activosTitulo="Moedas"
      activosNota={`${r.ultimo?.vela_sinal ? `Decisão tomada com o fecho do dia ${r.ultimo.vela_sinal.slice(8, 10)}/${r.ultimo.vela_sinal.slice(5, 7)}. ` : ""}Gráficos dos últimos 5 meses (fecho diário, Kraken; ERG via CoinGecko). A lista mostra o que falta para uma tendência de subida.`}
      activos={activos}
      activosLargos
      operacoes={ops.map((o) => ({
        id: String(o.id),
        quando: dataHora(Date.parse(o.ts)),
        activo: o.moeda,
        lado: lado(o.lado),
        preco: preco(o.preco),
        valor: o.valor_usd == null ? "—" : `$${dinheiro(o.valor_usd)}`,
        resultado: o.nota ?? "—",
      }))}
      semOperacoes="Ainda nenhuma. A Selene_v1 está fora do mercado à espera de uma tendência de subida."
      rodape="Simulação: nenhum valor aqui é dinheiro real. Actualiza uma vez por dia, por volta da 01h10. Não é aconselhamento financeiro."
    />
  );
}
