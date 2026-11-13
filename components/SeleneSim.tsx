"use client";

import { useEffect, useMemo, useState } from "react";
import BotView, { BarraMedias, type Activo, type Estado } from "./BotView";
import GraficoMedias, { type Vela } from "./GraficoMedias";
import PainelLua, { type ProgressoMoeda, condicoesCumpridas, emDescida, sinalMaisProximo } from "./PainelLua";
import Estrelas from "./Estrelas";
import { GLOSSARIO_BASE, Glossario, Porque, Posicoes, Saude, type Ficha } from "./Explicacoes";
import { explicar, type Explicacao, type RegraSelene } from "../lib/explicar";
import { type SeleneData, fetchSelene, horasDesde, moedasDoDia, posicoesSimuladas, resumo, serieRetorno } from "../lib/selene";
import { comSinal, dataHora, dinheiro, haQuanto, lado, percent, preco, tom } from "../lib/formato";


/** O que muda entre as instâncias em simulação (Selene V1.4 em /v1 e Selene v3 em /v3). O resto da página é igual. */
export interface ConfigSim {
  instancia: "simulacao" | "v3";
  nome: string;
  cor: string;
  explicacao: string;
  regra: RegraSelene; // regra mista, tamanho das vendas e alvo de volatilidade
  hora: string; // "01h10"
  horaFim: string; // "06h10"
  quedaTeste: string; // pior queda no teste histórico, para a ajuda
  notaComissoes: string;
  semOperacoes: string;
  ligacaoExtra?: { href: string; texto: string };
}

export default function SeleneSim({ cfg }: { cfg: ConfigSim }) {
  const semVendas = (cfg.regra.vendas ?? 1) === 0;
  const [dados, setDados] = useState<SeleneData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [velas, setVelas] = useState<Record<string, Vela[] | { erro: string }>>({});

  useEffect(() => {
    fetch("/api/velas").then((r) => r.json()).then(setVelas).catch(() => {});
  }, []);

  useEffect(() => {
    const carregar = () =>
      fetchSelene(cfg.instancia)
        .then((d) => { setDados(d); setErro(d.erro ?? null); })
        .catch((e) => setErro(String(e)));
    carregar();
    const id = setInterval(carregar, 60_000);
    return () => clearInterval(id);
  }, [cfg.instancia]);

  const r = useMemo(() => resumo(dados), [dados]);
  const serie = useMemo(() => serieRetorno(dados), [dados]);
  const moedas = useMemo(() => moedasDoDia(dados), [dados]);
  const ops = useMemo(() => [...(dados?.operacoes ?? [])].sort((a, b) => b.ts.localeCompare(a.ts)), [dados]);

  // fecho de há 30 dias (velas da Kraken), para explicar a 2.ª metade da regra mista
  const fecho30 = (moeda: string): number | null => {
    const v = velas[moeda];
    return Array.isArray(v) && v.length > 31 ? v[v.length - 31].preco : null;
  };
  const explicacoes = useMemo(
    () => moedas.map((m) => explicar(m, null, { ...cfg.regra, fecho30: fecho30(m.moeda) })).filter((e): e is Explicacao => e != null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moedas, velas, cfg.regra]
  );
  const posicoes = useMemo(() => posicoesSimuladas(dados), [dados]);
  const fichas: Ficha[] = moedas.filter((m) => Math.abs(posicoes[m.moeda]?.qtd ?? 0) > 1e-9).map((m) => {
    const p = posicoes[m.moeda], px = Number(m.preco), res = p.qtd * (px - p.entrada), vendido = p.qtd < 0;
    return {
      titulo: m.moeda,
      etiqueta: vendido ? "A apostar na descida" : "Comprado",
      etiquetaMau: vendido,
      linhas: [
        { rotulo: "Tamanho", valor: `${Math.abs(p.qtd).toLocaleString("pt-PT", { maximumFractionDigits: 5 })} ${m.moeda} (${dinheiro(Math.abs(p.qtd) * px)} $)` },
        { rotulo: "Preço de entrada", valor: `${dinheiro(p.entrada)} $` },
        { rotulo: "Preço no último fecho", valor: `${dinheiro(px)} $`, nota: vendido ? "Ganha se descer abaixo do preço de entrada." : "Ganha se subir acima do preço de entrada." },
        { rotulo: "Resultado em aberto", valor: `${comSinal(res)} $ (${percent(p.entrada ? (res / (Math.abs(p.qtd) * p.entrada)) * 100 : 0)})`, tom: tom(res), nota: "Sem contar comissões nem funding." },
      ],
    };
  });
  const bat = [...(dados?.batimentos ?? [])].filter((b) => b.instancia === cfg.instancia).at(-1);
  const comissoes = (dados?.operacoes ?? []).reduce((s, o) => s + Number(o.comissao_usd ?? 0), 0);

  const glossario: [string, string][] = GLOSSARIO_BASE
    .filter(([t]) => !semVendas || !/Apostar na descida|Funding/.test(t))
    .map(([t, d]): [string, string] => {
      if (t === "Pior queda") return [t, `A maior descida da carteira desde o seu valor mais alto até agora. No teste histórico desta configuração a pior foi de cerca de ${cfg.quedaTeste}.`];
      if (t === "Investido" && semVendas) return [t, "Que parte da carteira está comprada. O resto está parado em dólares. Nunca passa de 100%: o bot não usa dinheiro emprestado."];
      if (t.startsWith("Médias") && semVendas) return [t, "A média dos preços de fecho dos últimos 50, 100 e 200 dias. Preço acima das três: tendência de subida. Abaixo: o bot fica de fora."];
      return [t, d];
    });
  if (cfg.regra.mista) glossario.push(["Regra mista", "Duas regras de compra, cada uma vale metade da posição: (1) fecho acima das médias de 50, 100 e 200 dias; (2) fecho acima da média de 200 dias e do fecho de há 30 dias."]);

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
        ? <GraficoMedias velas={velas[m.moeda] as Vela[]} semVendas={semVendas} />
        : <BarraMedias preco={Number(m.preco)} medias={[Number(m.ma50), Number(m.ma100), Number(m.ma200)]} cor={cfg.cor} />,
    };
  });


  const progresso: ProgressoMoeda[] = Object.entries(velas)
    .filter((e): e is [string, Vela[]] => Array.isArray(e[1]) && e[1].length > 0)
    .map(([moeda, v]) => {
      const u = v[v.length - 1];
      const ms = [u.ma50, u.ma100, u.ma200].filter((x): x is number => x != null);
      return {
        moeda,
        n: condicoesCumpridas(v),
        descida: emDescida(v),
        paraComprar: ms.length === 3 ? (Math.max(...ms) / u.preco - 1) * 100 : undefined,
        paraVender: ms.length === 3 ? (1 - Math.min(...ms) / u.preco) * 100 : undefined,
      };
    });
  // o céu anima-se à medida que alguma moeda se aproxima de um sinal (compra ou venda)
  const distMin = Math.min(10, ...progresso.map((p) => sinalMaisProximo(p, semVendas).dist));
  const intensidade = Math.max(0, 1 - distMin / 10);

  return (
    <BotView
      fundo={<Estrelas intensidade={intensidade} />}
      topo={<PainelLua progresso={progresso} semVendas={semVendas} />}
      nome={cfg.nome}
      motor="Claude"
      cor={cfg.cor}
      explicacao={cfg.explicacao}
      estado={estado}
      moeda="USD"
      valorActual={`$${dinheiro(r.equity)}`}
      resultado={{ pct: percent(r.retornoPct), valor: `${comSinal(r.pnl)} $`, tom: tom(r.pnl) }}
      numeros={[
        { rotulo: "Último dia", valor: percent(Number(r.ultimo?.pnl_dia_pct ?? 0)), tom: tom(Number(r.ultimo?.pnl_dia_pct ?? 0)), ajuda: "Variação entre as duas últimas corridas do bot." },
        { rotulo: "Pior queda", valor: percent(r.quedaMaxPct, 1), tom: r.quedaMaxPct < -0.01 ? "mau" : "neutro", ajuda: `Maior descida desde o valor mais alto. No teste histórico chegou a ${cfg.quedaTeste}.` },
        { rotulo: "Investido", valor: `${Math.round(Number(r.ultimo?.exposicao_pct ?? 0))}%`, ajuda: "Parte da carteira em posições. O resto está parado em dólares." },
        { rotulo: "Operações", valor: String(ops.length), ajuda: "Compras e vendas feitas pelo bot." },
      ]}
      ligacaoExtra={cfg.ligacaoExtra}
      meio={<>
        <Porque itens={explicacoes} nota={r.ultimo?.vela_sinal ? `Calculado com os preços de fecho até ${r.ultimo.vela_sinal.slice(8, 10)}/${r.ultimo.vela_sinal.slice(5, 7)}. A decisão seguinte é na próxima madrugada.` : undefined} />
        <Posicoes fichas={fichas} vazio="Nenhuma posição aberta: a carteira está toda em dólares, à espera de um sinal." nota="Valores da última corrida do bot (uma vez por dia)." />
      </>}
      fim={<>
        <Saude
          titulo="Saúde do bot e custos"
          linhas={[
            bat
              ? { rotulo: "Última corrida do bot", valor: `${bat.dia.slice(8, 10)}/${bat.dia.slice(5, 7)} às ${dataHora(Date.parse(bat.registado_em)).slice(-5)} · ${bat.estado === "ok" ? "correu bem" : bat.estado}`, tom: bat.estado === "ok" ? "bom" : "mau", nota: `Corre todos os dias à ${cfg.hora} (Lisboa) e, se falhar, repete de hora a hora até às ${cfg.horaFim}.` }
              : { rotulo: "Último registo", valor: horas == null ? "sem registo" : haQuanto(horas), tom: horas != null && horas <= 26 ? "bom" : "aviso", nota: `Corre todos os dias à ${cfg.hora} (Lisboa).` },
            { rotulo: "Vigia", valor: "todos os dias às 07h44", nota: "Manda aviso para o telemóvel se o bot não correu." },
            { rotulo: "Capital inicial (virtual)", valor: `${dinheiro(r.capital)} $` },
            { rotulo: "Comissões simuladas até hoje", valor: `${comSinal(-comissoes)} $`, tom: comissoes > 0 ? "mau" : "neutro", nota: cfg.notaComissoes },
          ]}
        />
        <Glossario itens={[...glossario, ["Simulação", "Carteira de 1 000 $ virtuais. O bot calcula tudo como se negociasse, mas não envia ordens. Serve para comparar com a conta real."]]} />
      </>}
      grafico={{
        titulo: "Resultado desde o arranque",
        nota: "Em %, comparado com simplesmente comprar e guardar BTC ou ETH no mesmo dia.",
        dados: serie.map((s) => ({ rotulo: s.label, selene: s.selene, btc: s.btc, eth: s.eth })),
        series: [
          { chave: "selene", nome: cfg.nome, cor: cfg.cor },
          { chave: "btc", nome: "Guardar BTC", cor: "#d4a017", tracejada: true },
          { chave: "eth", nome: "Guardar ETH", cor: "#8a8a8a", tracejada: true },
        ],
      }}
      activosTitulo="Moedas"
      activosNota={`${r.ultimo?.vela_sinal ? `Decisão tomada com o fecho do dia ${r.ultimo.vela_sinal.slice(8, 10)}/${r.ultimo.vela_sinal.slice(5, 7)}. ` : ""}Gráficos dos últimos 5 meses (fecho diário, Kraken). A lista mostra quanto falta para ${semVendas ? "comprar" : "comprar ou para apostar na descida"}.`}
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
      semOperacoes={cfg.semOperacoes}
      rodape={`Simulação: nenhum valor aqui é dinheiro real. Actualiza uma vez por dia, por volta da ${cfg.hora}. Não é aconselhamento financeiro.`}
    />
  );
}

