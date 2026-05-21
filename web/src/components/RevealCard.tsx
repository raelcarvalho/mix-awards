"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  title: string;
  name: string;
  nick: string;
  photoUrl: string;
  dark?: boolean;

  /** Paletas prontas (classes em globals.css) */
  theme?:
    | "amber"
    | "violet"
    | "cyan"
    | "rose"
    | "gold"
    | "red"
    | "green"
    | "sky"
    | "purple"
    | "gray"
    | "black";

  /** Cor livre (ex.: "#ef4444" | "rgb(255,0,0)" | "oklch(0.7 0.2 30)") */
  color?: string;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number };

function isImageOk(img: HTMLImageElement | null) {
  return !!(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
}

export default function RevealCard({
  title,
  name,
  nick,
  photoUrl,
  dark,
  theme = "amber",
  color,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [revealed, setRevealed] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [imgReady, setImgReady] = useState(false);
  const [usePlaceholder, setUsePlaceholder] = useState(false);

  // Dimensão ÚNICA do seu card (bate com as variáveis do CSS)
  const W = 220, H = 320;

  useEffect(() => {
    let cancelled = false;
    setImgReady(false);
    setUsePlaceholder(false);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = photoUrl;
    imgRef.current = img;

    async function load() {
      try {
        await img.decode();
        if (!cancelled && isImageOk(img)) {
          setImgReady(true);
          drawBlack();
        } else if (!cancelled) {
          setUsePlaceholder(true);
          setImgReady(false);
          drawBlack();
        }
      } catch {
        if (!cancelled) {
          setUsePlaceholder(true);
          setImgReady(false);
          drawBlack();
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [photoUrl]);

  function ctx2d() { return canvasRef.current?.getContext("2d") || null; }

  function drawBlack() {
    const ctx = ctx2d();
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = dark ? "#07111b" : "#0b1f2e";
    ctx.fillRect(0, 0, W, H);
  }

  function dustFrame(ctx: CanvasRenderingContext2D, parts: Particle[]) {
    for (const p of parts) {
      p.vy -= 0.02;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.life += 1;
      const alpha = Math.max(0, 1 - p.life / 90);
      ctx.fillStyle = `rgba(200,200,255,${alpha})`;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
  }

  async function evaporateInImage() {
    const ctx = ctx2d(); if (!ctx || !imgRef.current) return;
    setAnimating(true);
    drawBlack();

    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const octx = off.getContext("2d")!;
    octx.drawImage(imgRef.current, 0, 0, W, H);
    const imgData = octx.getImageData(0, 0, W, H).data;

    const parts: Particle[] = [];
    const step = 4;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const a = imgData[(y * W + x) * 4 + 3];
        if (a > 60) {
          parts.push({
            x: x + (Math.random() * 40 - 20),
            y: H + Math.random() * 80,
            vx: (Math.random() - 0.5) * 0.4,
            vy: -1.2 - Math.random() * 1.2,
            life: 0,
          });
        }
      }
    }

    let t = 0;
    const maxT = 110;
    const loop = () => {
      t++;
      ctx.fillStyle = dark ? "#07111b" : "#0b1f2e";
      ctx.fillRect(0, 0, W, H);

      for (const p of parts) {
        p.vx += (0 - p.vx) * 0.02;
        p.vy += (-0.8 - p.vy) * 0.02;
        p.x += p.vx; p.y += p.vy; p.life += 1;
        const alpha = Math.min(1, p.life / 20);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
        ctx.fillRect(p.x, p.y, 2, 2);
      }

      if (t > maxT * 0.65) {
        ctx.globalAlpha = (t - maxT * 0.65) / (maxT * 0.35);
        ctx.drawImage(imgRef.current!, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      if (t < maxT) requestAnimationFrame(loop);
      else {
        ctx.drawImage(imgRef.current!, 0, 0, W, H);
        setAnimating(false);
        setRevealed(true);
      }
    };
    requestAnimationFrame(loop);
  }

  async function evaporateInPlaceholder() {
    const ctx = ctx2d(); if (!ctx) return;
    setAnimating(true);
    drawBlack();

    const parts: Particle[] = [];
    for (let i = 0; i < 1200; i++) {
      parts.push({
        x: Math.random() * W,
        y: H + Math.random() * 80,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -1.0 - Math.random() * 1.4,
        life: 0,
      });
    }

    let t = 0;
    const maxT = 90;
    const loop = () => {
      t++;
      ctx.fillStyle = dark ? "#07111b" : "#0b1f2e";
      ctx.fillRect(0, 0, W, H);

      dustFrame(ctx, parts);

      if (t > maxT * 0.6) {
        ctx.globalAlpha = (t - maxT * 0.6) / (maxT * 0.4);
        const g = ctx.createRadialGradient(W/2, H/2, 10, W/2, H/2, 140);
        g.addColorStop(0, "rgba(110,180,255,0.35)");
        g.addColorStop(1, "rgba(110,180,255,0.05)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      if (t < maxT) requestAnimationFrame(loop);
      else {
        setAnimating(false);
        setRevealed(true);
      }
    };
    requestAnimationFrame(loop);
  }

  async function evaporateOut() {
    const ctx = ctx2d(); if (!ctx) return;
    setAnimating(true);

    drawBlack();
    const parts: Particle[] = [];
    for (let i = 0; i < 1200; i++) {
      parts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -1.2 - Math.random() * 1.5,
        life: 0,
      });
    }

    let t = 0;
    const maxT = 90;
    const loop = () => {
      t++;
      ctx.fillStyle = dark ? "#07111b" : "#0b1f2e";
      ctx.fillRect(0, 0, W, H);

      dustFrame(ctx, parts);

      if (t < maxT) requestAnimationFrame(loop);
      else {
        drawBlack();
        setAnimating(false);
        setRevealed(false);
      }
    };
    requestAnimationFrame(loop);
  }

  const toggle = () => {
    if (animating) return;
    if (revealed) return evaporateOut();
    return imgReady && !usePlaceholder
      ? evaporateInImage()
      : evaporateInPlaceholder();
  };

  // mapeia o tema pra classe CSS
  const themeClass =
    theme === "violet" ? "elc-violet" :
    theme === "cyan"   ? "elc-cyan"   :
    theme === "rose"   ? "elc-rose"   :
    theme === "gold"   ? "elc-gold"   :
    theme === "red"    ? "elc-red"    :
    theme === "green"  ? "elc-green"  :
    theme === "sky"    ? "elc-sky"    :
    theme === "purple" ? "elc-purple" :
    theme === "gray"   ? "elc-gray"   :
    theme === "black"  ? "elc-black"  :
                         "elc-amber";

  return (
    <div className="flex flex-col items-center electric-allow-glow">
      {/* Badge de ranking com brilho/shine */}
      <div className="rank-chip">{title}</div>

      {/* Card com o efeito elétrico */}
      <div
        className={`elc-card ${themeClass}`}
        style={{
          ["--elc-w" as any]: `${W}px`,
          ["--elc-h" as any]: `${H}px`,
          ...(color ? { ["--elc-color" as any]: color } : {}),
        }}
      >
        <div className="elc-inner">
          <div className="elc-border-outer">
            <div className="elc-main" />
          </div>
          <div className="elc-glow1" />
          <div className="elc-glow2" />
        </div>

        <div className="elc-ov1" />
        <div className="elc-ov2" />
        <div className="elc-bg" />

        {/* Conteúdo real do card (canvas + label) */}
        <div className="elc-content">
          <div className="elc-slot">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="block w-full h-full rounded-md"
            />
            {/* Nome/Nick quando revelado */}
            <div
              className={`elc-name pointer-events-none transition-opacity duration-300 ${
                revealed ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="w-full text-center rounded-md bg-black/40 backdrop-blur px-2 py-1">
                <div className="text-sm font-semibold">{nick}</div>
                <div className="text-[11px] text-slate-300">{name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={toggle}
        disabled={animating}
        className={`mt-3 px-4 py-1.5 text-sm rounded-md border transition
          ${
            animating
              ? "opacity-60 cursor-not-allowed border-fuchsia-400/40 text-fuchsia-200/50"
              : "border-fuchsia-400 text-fuchsia-200 hover:bg-fuchsia-500/10"
          }`}
        aria-label={revealed ? "Ocultar" : "Revelar"}
      >
        {revealed ? "ocultar" : "revelar"}
      </button>
    </div>
  );
}
