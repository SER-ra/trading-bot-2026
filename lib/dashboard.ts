/**
 * Known bots, in display order. A custom label or color is one new line.
 * Any other bot id that appears in equity_history or trades is appended automatically.
 */
export const STARTING_CAPITAL = 250;

/** Paper session start. Earlier rows are the pre-reset 1000 USDT snapshots. */
export const HISTORY_START = "2026-10-27T15:00:00+00:00";

const TIME_ZONE = "Europe/Lisbon";

export interface EquityPoint {
  timestamp: string;
  equity: number;
  bot: string;
}

export interface Trade {
  id: string;
  bot: string;
  symbol?: string | null;
  side?: string | null;
  status?: string | null;
  quantity?: number | null;
  entry_price?: number | null;
  exit_price?: number | null;
  pnl?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
}

export interface BotProfile {
  id: string;
  label: string;
  color: string;
  capital: number;
}

export interface CurveRow {
  time: number;
  label: string;
  values: Record<string, number | null>;
}

export const KNOWN_BOTS: BotProfile[] = [
  { id: "BTC", label: "BTC", color: "#d4a017", capital: STARTING_CAPITAL },
  { id: "ETH", label: "ETH", color: "#888888", capital: STARTING_CAPITAL },
  { id: "SOL", label: "SOL", color: "#22c55e", capital: STARTING_CAPITAL },
  { id: "XRP", label: "XRP", color: "#a0a0a0", capital: STARTING_CAPITAL },
  { id: "Grid Paper Trader", label: "GRID", color: "#38bdf8", capital: STARTING_CAPITAL },
  { id: "Funding Paper Trader", label: "FUNDING", color: "#c084fc", capital: STARTING_CAPITAL },
];

const FALLBACK_COLORS = ["#2dd4bf", "#fb7185", "#fb923c", "#818cf8", "#f472b6", "#eab308"];
const SKIP_WORDS = new Set(["paper", "trader", "trading", "bot", "the", "a"]);
const MINUTE = 60_000;

const timeFormat = new Intl.DateTimeFormat("pt-PT", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(ms: number): string {
  return timeFormat.format(ms).replace(",", "");
}

export function formatPnl(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

export function deriveLabel(id: string): string {
  const words = id
    .split(/[\s_-]+/)
    .map((word) => word.trim())
    .filter((word) => word && !SKIP_WORDS.has(word.toLowerCase()));
  if (words.length === 0) return id.slice(0, 8).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 12).toUpperCase();
  return words.map((word) => word[0]).join("").slice(0, 6).toUpperCase();
}

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function withUniqueLabels(bots: BotProfile[]): BotProfile[] {
  const counts = new Map<string, number>();
  return bots.map((bot) => {
    const seen = counts.get(bot.label) ?? 0;
    counts.set(bot.label, seen + 1);
    if (seen === 0) return bot;
    return { ...bot, label: `${bot.label} ${seen + 1}` };
  });
}

export function resolveBots(points: { bot: string }[], trades: { bot: string }[]): BotProfile[] {
  const knownIds = new Set(KNOWN_BOTS.map((bot) => bot.id));
  const extras = new Set<string>();
  for (const row of points) if (row.bot && !knownIds.has(row.bot)) extras.add(row.bot);
  for (const row of trades) if (row.bot && !knownIds.has(row.bot)) extras.add(row.bot);
  const extraBots = [...extras]
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({
      id,
      label: deriveLabel(id),
      color: colorFor(id),
      capital: STARTING_CAPITAL,
    }));
  return withUniqueLabels([...KNOWN_BOTS, ...extraBots]);
}

export function isTestTrade(trade: { status?: string | null; symbol?: string | null }): boolean {
  const status = (trade.status ?? "").trim().toUpperCase();
  if (status === "TEST") return true;
  const symbol = (trade.symbol ?? "").trim().toUpperCase();
  return symbol === "TEST" || symbol.startsWith("TEST-");
}

export function isClosedTrade(trade: { status?: string | null }): boolean {
  return (trade.status ?? "").trim().toLowerCase() === "closed";
}

export function isOpenTrade(trade: { status?: string | null }): boolean {
  return (trade.status ?? "").trim().toLowerCase() === "open";
}

export function latestEquity(points: EquityPoint[], botId: string, fallback: number): number {
  let best = -Infinity;
  let value = fallback;
  for (const point of points) {
    if (point.bot !== botId) continue;
    const time = Date.parse(point.timestamp);
    const equity = Number(point.equity);
    if (!Number.isFinite(time) || !Number.isFinite(equity) || time < best) continue;
    best = time;
    value = equity;
  }
  return value;
}

export function botEquitySeries(points: EquityPoint[], botId: string, fallback: number): number[] {
  const values = points
    .filter((point) => point.bot === botId)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map((point) => Number(point.equity))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return [fallback, fallback];
  if (values.length === 1) return [values[0], values[0]];
  return values;
}

export function axisTicks(domain: [number, number]): number[] {
  const [min, max] = domain;
  const span = max - min;
  if (!(span > 0)) return [Math.round(min * 100) / 100];
  const rough = span / 3;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const err = rough / pow;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * pow;
  const start = Math.ceil((min + step * 0.05) / step) * step;
  const ticks: number[] = [];
  for (let value = start; value < max - step * 0.05; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return ticks.length ? ticks : [Math.round(((min + max) / 2) * 1000) / 1000];
}

export function paddedDomain(values: number[], padRatio = 0.2): [number, number] {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return [STARTING_CAPITAL - 1, STARTING_CAPITAL + 1];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;
  const pad = span > 0 ? span * padRatio : Math.max(Math.abs(max) * 0.004, 0.5);
  return [min - pad, max + pad];
}

/**
 * One point per UTC minute. Each bot keeps its last known equity from the
 * first minute it prints, so lines stay continuous when snapshots don't share
 * a timestamp. Minutes before a bot's first row stay null.
 */
export function buildEquityCurve(points: EquityPoint[], bots: { id: string }[]): CurveRow[] {
  const buckets = new Map<number, Map<string, number>>();
  const sorted = [...points].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  for (const point of sorted) {
    const time = Date.parse(point.timestamp);
    const equity = Number(point.equity);
    if (!point.bot || !Number.isFinite(time) || !Number.isFinite(equity)) continue;
    const bucket = Math.floor(time / MINUTE) * MINUTE;
    let slot = buckets.get(bucket);
    if (!slot) {
      slot = new Map();
      buckets.set(bucket, slot);
    }
    slot.set(point.bot, equity);
  }

  const botIds = bots.map((bot) => bot.id);
  const last: Record<string, number | undefined> = {};
  return [...buckets.keys()].sort((a, b) => a - b).map((time) => {
    const slot = buckets.get(time)!;
    for (const [botId, equity] of slot) last[botId] = equity;
    const values: Record<string, number | null> = {};
    for (const botId of botIds) values[botId] = last[botId] ?? null;
    return { time, label: formatTime(time), values };
  });
}

export function curveDomain(rows: CurveRow[], botIds: string[]): [number, number] {
  const values: number[] = [];
  for (const row of rows) {
    for (const botId of botIds) {
      const value = row.values[botId];
      if (value != null && Number.isFinite(value)) values.push(value);
    }
  }
  return paddedDomain(values, 0.16);
}

export function chartRows(rows: CurveRow[]): Array<Record<string, number | string | null>> {
  return rows.map((row) => ({ time: row.time, label: row.label, ...row.values }));
}

export function winRate(trades: Trade[]): number {
  const closed = trades.filter((trade) => !isTestTrade(trade) && isClosedTrade(trade));
  if (!closed.length) return 0;
  const wins = closed.filter((trade) => Number(trade.pnl) > 0).length;
  return (wins / closed.length) * 100;
}

export function tradeSummary(closed: number, open: number, rate: number): string {
  const wr = `WR ${rate.toFixed(0)}%`;
  if (open > 0 && closed > 0) return `${wr} · ${closed} closed · ${open} open`;
  if (open > 0) return `${wr} · ${open} open`;
  return `${wr} · ${closed} trades`;
}

export function sortTradesNewest(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const ta = Date.parse(a.closed_at || a.opened_at || "") || 0;
    const tb = Date.parse(b.closed_at || b.opened_at || "") || 0;
    if (tb !== ta) return tb - ta;
    return String(b.id).localeCompare(String(a.id));
  });
}
