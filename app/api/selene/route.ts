import { NextResponse } from "next/server";

/**
 * Selene_v1 (bot Claude): lê o estado diário publicado no Supabase do portal SER.RA
 * através da função selene_painel, protegida por token. Corre só no servidor,
 * por isso o token nunca chega ao browser.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SELENE_SUPABASE_URL;
  const key = process.env.SELENE_SUPABASE_ANON_KEY;
  const token = process.env.SELENE_TOKEN_LEITURA;
  if (!url || !key || !token) {
    return NextResponse.json({ diario: [], moedas: [], operacoes: [], erro: "Selene_v1 não configurada" });
  }
  try {
    const res = await fetch(`${url}/rest/v1/rpc/selene_painel`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" } });
  } catch (err) {
    return NextResponse.json({ diario: [], moedas: [], operacoes: [], erro: String(err) });
  }
}
