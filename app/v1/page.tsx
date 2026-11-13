"use client";

import SeleneSim, { type ConfigSim } from "../../components/SeleneSim";
import { SELENE_V1_COLOR } from "../../lib/selene";

/** Selene V1.4 (simulação): regra mista, apostas na descida a metade do tamanho, alvo de volatilidade 70%. */
const CFG: ConfigSim = {
  instancia: "simulacao",
  nome: "Selene_v1",
  cor: SELENE_V1_COLOR,
  explicacao: "Versão 1.4, a mais agressiva. Segue a tendência diária de BTC e ETH com duas regras de compra: preço acima das médias de 50, 100 e 200 dias, e preço acima da média de 200 dias e do fecho de há 30 dias. Cada regra vale metade da posição. Abaixo das três médias aposta na descida com metade do tamanho. Sem alavancagem, decide uma vez por dia.",
  regra: { mista: true, vendas: 0.5, volAlvo: 70 },
  hora: "01h10",
  horaFim: "06h10",
  quedaTeste: "−28% (2021–2026)",
  notaComissoes: "0,08% nas compras à vista e 0,06% nas vendas em perpétuo. O funding também é simulado.",
  semOperacoes: "Ainda nenhuma. A Selene_v1 está fora do mercado à espera de uma tendência.",
  ligacaoExtra: { href: "/v1/real", texto: "Ver a conta real →" },
};

export default function SeleneV1() {
  return <SeleneSim cfg={CFG} />;
}
