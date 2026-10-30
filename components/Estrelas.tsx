"use client";

import { useEffect, useRef } from "react";

/** Fundo de estrelas subtil, a deslizar muito devagar. Pára se o sistema pedir menos movimento. */
export default function Estrelas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0;
    let estrelas: { x: number; y: number; r: number; v: number; f: number; b: number }[] = [];

    const montar = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * h) / 9000);
      estrelas = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() < 0.08 ? 1.3 : Math.random() * 0.8 + 0.25,
        v: Math.random() * 0.06 + 0.01,
        f: Math.random() * Math.PI * 2,
        b: Math.random() * 0.5 + 0.25,
      }));
    };

    const desenhar = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of estrelas) {
        if (!parado) {
          s.x -= s.v;
          if (s.x < -2) s.x = w + 2;
        }
        const a = s.b * (0.65 + 0.35 * Math.sin(t / 1400 + s.f));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(233,228,212,${a})`;
        ctx.fill();
      }
      if (!parado) raf = requestAnimationFrame(desenhar);
    };

    montar();
    raf = requestAnimationFrame(desenhar);
    const redimensionar = () => { montar(); if (parado) desenhar(0); };
    window.addEventListener("resize", redimensionar);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", redimensionar); };
  }, []);

  return <canvas ref={ref} className="bv-estrelas" aria-hidden />;
}
