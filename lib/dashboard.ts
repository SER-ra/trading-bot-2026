/**
 * Known bots, in display order. A custom label or color is one new line.
 * Any other bot id that appears in equity_history or trades is appended automatically.
 */
export const STARTING_CAPITAL = 250;

/**
 * Cash added after a bot's starting capital. A deposit is not profit.
 * Add one line per top-up. `at` is the instant the cash is first included
 * in equity (inclusive): after the last snapshot that excludes it, and at
 * or before the first snapshot that includes it. P&L subtracts the capital
 * in force when each snapshot was taken, so the line does not jump.
 */
export interface Deposit {
  bot: string;
  at: string;
  amount: number;
}

export const DEPOSITS: Deposit[] = [
  // 10 Nov 2026: BTC and ETH paper capital raised from 250 to 500.
  { bot: "BTC", at: "2026-11-10T21:55:22+00:00", amount: 250 },
  { bot: "ETH", at: "2026-11-10T22:15:07+00:00", amount: 250 },
];

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
  /** Capital the bot started with, before {@link DEPOSITS}. */
  capital: number;
}

export interface CurveRow {
  time: number;
  label: string;
  values: Record<string, number | null>;
}

/** Starting capital plus every deposit booked at or before `timeMs`. */
export function capitalAt(botId: string, timeMs: number, starting = STARTING_CAPITAL): number {
  let capital = starting;
  for (const deposit of DEPOSITS) {
    if (deposit.bot !== botId || !Number.isFinite(deposit.amount)) continue;
    const at = Date.parse(deposit.at);
    if (Number.isFinite(at) && at <= timeMs) capital += deposit.amount;
  }
  return capital;
}

/** Base used for the wallet and for percentage returns. Includes deposits already in force. */
export function currentCapital(bot: { id: string; capital: number }, asOf = Date.now()): number {
  return capitalAt(bot.id, asOf, bot.capital);
}

export function returnPct(pnl: number, base: number): number {
  if (!(base > 0) || !Number.isFinite(pnl)) return 0;
  return (pnl / base) * 100;
}

/** Giveback from the high-water P&L, as a percent of the current capital base. */
export function pnlDrawdown(totals: number[], base: number): number {
  let peak = 0;
  for (const value of totals) if (Number.isFinite(value) && value > peak) peak = value;
  const current = totals.length ? totals[totals.length - 1] : 0;
  const giveback = peak - (Number.isFinite(current) ? current : 0);
  return Math.max(0, returnPct(giveback, base));
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

/** Cumulative P&L of one bot. Each point is equity minus the capital in force at that snapshot. */
export function botPnlSeries(points: EquityPoint[], botId: string, starting = STARTING_CAPITAL): number[] {
  const pnl = points
    .filter((point) => point.bot === botId)
    .map((point) => ({ time: Date.parse(point.timestamp), equity: Number(point.equity) }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.equity))
    .sort((a, b) => a.time - b.time)
    .map((point) => point.equity - capitalAt(botId, point.time, starting));
  if (pnl.length === 0) return [0, 0];
  if (pnl.length === 1) return [pnl[0], pnl[0]];
  return pnl;
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
export interface PnlRow {
  time: number;
  label: string;
  total: number;
  byBot: Record<string, number | null>;
}

/**
 * Portfolio cumulative P&L. A bot's P&L is fixed at each snapshot
 * (equity minus capital then in force) and forward-filled, so a later
 * deposit does not rewrite earlier points or print as a gain.
 */
export function buildPnlCurve(points: EquityPoint[], bots: { id: string; capital: number }[]): PnlRow[] {
  const samples = new Map<string, { bucket: number; pnl: number }[]>();
  const starting = new Map(bots.map((bot) => [bot.id, bot.capital]));
  const sorted = [...points].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  for (const point of sorted) {
    const time = Date.parse(point.timestamp);
    const equity = Number(point.equity);
    if (!point.bot || !Number.isFinite(time) || !Number.isFinite(equity)) continue;
    const bucket = Math.floor(time / MINUTE) * MINUTE;
    const pnl = equity - capitalAt(point.bot, time, starting.get(point.bot) ?? STARTING_CAPITAL);
    let list = samples.get(point.bot);
    if (!list) {
      list = [];
      samples.set(point.bot, list);
    }
    const last = list[list.length - 1];
    if (last && last.bucket === bucket) last.pnl = pnl;
    else list.push({ bucket, pnl });
  }

  const times = [...new Set([...samples.values()].flatMap((list) => list.map((sample) => sample.bucket)))].sort((a, b) => a - b);
  const cursor = new Map<string, { index: number; pnl: number | null }>();
  for (const bot of bots) cursor.set(bot.id, { index: 0, pnl: null });
  return times.map((time) => {
    let total = 0;
    const byBot: Record<string, number | null> = {};
    for (const bot of bots) {
      const list = samples.get(bot.id) ?? [];
      const state = cursor.get(bot.id)!;
      while (state.index < list.length && list[state.index].bucket <= time) {
        state.pnl = list[state.index].pnl;
        state.index += 1;
      }
      byBot[bot.id] = state.pnl;
      if (state.pnl != null) total += state.pnl;
    }
    return { time, label: formatTime(time), total, byBot };
  });
}

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
