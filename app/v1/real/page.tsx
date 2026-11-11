"use client";

import { useEffect, useMemo, useState } from "react";
import BotView, { type Activo, type Estado } from "../../../components/BotView";
import GraficoMedias, { type Vela } from "../../../components/GraficoMedias";
import PainelLua, { type ProgressoMoeda, condicoesCumpridas, emDescida, sinalMaisProximo } from "../../../components/PainelLua";
import Estrelas from "../../../components/Estrelas";
import { GLOSSARIO_BASE, Glossario, Porque, Posicoes, Saude, type Ficha } from "../../../components/Explicacoes";
import { SELENE_REAL_COLOR, type SeleneReal, fetchSeleneReal, piorQueda } from "../../../lib/seleneReal";
import { explicar, type Explicacao } from "../../../lib/explicar";
import { comSinal, dataHora, dinheiro, haQuanto, percent, preco, tom } from "../../../lib/formato";

const DIR: Record<string, string> = {
  "Open Short": "abre aposta na descida", "Close Short": "fecha aposta na descida",
  "Open Long": "abre compra", "Close Long": "fecha compra", Buy: "compra à vista", Sell: "venda à vista",
};
const hora = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const dataLonga = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric" });
const qtdTxt = (q: number) => Math.abs(q).toLocaleString("pt-PT", { maximumFractionDigits: 5 });

export default function SeleneV1Real() {
  const [d, setD] = useState<SeleneReal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [velas, setVelas] = useState<Record<string, Vela[] | { erro: string }>>({});

  useEffect(() => {
    fetch("/api/velas").then((r) => r.json()).then(setVelas).catch(() => {});
  }, []);
  useEffect(() => {
    const carregar = () =>
      fetchSeleneReal()
        .then((x) => { if (x.erro) setErro(x.erro); else { setD(x); setErro(null); } })
        .catch((e) => setErro(String(e)));
    carregar();
    const id = setInterval(carregar, 60_000);
    return () => clearInterval(id);
  }, []);

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
  const bat = d?.batimento ?? null;
  const horasBat = bat ? (Date.now() - Date.parse(bat.registado_em)) / 36e5 : null;
  const semStop = (d?.perps ?? []).filter((p) => !p.stop).map((p) => p.moeda);
  const diasChave = d?.agente ? (d.agente.validoAte - Date.now()) / 864e5 : null;

  const avisos: string[] = [];
  if (bat && bat.estado !== "ok") avisos.push(`A última corrida do bot (${diaMes(bat.dia)}) ficou ${bat.estado === "erro" ? "com erro" : "incompleta"}${bat.detalhe ? `: ${bat.detalhe}` : "."}`);
  if (horasBat != null && horasBat > 30) avisos.push(`O bot não dá sinal de vida ${haQuanto(horasBat)}. As posições continuam abertas na corretora, mas ninguém as está a gerir.`);
  if (semStop.length) avisos.push(`Posição em perpétuo sem stop de emergência na corretora: ${semStop.join(", ")}.`);
  if (diasChave != null && diasChave < 30) avisos.push(`A chave do agente expira em ${Math.max(0, Math.round(diasChave))} dias. Sem chave nova o bot deixa de conseguir negociar.`);

  const estado: Estado = erro && !d
    ? { texto: "Erro", tipo: "erro", detalhe: erro }
    : !d
      ? { texto: "A ler a conta…", tipo: "aviso" }
      : avisos.length
        ? { texto: "Atenção", tipo: "aviso", detalhe: `ao vivo · ${hora.format(d.agora)}` }
        : { texto: "Activo · dinheiro real", tipo: "ok", detalhe: `ao vivo · ${hora.format(d.agora)}` };

  const capital = d?.capital ?? 0, investido = d?.investido ?? 0;
  const pnl = capital - investido;
  const emAberto = (d?.perps ?? []).reduce((s, p) => s + p.resultado, 0) + (d?.vista ?? []).reduce((s, v) => s + v.resultado, 0);
  const exposicao = capital ? (((d?.perps ?? []).reduce((s, p) => s + Math.abs(p.valor), 0) + (d?.vista ?? []).reduce((s, v) => s + v.valor, 0)) / capital) * 100 : 0;
  const queda = useMemo(() => piorQueda(d?.historico ?? []), [d]);
  const custoLiquido = d ? d.custos.funding - d.custos.comissoes : 0;

  const explicacoes = useMemo(
    () => (d?.sinais ?? []).map((m) => explicar(m, d?.mids[m.moeda as "BTC" | "ETH"])).filter((e): e is Explicacao => e != null),
    [d]
  );

  const fichas: Ficha[] = [
    ...(d?.perps ?? []).map((p): Ficha => {
      const vendido = p.qtd < 0;
      const perdaStop = p.stop ? -Math.abs(p.qtd) * Math.abs(p.stop.nivel - p.entrada) : 0;
      return {
        titulo: `${p.moeda} · contrato perpétuo`,
        etiqueta: vendido ? "A apostar na descida" : "Comprado",
        etiquetaMau: vendido,
        linhas: [
          { rotulo: "Tamanho", valor: `${qtdTxt(p.qtd)} ${p.moeda} (${dinheiro(Math.abs(p.valor))} $)` },
          { rotulo: "Preço de entrada", valor: `${dinheiro(p.entrada)} $` },
          { rotulo: "Preço agora", valor: `${dinheiro(p.preco)} $`, nota: vendido ? "Ganha se descer abaixo do preço de entrada." : "Ganha se subir acima do preço de entrada." },
          { rotulo: "Resultado em aberto", valor: `${comSinal(p.resultado)} $ (${percent(p.resultadoPct)})`, tom: tom(p.resultado), nota: "O que ganhavas ou perdias se a posição fosse fechada agora." },
          p.stop
            ? { rotulo: "Stop de emergência", valor: `${dinheiro(p.stop.nivel)} $`, nota: `Ordem que já está na corretora: se o preço lá chegar (${percent((p.stop.nivel / p.preco - 1) * 100, 1)} face a agora), a posição fecha sozinha. Perda nesse caso: cerca de ${comSinal(perdaStop)} $.` }
            : { rotulo: "Stop de emergência", valor: "SEM STOP", tom: "aviso", nota: "O bot repõe-no na próxima corrida. Se continuar assim, vê o email da Selene REAL." },
          ...(p.liquidacao ? [{ rotulo: "Preço de liquidação", valor: `${dinheiro(p.liquidacao)} $`, nota: "Preço a que a corretora fecharia a posição à força. Fica muito longe porque o bot não usa dinheiro emprestado." }] : []),
          { rotulo: "Funding desde a abertura", valor: `${comSinal(p.fundingRecebido, 4)} $`, tom: tom(p.fundingRecebido), nota: "Pagamento de hora a hora entre comprados e vendidos. Positivo: recebeste." },
        ],
      };
    }),
    ...(d?.vista ?? []).map((v): Ficha => ({
      titulo: `${v.moeda} · à vista`,
      etiqueta: "Comprado",
      linhas: [
        { rotulo: "Quantidade", valor: `${qtdTxt(v.qtd)} ${v.moeda} (${dinheiro(v.valor)} $)` },
        { rotulo: "Preço médio de compra", valor: `${dinheiro(v.entrada)} $` },
        { rotulo: "Preço agora", valor: `${dinheiro(v.preco)} $` },
        { rotulo: "Resultado em aberto", valor: `${comSinal(v.resultado)} $ (${percent(v.custo ? (v.resultado / v.custo) * 100 : 0)})`, tom: tom(v.resultado) },
        { rotulo: "Stop de emergência", valor: "não existe à vista", nota: "A Hyperliquid não tem ordens de stop no mercado à vista. Esta posição não usa margem: não pode ser liquidada, e o bot vende-a quando o sinal mudar." },
      ],
    })),
  ];

  const progresso: ProgressoMoeda[] = Object.entries(velas)
    .filter((e): e is [string, Vela[]] => Array.isArray(e[1]) && e[1].length > 0)
    .map(([moeda, v]) => {
      const u = v[v.length - 1];
      const ms = [u.ma50, u.ma100, u.ma200].filter((x): x is number => x != null);
      return {
        moeda, n: condicoesCumpridas(v), descida: emDescida(v),
        paraComprar: ms.length === 3 ? (Math.max(...ms) / u.preco - 1) * 100 : undefined,
        paraVender: ms.length === 3 ? (1 - Math.min(...ms) / u.preco) * 100 : undefined,
      };
    });
  const distMin = Math.min(10, ...progresso.map((p) => sinalMaisProximo(p).dist));

  const activos: Activo[] = ["BTC", "ETH"].map((m) => {
    const perp = d?.perps.find((p) => p.moeda === m), vista = d?.vista.find((v) => v.moeda === m);
    const vendido = !!perp && perp.qtd < 0, comprado = !!vista || (!!perp && perp.qtd > 0);
    const valor = Math.abs(perp?.valor ?? 0) + (vista?.valor ?? 0);
    return {
      nome: m,
      valor: d ? `$${preco(d.mids[m as "BTC" | "ETH"])}` : "—",
      linha2: vendido ? `Aposta na descida: $${dinheiro(valor)}` : comprado ? `Investido: $${dinheiro(valor)}` : "Sem posição",
      etiqueta: vendido ? "Na descida" : comprado ? "Comprado" : "Fora",
      etiquetaActiva: vendido || comprado,
      etiquetaMau: vendido,
      extra: Array.isArray(velas[m]) && (velas[m] as Vela[]).length > 0 ? <GraficoMedias velas={velas[m] as Vela[]} /> : undefined,
    };
  });

  const linhasSaude: Ficha["linhas"] = d ? [
    bat
      ? { rotulo: "Última corrida do bot", valor: `${diaMes(bat.dia)} às ${dataHora(Date.parse(bat.registado_em)).slice(-5)} · ${bat.estado === "ok" ? "correu bem" : bat.estado}`, tom: bat.estado === "ok" ? (bat.dia === hoje || (horasBat ?? 99) < 30 ? "bom" : "aviso") : "mau", nota: "Corre todos os dias à 01h20 (Lisboa) e, se falhar, repete de hora a hora até às 06h20." }
      : { rotulo: "Última corrida do bot", valor: "sem registo", tom: "aviso" },
    { rotulo: "Vigia", valor: "todos os dias às 07h44", nota: "Confirma que as duas instâncias correram e manda aviso para o telemóvel se alguma falhou." },
    { rotulo: "Stops de emergência na corretora", valor: d.perps.length ? `${d.perps.length - semStop.length} de ${d.perps.length}` : "sem posições em perpétuos", tom: semStop.length ? "aviso" : "neutro" },
    d.agente
      ? { rotulo: "Chave do agente", valor: `válida até ${dataLonga.format(d.agente.validoAte)} (${Math.round(diasChave ?? 0)} dias)`, tom: (diasChave ?? 99) < 30 ? "aviso" : "neutro", nota: "A chave com que o bot negoceia. Não permite levantar dinheiro. Tem de ser renovada antes desta data." }
      : { rotulo: "Chave do agente", valor: "não encontrada", tom: "mau" },
    { rotulo: "Tipo de conta", valor: d.modoConta === "unifiedAccount" ? "unificada (correcto)" : d.modoConta, tom: d.modoConta === "unifiedAccount" ? "neutro" : "aviso" },
    { rotulo: "Dinheiro posto na conta", valor: `${dinheiro(d.investido)} $`, nota: "Entradas menos saídas. É a base para o resultado «desde o início»." },
    { rotulo: "Dólares parados (USDC)", valor: `${dinheiro(d.usdc)} $`, nota: "Já inclui o resultado em aberto dos contratos perpétuos." },
    { rotulo: "Comissões pagas até hoje", valor: `${comSinal(-d.custos.comissoes, 4)} $`, tom: d.custos.comissoes > 0 ? "mau" : "neutro", nota: `Em ${d.nOperacoes} ${d.nOperacoes === 1 ? "operação" : "operações"}. 0,045% por operação em perpétuos e 0,07% à vista.` },
    { rotulo: "Funding até hoje", valor: `${comSinal(d.custos.funding, 4)} $`, tom: tom(d.custos.funding), nota: "Positivo: recebeste. Negativo: pagaste." },
  ] : [];

  return (
    <BotView
      fundo={<Estrelas intensidade={Math.max(0, 1 - distMin / 10)} />}
      topo={<PainelLua progresso={progresso} />}
      nome="Selene_v1 REAL"
      motor="Claude · Hyperliquid"
      cor={SELENE_REAL_COLOR}
      explicacao="A mesma regra da Selene_v1, mas com dinheiro verdadeiro na Hyperliquid. Esta página lê a conta directamente da corretora de minuto a minuto. O bot decide uma vez por dia; entre decisões, o valor mexe com o preço."
      estado={estado}
      aviso={avisos.length ? avisos.join(" · ") : undefined}
      ligacaoExtra={{ href: "/v1", texto: "Ver a simulação →" }}
      moeda="USD"
      valorActual={d ? `$${dinheiro(capital)}` : "—"}
      resultado={{ pct: percent(investido ? (capital / investido - 1) * 100 : 0), valor: `${comSinal(pnl)} $`, tom: tom(pnl) }}
      rotuloResultado={d ? `desde o início (${dinheiro(investido)} $ postos na conta)` : "desde o início"}
      numeros={[
        { rotulo: "Últimas 24 horas", valor: d?.resultado24h == null ? "—" : `${comSinal(d.resultado24h)} $`, tom: tom(d?.resultado24h ?? 0), ajuda: "Ganho ou perda das últimas 24 horas." },
        { rotulo: "Posições em aberto", valor: `${comSinal(emAberto)} $`, tom: tom(emAberto), ajuda: "O que ganhavas ou perdias se fechasses tudo agora." },
        { rotulo: "Investido", valor: `${Math.round(exposicao)}%`, ajuda: "Parte da carteira em posições. O resto está parado em dólares." },
        { rotulo: "Pior queda", valor: percent(queda, 1), tom: queda < -0.01 ? "mau" : "neutro", ajuda: "Maior descida desde o valor mais alto. No teste histórico chegou a −23%." },
        { rotulo: "Comissões e funding", valor: `${comSinal(custoLiquido)} $`, tom: tom(custoLiquido), ajuda: "Custos de negociar, já descontados no valor da carteira." },
        { rotulo: "Operações", valor: String(d?.nOperacoes ?? 0), ajuda: "Compras e vendas feitas pelo bot." },
      ]}
      meio={<>
        <Porque itens={explicacoes} nota={d?.diaSinais ? `Calculado com os preços de fecho até ${diaMes(d.diaSinais)}. As distâncias em % são face ao preço deste momento. A decisão seguinte é na próxima madrugada.` : undefined} />
        <Posicoes fichas={fichas} vazio="Nenhuma posição aberta: a carteira está toda em dólares (USDC), à espera de um sinal." nota="Lido da Hyperliquid neste momento." />
      </>}
      grafico={{
        titulo: "Valor da conta desde o início",
        nota: "Em % sobre o dinheiro posto na conta, segundo o histórico da própria Hyperliquid.",
        dados: (d?.historico ?? []).map((p) => ({ rotulo: dataHora(p.t), real: investido ? (p.v / investido - 1) * 100 : 0 })),
        series: [{ chave: "real", nome: "Selene_v1 REAL", cor: SELENE_REAL_COLOR }],
      }}
      activosTitulo="Moedas"
      activosNota="Preço deste momento e gráficos dos últimos 5 meses (fecho diário, Kraken). A lista mostra quanto falta para comprar ou para apostar na descida."
      activos={activos}
      activosLargos
      operacoes={(d?.operacoes ?? []).map((o) => ({
        id: o.id,
        quando: dataHora(o.t),
        activo: o.moeda,
        lado: o.lado === "compra" ? "Compra" : "Venda",
        preco: preco(o.preco),
        valor: `$${dinheiro(o.valor)}`,
        resultado: Math.abs(o.resultado) > 0.00001 ? `${comSinal(o.resultado)} $` : DIR[o.dir] ?? o.dir ?? "—",
        tom: Math.abs(o.resultado) > 0.00001 ? tom(o.resultado) : "neutro",
      }))}
      colunaResultado="Resultado / tipo"
      semOperacoes="Ainda nenhuma operação na conta real."
      fim={<>
        <Saude titulo="Saúde do bot e custos" nota="Tudo o que convém estar bem para o bot trabalhar sozinho." linhas={linhasSaude} />
        <Glossario itens={[
          ...GLOSSARIO_BASE,
          ["À vista e contrato perpétuo", "Quando compra, o bot compra a moeda verdadeira (à vista), que não paga funding. Quando aposta na descida usa um contrato perpétuo, porque é a única forma de ganhar com a queda."],
          ["Stop de emergência", "Ordem que fica guardada na corretora para fechar uma aposta na descida se o preço subir 30% acima da entrada. É um seguro para o tempo entre duas decisões do bot. Se disparar, essa moeda fica fora até o sinal mudar."],
          ["Preço de liquidação", "Preço a que a corretora fecharia a posição à força por falta de margem. Como o bot não usa dinheiro emprestado, fica muito longe do preço actual."],
          ["Ao vivo", "Os valores vêm directamente da Hyperliquid e actualizam de minuto a minuto. As decisões do bot continuam a ser uma vez por dia."],
        ]} />
      </>}
      rodape="Dinheiro real. Os valores vêm da Hyperliquid e actualizam de minuto a minuto. Resultados passados não garantem resultados futuros. Não é aconselhamento financeiro."
    />
  );
}
