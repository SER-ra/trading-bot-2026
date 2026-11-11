"use client";

/** Blocos de texto simples partilhados pelas páginas da Selene_v1: o porquê, as posições, a saúde e o glossário. */
import type { Explicacao } from "../lib/explicar";

const TOM: Record<string, string> = { bom: "var(--bv-bom)", mau: "var(--bv-mau)", aviso: "var(--bv-aviso)", neutro: "var(--bv-tinta)" };

export function Porque({ itens, nota }: { itens: Explicacao[]; nota?: string }) {
  if (!itens.length) return null;
  return (
    <section className="bv-card">
      <div className="bv-sec-head"><h2>O que o bot está a fazer e porquê</h2></div>
      {nota && <p className="bv-nota">{nota}</p>}
      <div className="ex-grelha">
        {itens.map((e) => (
          <div key={e.moeda} className="ex-item">
            <div className="ex-top">
              <span className="ex-moeda">{e.moeda}</span>
              <span className={`bv-tag ${e.estado !== "fora" ? "on" : ""}${e.estado === "vendido" ? " mau" : ""}`}>{e.titulo}</span>
            </div>
            <p className="ex-porque">{e.porque}</p>
            <div className="ex-sub">O que o faria mudar</div>
            <ul className="ex-lista">{e.muda.map((t, i) => <li key={i}>{t}</li>)}</ul>
            {e.tamanho && <><div className="ex-sub">Quanto arrisca</div><p className="ex-tam">{e.tamanho}</p></>}
          </div>
        ))}
      </div>
    </section>
  );
}

export interface Ficha {
  titulo: string;
  etiqueta: string;
  etiquetaMau?: boolean;
  linhas: { rotulo: string; valor: string; tom?: "bom" | "mau" | "aviso" | "neutro"; nota?: string }[];
}

export function Posicoes({ fichas, vazio, nota }: { fichas: Ficha[]; vazio: string; nota?: string }) {
  return (
    <section className="bv-card">
      <div className="bv-sec-head"><h2>Posições abertas</h2></div>
      {nota && <p className="bv-nota">{nota}</p>}
      {fichas.length === 0 ? <div className="bv-vazio">{vazio}</div> : (
        <div className="ex-grelha">
          {fichas.map((f) => (
            <div key={f.titulo} className="ex-item">
              <div className="ex-top">
                <span className="ex-moeda">{f.titulo}</span>
                <span className={`bv-tag on${f.etiquetaMau ? " mau" : ""}`}>{f.etiqueta}</span>
              </div>
              <Linhas linhas={f.linhas} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Linhas({ linhas }: { linhas: Ficha["linhas"] }) {
  return (
    <dl className="ex-linhas">
      {linhas.map((l) => (
        <div key={l.rotulo} className="ex-linha">
          <dt>{l.rotulo}{l.nota && <small>{l.nota}</small>}</dt>
          <dd style={{ color: TOM[l.tom ?? "neutro"] }}>{l.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Saude({ titulo, nota, linhas, avisos }: { titulo: string; nota?: string; linhas: Ficha["linhas"]; avisos?: string[] }) {
  return (
    <section className="bv-card">
      <div className="bv-sec-head"><h2>{titulo}</h2></div>
      {nota && <p className="bv-nota">{nota}</p>}
      {avisos && avisos.length > 0 && <div className="ex-avisos">{avisos.map((a, i) => <p key={i}>⚠ {a}</p>)}</div>}
      <Linhas linhas={linhas} />
    </section>
  );
}

export function Glossario({ itens }: { itens: [string, string][] }) {
  return (
    <details className="bv-card ex-glossario">
      <summary>Como ler esta página</summary>
      <dl>
        {itens.map(([t, d]) => (
          <div key={t}><dt>{t}</dt><dd>{d}</dd></div>
        ))}
      </dl>
    </details>
  );
}

export const GLOSSARIO_BASE: [string, string][] = [
  ["Valor da carteira", "Quanto vale tudo neste momento: os dólares parados mais o valor das posições abertas."],
  ["Pior queda", "A maior descida da carteira desde o seu valor mais alto até agora. No teste com dados de 2018 a 2026 a pior foi de cerca de −23%."],
  ["Investido", "Que parte da carteira está em posições (compradas ou a apostar na descida). O resto está parado em dólares. Nunca passa de 100%: o bot não usa dinheiro emprestado."],
  ["Médias de 50, 100 e 200 dias", "A média dos preços de fecho dos últimos 50, 100 e 200 dias. Preço acima das três: tendência de subida. Abaixo das três: tendência de descida."],
  ["Fecho diário", "O preço à meia-noite UTC (00h ou 01h em Lisboa). O bot só olha para esse preço, uma vez por dia, e ignora o que acontece a meio do dia."],
  ["Apostar na descida (vendido)", "Posição que ganha quando o preço cai e perde quando sobe. É feita com contratos perpétuos."],
  ["Volatilidade", "Quanto o preço tem abanado nos últimos 30 dias, em % ao ano. Quanto mais agitado, mais pequena é a posição."],
  ["Funding", "Pagamento de hora a hora entre quem está comprado e quem está vendido em contratos perpétuos. Normalmente quem está vendido recebe."],
];
