import { NextResponse } from "next/server";

/**
 * Selene_v1 REAL: lê a conta directamente da Hyperliquid (dados públicos da conta, só leitura,
 * sem nenhuma chave) e junta-lhe os sinais do dia e o "sinal de vida" que o bot grava no Supabase.
 * Corre só no servidor: o endereço da conta e o token de leitura nunca chegam ao browser.
 */
export const dynamic = "force-dynamic";

const HL = "https://api.hyperliquid.xyz/info";
const TOKENS: Record<string, string> = { UBTC: "BTC", UETH: "ETH", USOL: "SOL" };

async function hl<T>(corpo: Record<string, unknown>): Promise<T> {
  const res = await fetch(HL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo), cache: "no-store" });
  if (!res.ok) throw new Error(`Hyperliquid ${res.status}`);
  return res.json();
}
const seguro = <T,>(p: Promise<T>, padrao: T): Promise<T> => p.catch(() => padrao);
const n = (x: unknown) => { const v = Number(x); return Number.isFinite(v) ? v : 0; };

async function painel() {
  const url = process.env.SELENE_SUPABASE_URL, key = process.env.SELENE_SUPABASE_ANON_KEY, token = process.env.SELENE_TOKEN_LEITURA;
  if (!url || !key || !token) return null;
  const res = await fetch(`${url}/rest/v1/rpc/selene_painel`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }), cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  const conta = process.env.SELENE_HL_CONTA;
  if (!conta) return NextResponse.json({ erro: "Selene REAL não configurada (falta SELENE_HL_CONTA)" });
  try {
    const eu = conta.toLowerCase();
    const [spot, perp, mids] = await Promise.all([
      hl<any>({ type: "spotClearinghouseState", user: conta }),
      hl<any>({ type: "clearinghouseState", user: conta }),
      hl<Record<string, string>>({ type: "allMids" }),
    ]);
    const [ordens, fills, ledger, funding, agentes, modoConta, portfolio, sb] = await Promise.all([
      seguro(hl<any[]>({ type: "frontendOpenOrders", user: conta }), []),
      seguro(hl<any[]>({ type: "userFills", user: conta }), []),
      seguro(hl<any[]>({ type: "userNonFundingLedgerUpdates", user: conta, startTime: 0 }), []),
      seguro(hl<any[]>({ type: "userFunding", user: conta, startTime: 0 }), []),
      seguro(hl<any[]>({ type: "extraAgents", user: conta }), []),
      seguro(hl<string>({ type: "userAbstraction", user: conta }), "?"),
      seguro(hl<any[]>({ type: "portfolio", user: conta }), []),
      seguro(painel(), null),
    ]);

    // saldos: em conta unificada o USDC já inclui o resultado por realizar dos perpétuos
    const saldos: Record<string, any> = {};
    for (const b of spot?.balances ?? []) saldos[b.coin] = b;
    const usdc = n(saldos.USDC?.total);
    const vista = Object.entries(TOKENS)
      .map(([tok, moeda]) => {
        const qtd = n(saldos[tok]?.total), px = n(mids[moeda]), custo = n(saldos[tok]?.entryNtl);
        return { moeda, qtd, preco: px, valor: qtd * px, custo, entrada: qtd > 0 ? custo / qtd : 0, resultado: qtd * px - custo };
      })
      .filter((v) => v.valor >= 2);
    const perps = (perp?.assetPositions ?? [])
      .map((a: any) => a.position)
      .filter((p: any) => n(p.szi) !== 0)
      .map((p: any) => {
        const qtd = n(p.szi), entrada = n(p.entryPx), px = n(mids[p.coin]);
        const stop = ordens.find((o) => o.coin === p.coin && o.isTrigger && o.reduceOnly && (o.side === "B") === (qtd < 0));
        return {
          moeda: p.coin as string, qtd, entrada, preco: px, valor: qtd * px,
          resultado: n(p.unrealizedPnl), resultadoPct: entrada ? (n(p.unrealizedPnl) / (Math.abs(qtd) * entrada)) * 100 : 0,
          liquidacao: p.liquidationPx == null ? null : n(p.liquidationPx),
          fundingRecebido: -n(p.cumFunding?.sinceOpen),
          stop: stop ? { nivel: n(stop.triggerPx), qtd: n(stop.sz), desde: n(stop.timestamp) } : null,
        };
      });
    const capitalAgora = usdc + vista.reduce((s, v) => s + v.valor, 0);

    // capital posto na conta = entradas − saídas
    let investido = 0;
    for (const l of ledger) {
      const d = l.delta ?? {};
      if (d.type === "deposit") investido += n(d.usdc);
      else if (d.type === "withdraw") investido -= n(d.usdc);
      else if (d.type === "send" || d.type === "spotTransfer" || d.type === "internalTransfer") {
        const v = n(d.usdcValue ?? d.usdc);
        if (String(d.destination ?? "").toLowerCase() === eu) investido += v;
        else if (String(d.user ?? "").toLowerCase() === eu) investido -= v;
      }
    }
    const tudo = (portfolio.find((p) => p[0] === "allTime")?.[1]?.accountValueHistory ?? []) as [number, string][];
    const historico = tudo.map(([t, v]) => ({ t, v: n(v) })).filter((p) => p.v > 0);
    if (investido <= 0) investido = historico[0]?.v ?? capitalAgora;
    historico.push({ t: Date.now(), v: capitalAgora });
    const dia = (portfolio.find((p) => p[0] === "day")?.[1]?.pnlHistory ?? []) as [number, string][];
    const resultado24h = dia.length ? n(dia[dia.length - 1][1]) : null;

    const comissoes = fills.reduce((s, f) => s + n(f.fee), 0);
    const fundingTotal = funding.reduce((s, f) => s + n(f.delta?.usdc), 0);
    const agente = [...agentes].sort((a, b) => n(b.validUntil) - n(a.validUntil))[0];

    const moedas = (sb?.moedas ?? []) as any[];
    const ultimoDia = moedas.reduce((m: string, x: any) => (x.dia > m ? x.dia : m), "");
    const batimentos = ((sb?.batimentos ?? []) as any[]).filter((b) => b.instancia === "real");

    return NextResponse.json(
      {
        agora: Date.now(),
        capital: capitalAgora, usdc, investido, resultado24h,
        modoConta, perps, vista,
        outrasOrdens: ordens.filter((o) => !o.isTrigger).length,
        historico,
        operacoes: fills.slice(0, 60).map((f) => ({
          id: String(f.tid), t: n(f.time), moeda: TOKENS[String(f.coin).split("/")[0]] ?? f.coin, mercado: String(f.coin).startsWith("@") || String(f.coin).includes("/") ? "à vista" : "perpétuo",
          lado: f.side === "B" ? "compra" : "venda", dir: f.dir as string, preco: n(f.px), qtd: n(f.sz), valor: n(f.px) * n(f.sz), comissao: n(f.fee), resultado: n(f.closedPnl),
        })),
        nOperacoes: fills.length,
        custos: { comissoes, funding: fundingTotal },
        agente: agente ? { nome: agente.name as string, validoAte: n(agente.validUntil) } : null,
        sinais: moedas.filter((m) => m.dia === ultimoDia),
        diaSinais: ultimoDia || null,
        batimento: batimentos[batimentos.length - 1] ?? null,
        mids: { BTC: n(mids.BTC), ETH: n(mids.ETH) },
      },
      { headers: { "Cache-Control": "s-maxage=20, stale-while-revalidate=60" } }
    );
  } catch (err) {
    return NextResponse.json({ erro: String(err) });
  }
}
