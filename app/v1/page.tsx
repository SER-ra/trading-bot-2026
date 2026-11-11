"use client";

import { useEffect, useMemo, useState } from "react";
import BotView, { BarraMedias, type Activo, type Estado } from "../../components/BotView";
import GraficoMedias, { type Vela } from "../../components/GraficoMedias";
import PainelLua, { type ProgressoMoeda, condicoesCumpridas, emDescida, sinalMaisProximo } from "../../components/PainelLua";
import Estrelas from "../../components/Estrelas";
import { GLOSSARIO_BASE, Glossario, Porque, Posicoes, Saude, type Ficha } from "../../components/Explicacoes";
import { explicar, type Explicacao } from "../../lib/explicar";
import { SELENE_V1_COLOR, type SeleneData, fetchSelene, horasDesde, moedasDoDia, posicoesSimuladas, resumo, serieRetorno } from "../../lib/selene";
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

  const explicacoes = useMemo(() => moedas.map((m) => explicar(m)).filter((e): e is Explicacao => e != null), [moedas]);
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
  const bat = [...(dados?.batimentos ?? [])].filter((b) => b.instancia === "simulacao").at(-1);
  const comissoes = (dados?.operacoes ?? []).reduce((s, o) => s + Number(o.comissao_usd ?? 0), 0);

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
  const distMin = Math.min(10, ...progresso.map((p) => sinalMaisProximo(p).dist));
  const intensidade = Math.max(0, 1 - distMin / 10);

  return (
    <BotView
      fundo={<Estrelas intensidade={intensidade} />}
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
        { rotulo: "Último dia", valor: percent(Number(r.ultimo?.pnl_dia_pct ?? 0)), tom: tom(Number(r.ultimo?.pnl_dia_pct ?? 0)), ajuda: "Variação entre as duas últimas corridas do bot." },
        { rotulo: "Pior queda", valor: percent(r.quedaMaxPct, 1), tom: r.quedaMaxPct < -0.01 ? "mau" : "neutro", ajuda: "Maior descida desde o valor mais alto. No teste histórico chegou a −23%." },
        { rotulo: "Investido", valor: `${Math.round(Number(r.ultimo?.exposicao_pct ?? 0))}%`, ajuda: "Parte da carteira em posições. O resto está parado em dólares." },
        { rotulo: "Operações", valor: String(ops.length), ajuda: "Compras e vendas feitas pelo bot." },
      ]}
      ligacaoExtra={{ href: "/v1/real", texto: "Ver a conta real →" }}
      meio={<>
        <Porque itens={explicacoes} nota={r.ultimo?.vela_sinal ? `Calculado com os preços de fecho até ${r.ultimo.vela_sinal.slice(8, 10)}/${r.ultimo.vela_sinal.slice(5, 7)}. A decisão seguinte é na próxima madrugada.` : undefined} />
        <Posicoes fichas={fichas} vazio="Nenhuma posição aberta: a carteira está toda em dólares, à espera de um sinal." nota="Valores da última corrida do bot (uma vez por dia)." />
      </>}
      fim={<>
        <Saude
          titulo="Saúde do bot e custos"
          linhas={[
            bat
              ? { rotulo: "Última corrida do bot", valor: `${bat.dia.slice(8, 10)}/${bat.dia.slice(5, 7)} às ${dataHora(Date.parse(bat.registado_em)).slice(-5)} · ${bat.estado === "ok" ? "correu bem" : bat.estado}`, tom: bat.estado === "ok" ? "bom" : "mau", nota: "Corre todos os dias à 01h10 (Lisboa) e, se falhar, repete de hora a hora até às 06h10." }
              : { rotulo: "Último registo", valor: horas == null ? "sem registo" : haQuanto(horas), tom: horas != null && horas <= 26 ? "bom" : "aviso", nota: "Corre todos os dias à 01h10 (Lisboa)." },
            { rotulo: "Vigia", valor: "todos os dias às 07h44", nota: "Manda aviso para o telemóvel se o bot não correu." },
            { rotulo: "Capital inicial (virtual)", valor: `${dinheiro(r.capital)} $` },
            { rotulo: "Comissões simuladas até hoje", valor: `${comSinal(-comissoes)} $`, tom: comissoes > 0 ? "mau" : "neutro", nota: "0,08% nas compras à vista e 0,06% nas vendas em perpétuo. O funding também é simulado." },
          ]}
        />
        <Glossario itens={[...GLOSSARIO_BASE, ["Simulação", "Carteira de 1 000 $ virtuais. O bot calcula tudo como se negociasse, mas não envia ordens. Serve para comparar com a conta real."]]} />
      </>}
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

