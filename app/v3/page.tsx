"use client";

import SeleneSim, { type ConfigSim } from "../../components/SeleneSim";
import { SELENE_V3_COLOR } from "../../lib/selene";

/** Selene v3 (simulação): a mesma regra mista, mas só compras à vista — nunca aposta na descida. Alvo de volatilidade 80%. */
const CFG: ConfigSim = {
  instancia: "v3",
  nome: "Selene_v3",
  cor: SELENE_V3_COLOR,
  explicacao: "Só compra, nunca aposta na descida. Segue a tendência diária de BTC e ETH com duas regras de compra: preço acima das médias de 50, 100 e 200 dias, e preço acima da média de 200 dias e do fecho de há 30 dias. Cada regra vale metade da posição. Quando nenhuma se cumpre, vende e fica em dólares. Compras à vista, sem perpétuos nem alavancagem; decide uma vez por dia.",
  regra: { mista: true, vendas: 0, volAlvo: 80 },
  hora: "01h30",
  horaFim: "06h30",
  quedaTeste: "−22% (2021–2026)",
  notaComissoes: "0,08% em cada compra ou venda à vista. Sem perpétuos, por isso não há funding.",
  semOperacoes: "Ainda nenhuma. A Selene_v3 está em dólares à espera de uma tendência de subida.",
  ligacaoExtra: { href: "/v1", texto: "Comparar com a Selene_v1 →" },
};

export default function SeleneV3() {
  return <SeleneSim cfg={CFG} />;
}
