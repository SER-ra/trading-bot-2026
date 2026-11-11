/** Explica por palavras o que a regra da Selene_v1 decidiu para uma moeda e o que a faria mudar. */
import type { SeleneMoeda } from "./selene";
import { preco as fp } from "./formato";

export interface Explicacao {
  moeda: string;
  estado: "comprado" | "vendido" | "fora";
  titulo: string;
  porque: string;
  muda: string[];
  tamanho: string;
}

const VOL_ALVO = 30;
const pc = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1).replace(".", ",")}%`;

export function explicar(m: SeleneMoeda, precoAgora?: number | null): Explicacao | null {
  const p = Number(m.preco), a = Number(m.ma50), b = Number(m.ma100), c = Number(m.ma200);
  if (![p, a, b, c].every((x) => Number.isFinite(x) && x > 0)) return null;
  const alta = Math.max(a, b, c), baixa = Math.min(a, b, c);
  const ref = precoAgora && precoAgora > 0 ? precoAgora : p;
  const dist = (alvo: number) => pc((alvo / ref - 1) * 100);
  const medias = `${fp(a)} (50 dias), ${fp(b)} (100) e ${fp(c)} (200)`;
  const acima = [p > a, p > b, p > c].filter(Boolean).length;
  let estado: Explicacao["estado"], titulo: string, porque: string;
  const muda: string[] = [];
  if (acima === 3) {
    estado = "comprado"; titulo = "Comprado";
    porque = `O último fecho diário foi ${fp(p)} $, acima das três médias: ${medias}. Tendência de subida, por isso está comprado.`;
    muda.push(`Vende e fica fora se um fecho diário ficar abaixo de ${fp(alta)} $ (${dist(alta)} face ao preço de agora).`);
    muda.push(`Só aposta na descida se fechar abaixo das três, ou seja abaixo de ${fp(baixa)} $ (${dist(baixa)}).`);
  } else if (acima === 0) {
    estado = "vendido"; titulo = "A apostar na descida";
    porque = `O último fecho diário foi ${fp(p)} $, abaixo das três médias: ${medias}. Tendência de descida, por isso está vendido (ganha se o preço cair).`;
    muda.push(`Fecha a aposta e fica fora se um fecho diário ficar acima de ${fp(baixa)} $ (${dist(baixa)} face ao preço de agora).`);
    muda.push(`Só compra se fechar acima das três, ou seja acima de ${fp(alta)} $ (${dist(alta)}).`);
  } else {
    estado = "fora"; titulo = "Fora do mercado";
    porque = `O último fecho diário foi ${fp(p)} $, acima de ${acima} das três médias: ${medias}. Sem tendência clara, fica em dólares à espera.`;
    muda.push(`Compra se um fecho diário ficar acima de ${fp(alta)} $ (${dist(alta)} face ao preço de agora).`);
    muda.push(`Aposta na descida se fechar abaixo de ${fp(baixa)} $ (${dist(baixa)}).`);
  }
  const vol = Number(m.vol_pct);
  let tamanho = "";
  if (Number.isFinite(vol) && vol > 0) {
    const fator = Math.min(1, VOL_ALVO / vol);
    tamanho = fator >= 0.999
      ? `Agitação do preço (volatilidade) de ${vol.toFixed(0)}% ao ano, dentro do alvo de ${VOL_ALVO}%: quando entra usa a fatia inteira desta moeda (metade da carteira).`
      : `Agitação do preço (volatilidade) de ${vol.toFixed(0)}% ao ano, acima do alvo de ${VOL_ALVO}%: quando entra usa só ${Math.round(fator * 100)}% da fatia desta moeda, ou seja cerca de ${Math.round(fator * 50)}% da carteira.`;
  }
  return { moeda: m.moeda, estado, titulo, porque, muda, tamanho };
}
