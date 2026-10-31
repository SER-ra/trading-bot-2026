"use client";

import { useEffect, useMemo, useState } from "react";
import BotView, { BarraMedias, type Activo, type Estado } from "../../components/BotView";
import GraficoMedias, { type Vela } from "../../components/GraficoMedias";
import PainelLua, { condicoesCumpridas, emDescida } from "../../components/PainelLua";
import Estrelas from "../../components/Estrelas";
import { SELENE_V1_COLOR, type SeleneData, fetchSelene, horasDesde, moedasDoDia, resumo, serieRetorno } from "../../lib/selene";
import { comSinal, dataHora, dinheiro, haQuanto, lado, percent, preco, tom } from "../../lib/formato";


export default function SeleneV1() {
  const [dados, setDados] = useState<SeleneData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [velas, setVelas] = useState<Record<string, Vela[] | { erro: string }>>({});

  useEffect(() => {
    fetch("/api/velas").then((r) => r.json()).then(setVelas).catch(() => {});
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
    const vendido = /vend|short/i.test(m.sinal ?? "");
    return {
      nome: m.moeda,
      valor: `$${preco(m.preco)}`,
      linha2: dentro ? `Investido: $${dinheiro(m.actual_usd)}` : vendido ? `Aposta na descida: $${dinheiro(Math.abs(Number(m.actual_usd)))}` : "Sem posição",
      etiqueta: dentro ? "Comprado" : vendido ? "Na descida" : "Fora",
      etiquetaActiva: dentro || vendido,
      etiquetaMau: vendido,
      extra: Array.isArray(velas[m.moeda]) && (velas[m.moeda] as Vela[]).length > 0
        ? <GraficoMedias velas={velas[m.moeda] as Vela[]} />
        : <BarraMedias preco={Number(m.preco)} medias={[Number(m.ma50), Number(m.ma100), Number(m.ma200)]} cor={SELENE_V1_COLOR} />,
    };
  });


  const progresso = Object.entries(velas)
    .filter((e): e is [string, Vela[]] => Array.isArray(e[1]) && e[1].length > 0)
    .map(([moeda, v]) => ({ moeda, n: condicoesCumpridas(v), descida: emDescida(v) }));

  return (
    <BotView
      fundo={<Estrelas intensidade={Math.max(0, ...progresso.map((p) => p.n)) / 3} />}
      topo={<PainelLua progresso={progresso} />}
      nome="Selene_v1"
      motor="Claude"
      cor={SELENE_V1_COLOR}
      explicacao="Segue a tendência diária de BTC e ETH. Compra quando o preço fecha acima das médias de 50, 100 e 200 dias, aposta na descida quando fecha abaixo das três e fica fora no resto. Sem alavancagem, decide uma vez por dia."
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
      activosNota={`${r.ultimo?.vela_sinal ? `Decisão tomada com o fecho do dia ${r.ultimo.vela_sinal.slice(8, 10)}/${r.ultimo.vela_sinal.slice(5, 7)}. ` : ""}Gráficos dos últimos 5 meses (fecho diário, Kraken). A lista mostra quanto falta para comprar ou para apostar na descida.`}
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

