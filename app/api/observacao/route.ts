import { NextResponse } from "next/server";

/**
 * Teste de observação (sem dinheiro): Ergo (ERG).
 * Preço diário agregado do CoinGecko (inclui CEX e DEX), médias de 50/100/200 dias
 * e o que a regra da Selene_v1 teria feito: entra quando as 4 condições se cumprem,
 * sai quando deixam de se cumprir. Cache de 1 hora.
 */
export const revalidate = 3600;

const DIAS_VISIVEIS = 150;
const CUSTO_POR_OPERACAO = 0.006; // 0,6% por compra ou venda (comissão + slippage estimados numa DEX pequena)

const CAPITAL = 100;
const ARRANQUE = Date.UTC(2026, 9, 27); // fecho de 27/10/2026: primeiro dia do teste

type Ponto = { t: number; preco: number; ma50: number | null; ma100: number | null; ma200: number | null };

/** Entra (tudo) quando as 4 condições se cumprem, sai quando deixam de se cumprir; custo por operação incluído. */
function simular(pontos: Ponto[], capital0: number) {
  const eventos: { t: number; tipo: "entrada" | "saida"; preco: number }[] = [];
  const serie: { t: number; valor: number }[] = [];
  let dentro = false, caixa = capital0, unidades = 0;
  for (const p of pontos) {
    const ok = p.preco > p.ma50! && p.preco > p.ma100! && p.preco > p.ma200! && p.ma50! > p.ma100! && p.ma100! > p.ma200!;
    if (ok && !dentro) {
      unidades = (caixa * (1 - CUSTO_POR_OPERACAO)) / p.preco; caixa = 0; dentro = true;
      eventos.push({ t: p.t, tipo: "entrada", preco: p.preco });
    } else if (!ok && dentro) {
      caixa = unidades * p.preco * (1 - CUSTO_POR_OPERACAO); unidades = 0; dentro = false;
      eventos.push({ t: p.t, tipo: "saida", preco: p.preco });
    }
    serie.push({ t: p.t, valor: dentro ? unidades * p.preco : caixa });
  }
  return { eventos, serie, dentro, valor: serie.at(-1)?.valor ?? capital0 };
}

function media(v: number[], fim: number, n: number): number | null {
  if (fim + 1 < n) return null;
  let s = 0;
  for (let i = fim - n + 1; i <= fim; i++) s += v[i];
  return s / n;
}

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/ergo/market_chart?vs_currency=usd&days=365&interval=daily",
      { headers: { accept: "application/json" }, next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = await res.json();

    // o ponto das 00h00 UTC do dia D é o fecho do dia D-1; o último é o preço de agora e ainda não é um fecho
    const porDia = new Map<number, number>();
    for (const [t, p] of json.prices as [number, number][]) porDia.set(Math.floor(t / 86_400_000) * 86_400_000 - 86_400_000, p);
    const dias = [...porDia.entries()].sort((a, b) => a[0] - b[0]).slice(0, -1);
    const fecho = dias.map((d) => d[1]);

    const pontos = dias.map(([t, preco], i) => ({
      t,
      preco,
      ma50: media(fecho, i, 50),
      ma100: media(fecho, i, 100),
      ma200: media(fecho, i, 200),
    }));

    const comMedias = pontos.filter((p) => p.ma50 != null && p.ma100 != null && p.ma200 != null);
    const ultimo = pontos.at(-1)!;

    // histórico: a regra desde que há média de 200 dias
    const hist = simular(comMedias, CAPITAL);
    // carteira de teste: 100 $ a contar a partir do arranque do teste
    const desdeArranque = comMedias.filter((p) => p.t >= ARRANQUE);
    const sim = simular(desdeArranque, CAPITAL);

    return NextResponse.json(
      {
        moeda: "ERG",
        nome: "Ergo",
        fonte: "CoinGecko (preço agregado)",
        velas: pontos.slice(-DIAS_VISIVEIS),
        eventos: hist.eventos,
        dentro: hist.dentro,
        desde: comMedias[0]?.t ?? null,
        retornoRegra: (hist.valor / CAPITAL - 1) * 100,
        retornoGuardar: comMedias[0] ? (ultimo.preco / comMedias[0].preco - 1) * 100 : null,
        simulacao: {
          arranque: ARRANQUE,
          capital: CAPITAL,
          valor: sim.valor,
          dentro: sim.dentro,
          eventos: sim.eventos,
          serie: sim.serie,
          guardar: desdeArranque[0] ? CAPITAL * (ultimo.preco / desdeArranque[0].preco) : CAPITAL,
          ultimoFecho: ultimo.t,
        },
        custoPorOperacao: CUSTO_POR_OPERACAO * 100,
      },
      { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200" } }
    );
  } catch (e) {
    return NextResponse.json({ erro: String(e) });
  }
}
