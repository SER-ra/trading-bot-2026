/** Formatação comum (pt-PT) para as duas versões. */

export const dinheiro = (n: number | null | undefined, casas = 2) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("pt-PT", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const comSinal = (n: number, casas = 2) => `${n > 0.00001 ? "+" : n < -0.00001 ? "−" : ""}${dinheiro(Math.abs(n), casas)}`;

export const percent = (n: number | null | undefined, casas = 2) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : `${n > 0.00001 ? "+" : n < -0.00001 ? "−" : ""}${Math.abs(Number(n)).toFixed(casas).replace(".", ",")}%`;

export const tom = (n: number): "bom" | "mau" | "neutro" => (n > 0.00001 ? "bom" : n < -0.00001 ? "mau" : "neutro");

export const preco = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n))
    ? "—"
    : Number(n).toLocaleString("pt-PT", { maximumFractionDigits: Number(n) < 10 ? 4 : Number(n) < 1000 ? 2 : 0 });

const fmtDataHora = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtData = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit" });

export const dataHora = (t: number) => (Number.isFinite(t) ? fmtDataHora.format(t).replace(",", "") : "—");
export const data = (t: number) => (Number.isFinite(t) ? fmtData.format(t) : "—");

export function haQuanto(horas: number): string {
  if (horas < 1) return `há ${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `há ${Math.round(horas)} h`;
  return `há ${Math.round(horas / 24)} dias`;
}

export function lado(l: string | null | undefined): string {
  const s = (l ?? "").toLowerCase();
  if (["buy", "long", "compra"].includes(s)) return "Compra";
  if (["sell", "short", "venda"].includes(s)) return "Venda";
  return l || "—";
}
