import type { BotProfile, EquityPoint } from "./dashboard";

/** Os bots da Selene_v2 registam de 2 em 2 horas: sem registo há mais de 6 h conta como parado. */
export const LIMITE_ACTIVO_HORAS = 6;

export interface EstadoBot {
  id: string;
  activo: boolean;
  horas: number | null; // horas desde o último registo (null = nunca registou)
}

export function estadoBots(pontos: EquityPoint[], bots: BotProfile[], agora = Date.now()): EstadoBot[] {
  const ultimo = new Map<string, number>();
  for (const p of pontos) {
    const t = Date.parse(p.timestamp);
    if (Number.isFinite(t) && t > (ultimo.get(p.bot) ?? 0)) ultimo.set(p.bot, t);
  }
  return bots.map((b) => {
    const t = ultimo.get(b.id);
    const horas = t ? (agora - t) / 3_600_000 : null;
    return { id: b.id, horas, activo: horas != null && horas <= LIMITE_ACTIVO_HORAS };
  });
}
