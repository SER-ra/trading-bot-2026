/** Selene_v1 (bot Claude) — tipos, leitura e cálculos para o dashboard /v1. */

export interface SeleneDia {
  dia: string;
  modo: string;
  equity: number;
  capital_inicial: number;
  pnl_dia_pct: number | null;
  total_pct: number | null;
  drawdown_pct: number | null;
  exposicao_pct: number | null;
  vela_sinal: string | null;
}

export interface SeleneMoeda {
  dia: string;
  moeda: string;
  preco: number | null;
  ma50: number | null;
  ma100: number | null;
  ma200: number | null;
  sinal: string | null;
  vol_pct: number | null;
  alvo_usd: number | null;
  actual_usd: number | null;
  accao: string | null;
}

export interface SeleneOperacao {
  id: number;
  ts: string;
  moeda: string;
  lado: string;
  quantidade: number | null;
  preco: number | null;
  valor_usd: number | null;
  comissao_usd: number | null;
  nota: string | null;
}

export interface SeleneData {
  diario: SeleneDia[];
  moedas: SeleneMoeda[];
  operacoes: SeleneOperacao[];
  erro?: string;
}

export const SELENE_V1_COLOR = "#e9e4d4";
const DIA_HORA = "T01:10:00Z";

export async function fetchSelene(): Promise<SeleneData> {
  const res = await fetch("/api/selene", { cache: "no-store" });
  if (!res.ok) throw new Error(`Selene_v1 ${res.status}`);
  return res.json();
}

export function diaTime(dia: string): number {
  return Date.parse(dia + DIA_HORA);
}

export interface SeleneResumo {
  ultimo: SeleneDia | null;
  equity: number;
  capital: number;
  pnl: number;
  retornoPct: number;
  quedaMaxPct: number;
  ultimoRegisto: number | null;
}

export function resumo(data: SeleneData | null): SeleneResumo {
  const dias = [...(data?.diario ?? [])].sort((a, b) => a.dia.localeCompare(b.dia));
  const ultimo = dias.at(-1) ?? null;
  const capital = ultimo ? Number(ultimo.capital_inicial) : 1000;
  const equity = ultimo ? Number(ultimo.equity) : capital;
  let pico = -Infinity;
  let queda = 0;
  for (const d of dias) {
    const e = Number(d.equity);
    pico = Math.max(pico, e);
    queda = Math.min(queda, (e / pico - 1) * 100);
  }
  return {
    ultimo,
    equity,
    capital,
    pnl: equity - capital,
    retornoPct: (equity / capital - 1) * 100,
    quedaMaxPct: queda,
    ultimoRegisto: ultimo ? diaTime(ultimo.dia) : null,
  };
}

/** Série diária: retorno da Selene e de "comprar e manter" BTC/ETH, em % desde o primeiro dia. */
export function serieRetorno(data: SeleneData | null) {
  const dias = [...(data?.diario ?? [])].sort((a, b) => a.dia.localeCompare(b.dia));
  const preco = (dia: string, moeda: string) =>
    data?.moedas.find((m) => m.dia === dia && m.moeda === moeda)?.preco ?? null;
  const p0 = { BTC: dias[0] ? preco(dias[0].dia, "BTC") : null, ETH: dias[0] ? preco(dias[0].dia, "ETH") : null };
  return dias.map((d) => {
    const btc = preco(d.dia, "BTC");
    const eth = preco(d.dia, "ETH");
    return {
      label: d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7),
      selene: (Number(d.equity) / Number(d.capital_inicial) - 1) * 100,
      btc: btc != null && p0.BTC ? (Number(btc) / Number(p0.BTC) - 1) * 100 : null,
      eth: eth != null && p0.ETH ? (Number(eth) / Number(p0.ETH) - 1) * 100 : null,
    };
  });
}

export function moedasDoDia(data: SeleneData | null): SeleneMoeda[] {
  const ultimo = resumo(data).ultimo;
  if (!ultimo) return [];
  return (data?.moedas ?? []).filter((m) => m.dia === ultimo.dia);
}

export function horasDesde(t: number | null): number | null {
  return t == null ? null : (Date.now() - t) / 36e5;
}

export function tempoRelativo(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} MIN`;
  if (h < 48) return `${Math.round(h)} H`;
  return `${Math.round(h / 24)} DIAS`;
}
