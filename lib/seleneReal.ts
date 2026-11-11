/** Selene_v1 REAL — tipos e leitura do estado ao vivo (via /api/selene-real). */
import type { SeleneMoeda } from "./selene";

export interface PosPerp {
  moeda: string; qtd: number; entrada: number; preco: number; valor: number;
  resultado: number; resultadoPct: number; liquidacao: number | null; fundingRecebido: number;
  stop: { nivel: number; qtd: number; desde: number } | null;
}
export interface PosVista { moeda: string; qtd: number; preco: number; valor: number; custo: number; entrada: number; resultado: number }
export interface OpReal { id: string; t: number; moeda: string; mercado: string; lado: string; dir: string; preco: number; qtd: number; valor: number; comissao: number; resultado: number }
export interface Batimento { instancia: string; dia: string; estado: "ok" | "incompleta" | "erro"; equity: number | null; detalhe: string | null; registado_em: string }

export interface SeleneReal {
  erro?: string;
  agora: number;
  capital: number; usdc: number; investido: number; resultado24h: number | null;
  modoConta: string;
  perps: PosPerp[]; vista: PosVista[];
  outrasOrdens: number;
  historico: { t: number; v: number }[];
  operacoes: OpReal[]; nOperacoes: number;
  custos: { comissoes: number; funding: number };
  agente: { nome: string; validoAte: number } | null;
  sinais: SeleneMoeda[]; diaSinais: string | null;
  batimento: Batimento | null;
  mids: { BTC: number; ETH: number };
}

export const SELENE_REAL_COLOR = "#7fd6c2";

export async function fetchSeleneReal(): Promise<SeleneReal> {
  const res = await fetch("/api/selene-real", { cache: "no-store" });
  if (!res.ok) throw new Error(`Selene REAL ${res.status}`);
  return res.json();
}

export function piorQueda(h: { v: number }[]): number {
  let pico = -Infinity, q = 0;
  for (const p of h) { pico = Math.max(pico, p.v); q = Math.min(q, (p.v / pico - 1) * 100); }
  return q;
}
