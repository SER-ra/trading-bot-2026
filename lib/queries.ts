import { HISTORY_START, type EquityPoint, type Trade } from "./dashboard";
import { supabase } from "./supabase";

const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

interface Page<T> {
  data: T[] | null;
  error: { message: string } | null;
}

async function fetchPages<T>(query: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  let previous = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    const signature = `${JSON.stringify(data[0])}:${data.length}:${JSON.stringify(data[data.length - 1])}`;
    if (signature === previous) break;
    previous = signature;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

export function fetchEquityHistory(): Promise<EquityPoint[]> {
  return fetchPages((from, to) =>
    supabase
      .from("equity_history")
      .select("bot, equity, timestamp")
      .gte("timestamp", HISTORY_START)
      .order("timestamp", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

export function fetchTrades(): Promise<Trade[]> {
  return fetchPages((from, to) =>
    supabase
      .from("trades")
      .select("id, bot, symbol, side, entry_price, exit_price, quantity, pnl, status, opened_at, closed_at")
      .order("opened_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
}
