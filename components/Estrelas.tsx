"use client";

import { useEffect, useRef } from "react";

/**
 * Céu da Selene_v1: três camadas de estrelas a deslizar a velocidades diferentes (paralaxe),
 * as mais próximas com brilho e cintilação em cruz, e estrelas cadentes de vez em quando.
 * `intensidade` (0..1) acompanha a lua: quanto mais perto de entrar, mais estrelas cadentes.
 * Se o sistema pedir menos movimento, desenha um céu parado, sem cadentes.
 */
export default function Estrelas({ intensidade = 0 }: { intensidade?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const intensidadeRef = useRef(intensidade);
  intensidadeRef.current = intensidade;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // halo pré-desenhado (muito mais leve do que shadowBlur em cada frame)
    const halo = document.createElement("canvas");
    halo.width = halo.height = 64;
    const hctx = halo.getContext("2d")!;
    const g = hctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,250,235,0.9)");
    g.addColorStop(0.18, "rgba(255,246,220,0.35)");
    g.addColorStop(1, "rgba(255,246,220,0)");
    hctx.fillStyle = g;
    hctx.fillRect(0, 0, 64, 64);

    type Estrela = { x: number; y: number; r: number; camada: number; f: number; b: number; cor: string; brilho: boolean };
    type Cadente = { x: number; y: number; vx: number; vy: number; vida: number; dur: number; comp: number };
    const CORES = ["233,228,212", "233,228,212", "233,228,212", "200,215,255", "255,214,180"];
    const VELOCIDADE = [0.012, 0.035, 0.08];

    let w = 0, h = 0, raf = 0, ultimo = 0, proxima = 0;
    let estrelas: Estrela[] = [];
    let cadentes: Cadente[] = [];
    let rato = { x: 0, y: 0 }, ratoSuave = { x: 0, y: 0 };

    const montar = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * h) / 6500);
      estrelas = Array.from({ length: n }, () => {
        const camada = Math.random() < 0.6 ? 0 : Math.random() < 0.75 ? 1 : 2;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: camada === 2 ? Math.random() * 0.7 + 0.9 : camada === 1 ? Math.random() * 0.5 + 0.5 : Math.random() * 0.45 + 0.2,
          camada,
          f: Math.random() * Math.PI * 2,
          b: camada === 2 ? Math.random() * 0.3 + 0.6 : Math.random() * 0.45 + 0.2,
          cor: CORES[Math.floor(Math.random() * CORES.length)],
          brilho: camada === 2 && Math.random() < 0.35,
        };
      });
    };

    const lancar = () => {
      const ang = (Math.PI / 180) * (200 + Math.random() * 25); // da direita para a esquerda, a descer
      const vel = 0.9 + Math.random() * 0.7; // px por ms
      cadentes.push({
        x: w * (0.35 + Math.random() * 0.7),
        y: h * Math.random() * 0.45,
        vx: Math.cos(ang) * vel,
        vy: -Math.sin(ang) * vel,
        vida: 0,
        dur: 700 + Math.random() * 700,
        comp: 120 + Math.random() * 140,
      });
    };

    const agendar = (t: number) => {
      // sem sinal: uma cada ~12 s; lua cheia: uma cada ~2,5 s
      const media = 12000 - 9500 * Math.min(1, Math.max(0, intensidadeRef.current));
      proxima = t + media * (0.5 + Math.random());
    };

    const desenhar = (t: number) => {
      const dt = ultimo ? Math.min(t - ultimo, 50) : 16;
      ultimo = t;
      ctx.clearRect(0, 0, w, h);

      ratoSuave.x += (rato.x - ratoSuave.x) * 0.04;
      ratoSuave.y += (rato.y - ratoSuave.y) * 0.04;

      for (const s of estrelas) {
        if (!parado) {
          s.x -= VELOCIDADE[s.camada] * dt * 0.06;
          if (s.x < -4) { s.x = w + 4; s.y = Math.random() * h; }
        }
        const px = s.x + ratoSuave.x * (s.camada + 1) * 6;
        const py = s.y + ratoSuave.y * (s.camada + 1) * 6;
        const cint = parado ? 1 : 0.6 + 0.4 * Math.sin(t / (900 + s.camada * 500) + s.f);
        const a = s.b * cint;

        if (s.camada === 2) {
          const tam = s.r * (s.brilho ? 14 : 9) * (0.85 + 0.15 * cint);
          ctx.globalAlpha = a * 0.55;
          ctx.drawImage(halo, px - tam / 2, py - tam / 2, tam, tam);
          if (s.brilho && cint > 0.8) {
            // cintilação em cruz nas estrelas mais brilhantes
            const l = s.r * 7 * (cint - 0.8) * 5;
            ctx.globalAlpha = a * 0.5;
            ctx.strokeStyle = `rgb(${s.cor})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(px - l, py); ctx.lineTo(px + l, py);
            ctx.moveTo(px, py - l); ctx.lineTo(px, py + l);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = `rgb(${s.cor})`;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (!parado) {
        if (!proxima) agendar(t + 2500);
        if (t >= proxima) { lancar(); agendar(t); }
        cadentes = cadentes.filter((c) => c.vida < c.dur);
        for (const c of cadentes) {
          c.vida += dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          const p = c.vida / c.dur;
          const alfa = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
          const v = Math.hypot(c.vx, c.vy);
          const tx = c.x - (c.vx / v) * c.comp;
          const ty = c.y - (c.vy / v) * c.comp;
          const rasto = ctx.createLinearGradient(c.x, c.y, tx, ty);
          rasto.addColorStop(0, `rgba(255,250,235,${0.9 * alfa})`);
          rasto.addColorStop(0.3, `rgba(233,228,212,${0.35 * alfa})`);
          rasto.addColorStop(1, "rgba(233,228,212,0)");
          ctx.strokeStyle = rasto;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.globalAlpha = alfa;
          ctx.drawImage(halo, c.x - 12, c.y - 12, 24, 24);
          ctx.globalAlpha = 1;
        }
      }

      if (!parado) raf = requestAnimationFrame(desenhar);
    };

    const mover = (e: PointerEvent) => {
      rato = { x: (e.clientX / w - 0.5) * -2, y: (e.clientY / h - 0.5) * -2 };
    };

    montar();
    raf = requestAnimationFrame(desenhar);
    const redimensionar = () => { montar(); if (parado) desenhar(0); };
    window.addEventListener("resize", redimensionar);
    if (!parado) window.addEventListener("pointermove", mover, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", redimensionar);
      window.removeEventListener("pointermove", mover);
    };
  }, []);

  return (
    <>
      <div className="bv-nebulosa" aria-hidden />
      <canvas ref={ref} className="bv-estrelas" aria-hidden />
    </>
  );
}
