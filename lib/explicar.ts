/** Explica por palavras o que a regra da Selene decidiu para uma moeda e o que a faria mudar. */
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

/** Como a instância está configurada. Por omissão: a regra antiga (3 médias, vendas inteiras, alvo 30%), que é a da conta real. */
export interface RegraSelene {
  mista?: boolean; // metade pela regra das 3 médias, metade por "acima da média de 200 dias e do fecho de há 30 dias"
  vendas?: number; // tamanho das apostas na descida: 1 inteiras, 0.5 metade, 0 nunca
  volAlvo?: number; // alvo de volatilidade, em %
  fecho30?: number | null; // fecho de há 30 dias (só para a regra mista)
}

const pc = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1).replace(".", ",")}%`;

export function explicar(m: SeleneMoeda, precoAgora?: number | null, regra: RegraSelene = {}): Explicacao | null {
  const p = Number(m.preco), a = Number(m.ma50), b = Number(m.ma100), c = Number(m.ma200);
  if (![p, a, b, c].every((x) => Number.isFinite(x) && x > 0)) return null;
  const mista = !!regra.mista, vendas = regra.vendas ?? 1, volAlvo = regra.volAlvo ?? 30;
  const alta = Math.max(a, b, c), baixa = Math.min(a, b, c);
  const ref = precoAgora && precoAgora > 0 ? precoAgora : p;
  const dist = (alvo: number) => pc((alvo / ref - 1) * 100);
  const medias = `${fp(a)} (50 dias), ${fp(b)} (100) e ${fp(c)} (200)`;
  const acima = [p > a, p > b, p > c].filter(Boolean).length;
  const f30 = regra.fecho30 && regra.fecho30 > 0 ? regra.fecho30 : null;
  const tresMedias = acima === 3;
  // 2.ª regra da mista: acima da média de 200 dias e do fecho de há 30 dias (se não soubermos esse fecho, fica por confirmar)
  const tendencia = mista && p > c && (f30 == null ? null : p > f30);
  const txtVendas = vendas >= 1 ? "" : " com metade do tamanho";
  const descida = vendas > 0
    ? `Só aposta na descida${txtVendas} se fechar abaixo das três médias, ou seja abaixo de ${fp(baixa)} $ (${dist(baixa)}).`
    : "Nunca aposta na descida: se o preço cair, vende e fica em dólares.";
  let estado: Explicacao["estado"], titulo: string, porque: string;
  const muda: string[] = [];

  if (!mista) {
    if (tresMedias) {
      estado = "comprado"; titulo = "Comprado";
      porque = `O último fecho diário foi ${fp(p)} $, acima das três médias: ${medias}. Tendência de subida, por isso está comprado.`;
      muda.push(`Vende e fica fora se um fecho diário ficar abaixo de ${fp(alta)} $ (${dist(alta)} face ao preço de agora).`);
      muda.push(descida);
    } else if (acima === 0 && vendas > 0) {
      estado = "vendido"; titulo = vendas >= 1 ? "A apostar na descida" : "A apostar na descida (metade)";
      porque = `O último fecho diário foi ${fp(p)} $, abaixo das três médias: ${medias}. Tendência de descida, por isso está vendido${txtVendas} (ganha se o preço cair).`;
      muda.push(`Fecha a aposta e fica fora se um fecho diário ficar acima de ${fp(baixa)} $ (${dist(baixa)} face ao preço de agora).`);
      muda.push(`Só compra se fechar acima das três, ou seja acima de ${fp(alta)} $ (${dist(alta)}).`);
    } else {
      estado = "fora"; titulo = "Fora do mercado";
      porque = `O último fecho diário foi ${fp(p)} $, acima de ${acima} das três médias: ${medias}. Sem tendência clara, fica em dólares à espera.`;
      muda.push(`Compra se um fecho diário ficar acima de ${fp(alta)} $ (${dist(alta)} face ao preço de agora).`);
      muda.push(vendas > 0 ? `Aposta na descida${txtVendas} se fechar abaixo de ${fp(baixa)} $ (${dist(baixa)}).` : descida);
    }
  } else {
    const txt30 = f30 ? `o fecho de há 30 dias (${fp(f30)} $)` : "o fecho de há 30 dias";
    const regra2 = `acima da média de 200 dias (${fp(c)} $) e de ${txt30}`;
    if (tresMedias && tendencia !== false) {
      estado = "comprado"; titulo = "Comprado";
      porque = `O último fecho diário foi ${fp(p)} $, acima das três médias: ${medias}, e também ${regra2}. As duas regras dizem compra, por isso tem a posição inteira.`;
      muda.push(`Passa a metade se um fecho ficar abaixo de ${fp(alta)} $ (${dist(alta)} face ao preço de agora)${f30 ? ` ou abaixo de ${txt30}` : ""}.`);
      muda.push(`Sai por completo se falharem as duas regras: abaixo de uma das médias e abaixo da média de 200 dias ou do fecho de há 30 dias.`);
    } else if (tresMedias || tendencia) {
      estado = "comprado"; titulo = "Comprado a metade";
      porque = tresMedias
        ? `O último fecho diário foi ${fp(p)} $, acima das três médias: ${medias}, mas abaixo de ${txt30}. Só uma das duas regras diz compra, por isso tem metade da posição.`
        : `O último fecho diário foi ${fp(p)} $, ${regra2}, mas ainda não está acima das três médias: ${medias}. Só uma das duas regras diz compra, por isso tem metade da posição.`;
      muda.push(tresMedias
        ? `Passa à posição inteira se o fecho ficar acima de ${txt30}.`
        : `Passa à posição inteira se um fecho ficar acima de ${fp(alta)} $ (${dist(alta)} face ao preço de agora).`);
      muda.push(tresMedias
        ? `Sai por completo se um fecho ficar abaixo de ${fp(alta)} $ (${dist(alta)}).`
        : `Sai por completo se fechar abaixo da média de 200 dias (${fp(c)} $, ${dist(c)}) ou de ${txt30}.`);
    } else if (acima === 0 && vendas > 0) {
      estado = "vendido"; titulo = vendas >= 1 ? "A apostar na descida" : "A apostar na descida (metade)";
      porque = `O último fecho diário foi ${fp(p)} $, abaixo das três médias: ${medias}. Tendência de descida, por isso está vendido${txtVendas} (ganha se o preço cair).`;
      muda.push(`Fecha a aposta e fica fora se um fecho diário ficar acima de ${fp(baixa)} $ (${dist(baixa)} face ao preço de agora).`);
      muda.push(`Compra metade se fechar acima da média de 200 dias (${fp(c)} $, ${dist(c)}) e de ${txt30}; a posição inteira acima de ${fp(alta)} $ (${dist(alta)}).`);
    } else {
      estado = "fora"; titulo = "Fora do mercado";
      porque = acima === 0
        ? `O último fecho diário foi ${fp(p)} $, abaixo das três médias: ${medias}. Este bot não aposta na descida, por isso fica em dólares à espera.`
        : `O último fecho diário foi ${fp(p)} $, acima de ${acima} das três médias: ${medias}. Nenhuma das duas regras diz compra, por isso fica em dólares à espera.`;
      muda.push(`Compra metade se um fecho ficar acima da média de 200 dias (${fp(c)} $, ${dist(c)} face ao preço de agora) e de ${txt30}.`);
      muda.push(`Compra a posição inteira se, além disso, fechar acima das três médias, ou seja acima de ${fp(alta)} $ (${dist(alta)}).`);
      if (acima > 0 || vendas === 0) muda.push(vendas > 0 ? `Aposta na descida${txtVendas} se fechar abaixo de ${fp(baixa)} $ (${dist(baixa)}).` : descida);
    }
  }

  const vol = Number(m.vol_pct);
  let tamanho = "";
  if (Number.isFinite(vol) && vol > 0) {
    const fator = Math.min(1, volAlvo / vol);
    tamanho = fator >= 0.999
      ? `Agitação do preço (volatilidade) de ${vol.toFixed(0)}% ao ano, dentro do alvo de ${volAlvo}%: quando entra usa a fatia inteira desta moeda (metade da carteira).`
      : `Agitação do preço (volatilidade) de ${vol.toFixed(0)}% ao ano, acima do alvo de ${volAlvo}%: quando entra usa só ${Math.round(fator * 100)}% da fatia desta moeda, ou seja cerca de ${Math.round(fator * 50)}% da carteira.`;
    if (mista) tamanho += " Com só uma das duas regras a dizer compra, usa metade disso.";
    if (vendas > 0 && vendas < 1) tamanho += " Nas apostas na descida usa também metade.";
  }
  return { moeda: m.moeda, estado, titulo, porque, muda, tamanho };
}
