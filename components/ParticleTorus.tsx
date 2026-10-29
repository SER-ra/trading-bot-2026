"use client";

import { useEffect, useRef } from "react";

export interface TorusSlice {
  id: string;
  label: string;
  color: string;
  equity: number;
  pnl: number;
  share: number;
}

const VERT = `
attribute vec3 aPos;
attribute vec3 aColor;
attribute float aSize;
uniform mat4 uMvp;
uniform float uPoint;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 p = uMvp * vec4(aPos, 1.0);
  gl_Position = p;
  float dist = max(0.35, p.w);
  gl_PointSize = clamp(aSize * uPoint * (2.8 / dist), 1.4, 8.0);
  vColor = aColor;
  vAlpha = clamp(0.35 + 0.65 * (1.0 - p.z * 0.15), 0.25, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  core = pow(core, 1.35);
  vec3 col = mix(vColor, vec3(1.0), pow(core, 2.4) * 0.62);
  gl_FragColor = vec4(col, core * vAlpha);
}
`;

type Anchor = { x: number; y: number; z: number };

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function pnlText(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

function identity(): Float32Array {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function rotX(tilt: number): Float32Array {
  const m = identity();
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

function rotY(yaw: number): Float32Array {
  const m = identity();
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

function scaleMat(s: number): Float32Array {
  const m = identity();
  m[0] = s;
  m[5] = s;
  m[10] = s;
  return m;
}

function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const m = new Float32Array(16);
  const f = 1 / Math.tan(fov / 2);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

function buildMvp(yaw: number, tilt: number, aspect: number, cameraZ: number, fov: number, scale: number): Float32Array {
  const model = multiply(multiply(rotY(yaw), rotX(tilt)), scaleMat(scale));
  const view = identity();
  view[14] = -cameraZ;
  const proj = perspective(fov, aspect, 0.1, 80);
  return multiply(proj, multiply(view, model));
}

function project(mvp: Float32Array, x: number, y: number, z: number, width: number, height: number): { x: number; y: number } | null {
  const clipX = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
  const clipY = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
  const clipW = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
  if (clipW <= 0.05) return null;
  return {
    x: (clipX / clipW * 0.5 + 0.5) * width,
    y: (1 - (clipY / clipW * 0.5 + 0.5)) * height,
  };
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type Cloud = {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  anchors: Anchor[][];
};

function buildCloud(slices: TorusSlice[], count: number): Cloud {
  const raw = slices.map((slice) => Math.max(slice.share, 0));
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const weights = rawSum > 0 ? raw : slices.map(() => 1);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const bands = slices.map((slice, index) => {
    const start = weights.slice(0, index).reduce((a, b) => a + b, 0) / sum * Math.PI * 2;
    const end = start + weights[index] / sum * Math.PI * 2;
    return { start, end, color: hexToRgb(slice.color) };
  });
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const R = 1.5;
  const tube = 0.34;
  const uSteps = Math.ceil(Math.sqrt(count) * 1.7);
  const vSteps = Math.ceil(count / uSteps);
  let i = 0;
  for (let ui = 0; ui < uSteps && i < count; ui++) {
    for (let vi = 0; vi < vSteps && i < count; vi++) {
      const u = ((ui + Math.random() * 0.85) / uSteps) * Math.PI * 2;
      const v = ((vi + Math.random() * 0.85) / vSteps) * Math.PI * 2;
      let band = bands[bands.length - 1];
      for (const candidate of bands) {
        if (u >= candidate.start && u < candidate.end) {
          band = candidate;
          break;
        }
      }
      const halo = (ui + vi) % 9 === 0;
      const radius = tube * (halo ? 1.22 : 0.9 + Math.random() * 0.22);
      const major = R + (Math.random() - 0.5) * 0.03;
      positions[i * 3] = (major + radius * Math.cos(v)) * Math.cos(u);
      positions[i * 3 + 1] = radius * Math.sin(v);
      positions[i * 3 + 2] = (major + radius * Math.cos(v)) * Math.sin(u);
      const spark = Math.random() < 0.05;
      const dim = halo ? 0.55 : 0.82 + Math.random() * 0.18;
      colors[i * 3] = spark ? Math.min(1, band.color[0] + 0.35) : band.color[0] * dim;
      colors[i * 3 + 1] = spark ? Math.min(1, band.color[1] + 0.35) : band.color[1] * dim;
      colors[i * 3 + 2] = spark ? Math.min(1, band.color[2] + 0.35) : band.color[2] * dim;
      sizes[i] = halo ? 1.3 : 2.1 + Math.random() * 1.5;
      i++;
    }
  }
  const anchors = bands.map((band) => {
    const pts: Anchor[] = [];
    for (let k = 0; k < 14; k++) {
      const u = band.start + ((k + 0.5) / 14) * (band.end - band.start);
      pts.push({
        x: (R + tube) * Math.cos(u),
        y: 0,
        z: (R + tube) * Math.sin(u),
      });
    }
    return pts;
  });
  return { positions, colors, sizes, anchors };
}

function labelPlaces(count: number): { side: "left" | "right"; top: string }[] {
  const rows = Math.ceil(count / 2);
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 2);
    const top = rows <= 1 ? 42 : 8 + (row * 70) / (rows - 1);
    return { side: index % 2 === 0 ? "left" : "right", top: `${top}%` };
  });
}

export default function ParticleTorus({ slices, total }: { slices: TorusSlice[]; total: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const yawRef = useRef(0.4);
  const slicesRef = useRef(slices);
  const reducedRef = useRef(false);
  slicesRef.current = slices;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reducedRef.current = media.matches;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = glRef.current;
    const lines = lineRef.current;
    if (!wrap || !canvas || !lines) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });
    const ctx = lines.getContext("2d");
    if (!gl || !ctx) return;

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    const posBuf = gl.createBuffer();
    const colorBuf = gl.createBuffer();
    const sizeBuf = gl.createBuffer();
    const posLoc = gl.getAttribLocation(program, "aPos");
    const colorLoc = gl.getAttribLocation(program, "aColor");
    const sizeLoc = gl.getAttribLocation(program, "aSize");
    const mvpLoc = gl.getUniformLocation(program, "uMvp");
    const pointLoc = gl.getUniformLocation(program, "uPoint");

    let cloud = buildCloud(slicesRef.current, 1000);
    let count = 0;
    let signature = "";
    const upload = () => {
      const narrow = wrap.clientWidth < 720;
      const nextCount = narrow ? 2600 : 8200;
      const nextSignature = `${nextCount}|${slicesRef.current.map((slice) => `${slice.id}:${slice.equity.toFixed(2)}:${slice.color}`).join("|")}`;
      if (nextSignature === signature) return;
      signature = nextSignature;
      count = nextCount;
      cloud = buildCloud(slicesRef.current, count);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, cloud.positions, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, cloud.colors, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, cloud.sizes, gl.STATIC_DRAW);
    };
    upload();

    let cssW = 0;
    let cssH = 0;
    let ends: { x: number; y: number; side: string }[] = [];
    const measure = () => {
      const wrapBox = wrap.getBoundingClientRect();
      ends = [...wrap.querySelectorAll<HTMLElement>(".td-viz-label")].map((label) => {
        const rect = label.getBoundingClientRect();
        const side = label.dataset.side || "left";
        return {
          side,
          x: (side === "right" ? rect.left : rect.right) - wrapBox.left,
          y: rect.top + rect.height / 2 - wrapBox.top,
        };
      });
    };
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const narrow = rect.width < 720;
      const dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 1.6);
      cssW = Math.max(1, rect.width);
      cssH = Math.max(1, rect.height);
      upload();
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      lines.width = canvas.width;
      lines.height = canvas.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      measure();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let raf = 0;
    let running = true;
    let visible = true;
    const onVis = () => {
      visible = document.visibilityState !== "hidden";
    };
    document.addEventListener("visibilitychange", onVis);

    const draw = () => {
      if (!cssW || !cssH) return;
      upload();
      if (ends.length !== slicesRef.current.length) measure();
      const narrow = cssW < 720;
      if (!reducedRef.current) yawRef.current += narrow ? 0.0042 : 0.0034;
      const tilt = 0.78;
      const cameraZ = narrow ? 5.7 : 4.85;
      const fov = narrow ? 0.86 : 0.72;
      const scale = narrow ? 1.02 : 1.16;
      const mvp = buildMvp(yawRef.current, tilt, cssW / cssH, cameraZ, fov, scale);
      gl.useProgram(program);
      gl.uniformMatrix4fv(mvpLoc, false, mvp);
      gl.uniform1f(pointLoc, narrow ? 92 : 118);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
      gl.enableVertexAttribArray(sizeLoc);
      gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, count);

      const dpr = lines.width / cssW;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      const current = slicesRef.current;
      const labels = [...wrap.querySelectorAll<HTMLElement>(".td-viz-label")];
      const origin = project(mvp, 0, 0, 0, cssW, cssH) || { x: cssW / 2, y: cssH / 2 };
      labels.forEach((label, index) => {
        const samples = cloud.anchors[index];
        if (!samples || !current[index]) return;
        const projected = samples
          .map((point) => project(mvp, point.x, point.y, point.z, cssW, cssH))
          .filter((point): point is { x: number; y: number } => point != null);
        if (!projected.length) return;
        const mid = projected[Math.floor(projected.length / 2)];
        const dx = mid.x - origin.x;
        const dy = mid.y - origin.y;
        const radial = Math.hypot(dx, dy) || 1;
        const extra = narrow ? 58 : 78;
        const padX = narrow ? 48 : 72;
        const padY = narrow ? 22 : 26;
        const lx = Math.min(cssW - padX, Math.max(padX, origin.x + (dx / radial) * (radial + extra)));
        const ly = Math.min(cssH - padY, Math.max(padY, origin.y + (dy / radial) * (radial + extra)));
        label.style.left = `${lx}px`;
        label.style.top = `${ly}px`;
        label.style.right = "auto";
        label.style.transform = "translate(-50%, -50%)";
        label.style.opacity = "1";
        const pull = narrow ? 30 : 36;
        const ldx = lx - mid.x;
        const ldy = ly - mid.y;
        const llen = Math.hypot(ldx, ldy) || 1;
        const end = { x: lx - (ldx / llen) * pull, y: ly - (ldy / llen) * pull };
        const strands = [mid, projected[2] || mid, projected[projected.length - 3] || mid];
        strands.forEach((start, strand) => {
          const color = current[index].color;
          const alpha = strand === 0 ? 0.95 : 0.42;
          const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
          gradient.addColorStop(0, rgba(color, 0.15));
          gradient.addColorStop(0.55, rgba(color, alpha));
          gradient.addColorStop(1, rgba(color, 0.05));
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = strand === 0 ? 1.15 : 0.65;
          ctx.shadowColor = strand === 0 ? color : "transparent";
          ctx.shadowBlur = strand === 0 ? 6 : 0;
          ctx.stroke();
        });
      });
      ctx.shadowBlur = 0;
    };

    const loop = () => {
      if (!running) return;
      if (visible) draw();
      if (!reducedRef.current) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    draw();
    raf = requestAnimationFrame(loop);
    const reducedWatch = window.setInterval(() => {
      if (!running || reducedRef.current || raf) return;
      raf = requestAnimationFrame(loop);
    }, 400);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearInterval(reducedWatch);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(colorBuf);
      gl.deleteBuffer(sizeBuf);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, []);

  const places = labelPlaces(slices.length);

  return (
    <div className="td-viz" ref={wrapRef} aria-hidden={false}>
      <canvas ref={glRef} className="td-viz-gl" aria-hidden />
      <canvas ref={lineRef} className="td-viz-lines" aria-hidden />
      <div className="td-viz-center">
        <span className="td-label">TOTAL</span>
        <strong>{money(total)}</strong>
      </div>
      {slices.map((slice, index) => {
        const place = places[index];
        return (
          <div
            key={slice.id}
            className="td-viz-label"
            data-side={place.side}
            style={{
              top: place.top,
              left: place.side === "left" ? 0 : undefined,
              right: place.side === "right" ? 0 : undefined,
              borderColor: rgba(slice.color, 0.55),
            }}
          >
            <span className="td-viz-name" style={{ color: slice.color }}>{slice.label}</span>
            <span className="td-viz-eq">{money(slice.equity)}</span>
            <span className="td-viz-pnl" style={{ color: slice.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{pnlText(slice.pnl)}</span>
          </div>
        );
      })}
    </div>
  );
}
