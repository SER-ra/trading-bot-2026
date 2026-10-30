import { NextResponse } from "next/server";

/**
 * Velas diárias (fechadas) de BTC e ETH com as médias móveis de 50, 100 e 200 dias.
 * Fonte: API pública da Kraken (spot, USD). Cache de 1 hora.
 */
export const revalidate = 3600;

const PARES: Record<string, string> = { BTC: "XBTUSD", ETH: "ETHUSD" };
const DIAS_VISIVEIS = 150;

function media(valores: number[], fim: number, n: number): number | null {
  if (fim + 1 < n) return null;
  let s = 0;
  for (let i = fim - n + 1; i <= fim; i++) s += valores[i];
  return s / n;
}

async function velas(moeda: string) {
  const res = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${PARES[moeda]}&interval=1440`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Kraken ${res.status}`);
  const json = await res.json();
  if (json.error?.length) throw new Error(json.error.join(", "));
  const chave = Object.keys(json.result).find((k) => k !== "last")!;
  // a última vela ainda não fechou: fica de fora, como na Selene
  const linhas: [number, string, string, string, string][] = json.result[chave].slice(0, -1);
  const t = linhas.map((l) => l[0] * 1000);
  const fecho = linhas.map((l) => Number(l[4]));
  const pontos = fecho.map((c, i) => ({
    t: t[i],
    preco: c,
    ma50: media(fecho, i, 50),
    ma100: media(fecho, i, 100),
    ma200: media(fecho, i, 200),
  }));
  return pontos.slice(-DIAS_VISIVEIS);
}

export async function GET() {
  const resultado: Record<string, unknown> = {};
  await Promise.all(
    Object.keys(PARES).map(async (m) => {
      try {
        resultado[m] = await velas(m);
      } catch (e) {
        resultado[m] = { erro: String(e) };
      }
    })
  );
  return NextResponse.json(resultado, { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200" } });
}
