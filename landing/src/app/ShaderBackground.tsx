"use client";

import { useEffect, useRef, useCallback } from "react";

/* ─── Types ───────────────────────────────────────────────────── */

interface FloatingShape {
  x: number;
  y: number;
  z: number; /* depth 0-1, affects size & opacity */
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  breathePhase: number;
  breatheSpeed: number;
  type: "cube" | "hexagon" | "diamond" | "circle";
  color: string;
  opacity: number;
  /* cursor reaction state */
  pulseAmount: number;
  extraRotation: number;
}

/* ─── Constants ───────────────────────────────────────────────── */

const TEAL = "0, 128, 128";
const LEAF = "61, 153, 112";
const SHAPE_COUNT = 18;
const CURSOR_RADIUS = 180;
const DITHER_SIZE = 2;

/* ─── Shape Drawing Helpers ───────────────────────────────────── */

function drawCube(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  rot: number,
  color: string,
  alpha: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;

  const h = s * 0.35;
  /* Top face */
  ctx.fillStyle = `rgba(${color}, ${Math.min(alpha * 1.3, 0.6)})`;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s, -s + h);
  ctx.lineTo(0, -s + 2 * h);
  ctx.lineTo(-s, -s + h);
  ctx.closePath();
  ctx.fill();

  /* Left face */
  ctx.fillStyle = `rgba(${color}, ${Math.min(alpha * 0.9, 0.45)})`;
  ctx.beginPath();
  ctx.moveTo(-s, -s + h);
  ctx.lineTo(0, -s + 2 * h);
  ctx.lineTo(0, h);
  ctx.lineTo(-s, 0);
  ctx.closePath();
  ctx.fill();

  /* Right face */
  ctx.fillStyle = `rgba(${color}, ${Math.min(alpha * 1.1, 0.55)})`;
  ctx.beginPath();
  ctx.moveTo(s, -s + h);
  ctx.lineTo(0, -s + 2 * h);
  ctx.lineTo(0, h);
  ctx.lineTo(s, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  rot: number,
  color: string,
  alpha: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = `rgba(${color}, ${Math.min(alpha * 1.4, 0.5)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = s * Math.cos(angle);
    const py = s * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  /* Inner filled hexagon */
  ctx.fillStyle = `rgba(${color}, ${Math.min(alpha * 0.3, 0.12)})`;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = s * 0.6 * Math.cos(angle);
    const py = s * 0.6 * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  rot: number,
  color: string,
  alpha: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;

  ctx.fillStyle = `rgba(${color}, ${Math.min(alpha * 0.4, 0.18)})`;
  ctx.strokeStyle = `rgba(${color}, ${Math.min(alpha * 1.2, 0.45)})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.65, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.65, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  _rot: number,
  color: string,
  alpha: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  /* Outer ring */
  ctx.strokeStyle = `rgba(${color}, ${Math.min(alpha * 1.2, 0.4)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, s, 0, Math.PI * 2);
  ctx.stroke();

  /* Inner glow */
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.7);
  grad.addColorStop(0, `rgba(${color}, ${Math.min(alpha * 0.35, 0.14)})`);
  grad.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ─── Create Shapes ───────────────────────────────────────────── */

function createShapes(width: number, height: number): FloatingShape[] {
  const shapes: FloatingShape[] = [];
  const types: FloatingShape["type"][] = ["cube", "hexagon", "diamond", "circle"];

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const z = 0.2 + Math.random() * 0.8;
    shapes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      z,
      vx: (Math.random() - 0.5) * 0.3 * z,
      vy: (Math.random() - 0.5) * 0.25 * z,
      size: 14 + Math.random() * 24 * z,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.003,
      breathePhase: Math.random() * Math.PI * 2,
      breatheSpeed: 0.008 + Math.random() * 0.012,
      type: types[i % types.length],
      color: Math.random() > 0.45 ? TEAL : LEAF,
      opacity: 0.08 + z * 0.18,
      pulseAmount: 0,
      extraRotation: 0,
    });
  }
  return shapes;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  COMPONENT                                                       */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const shapesRef = useRef<FloatingShape[]>([]);
  const frameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const isDarkRef = useRef(false);

  /* ── Detect dark mode ────────────────────────────────────── */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    isDarkRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      isDarkRef.current = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── Mouse tracking ──────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  /* ── Render loop ─────────────────────────────────────────── */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const mouse = mouseRef.current;
    const isDark = isDarkRef.current;
    timeRef.current += 1;
    const t = timeRef.current;

    /* Clear */
    ctx.clearRect(0, 0, w, h);

    /* ── Layer 1: Dithered gradient that follows cursor ──── */
    const mx = Math.max(0, Math.min(mouse.x / w, 1));
    const my = Math.max(0, Math.min(mouse.y / h, 1));

    /* Smooth gradient center offset */
    const cx = w * (0.4 + mx * 0.2);
    const cy = h * (0.35 + my * 0.3);

    const gradRadius = Math.max(w, h) * 0.7;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, gradRadius);

    if (isDark) {
      grad.addColorStop(0, "rgba(0, 128, 128, 0.04)");
      grad.addColorStop(0.4, "rgba(61, 153, 112, 0.02)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    } else {
      grad.addColorStop(0, "rgba(0, 128, 128, 0.03)");
      grad.addColorStop(0.4, "rgba(61, 153, 112, 0.015)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    /* ── Layer 2: Dappled light / dithering pattern ──────── */
    const dither = ctx.createImageData(w, h);
    const dd = dither.data;
    for (let py = 0; py < h; py += DITHER_SIZE * 3) {
      for (let px = 0; px < w; px += DITHER_SIZE * 3) {
        /* Distance from cursor-influenced center */
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / gradRadius;

        /* Noise using simple hash */
        const hash =
          Math.sin(px * 12.9898 + py * 78.233 + t * 0.005) * 43758.5453;
        const noise = hash - Math.floor(hash);

        if (noise > 0.7 + dist * 0.25) {
          const idx = (py * w + px) * 4;
          if (idx + 3 < dd.length) {
            if (isDark) {
              dd[idx] = 45;
              dd[idx + 1] = 212;
              dd[idx + 2] = 191;
            } else {
              dd[idx] = 0;
              dd[idx + 1] = 128;
              dd[idx + 2] = 128;
            }
            dd[idx + 3] = Math.max(0, 12 - dist * 15);
          }
        }
      }
    }
    ctx.putImageData(dither, 0, 0);

    /* ── Layer 3: Floating shapes (UFOs) ────────────────── */
    const shapes = shapesRef.current;
    for (const shape of shapes) {
      /* Update position — drift */
      shape.x += shape.vx;
      shape.y += shape.vy;

      /* Wrap around edges with padding */
      const pad = shape.size * 2;
      if (shape.x < -pad) shape.x = w + pad;
      if (shape.x > w + pad) shape.x = -pad;
      if (shape.y < -pad) shape.y = h + pad;
      if (shape.y > h + pad) shape.y = -pad;

      /* Breathe animation */
      shape.breathePhase += shape.breatheSpeed;
      const breatheScale = 1 + Math.sin(shape.breathePhase) * 0.12;

      /* Base rotation */
      shape.rotation += shape.rotationSpeed;

      /* Cursor proximity reaction */
      const cdx = shape.x - mouse.x;
      const cdy = shape.y - (mouse.y);
      const cursorDist = Math.sqrt(cdx * cdx + cdy * cdy);
      const proximity = Math.max(0, 1 - cursorDist / CURSOR_RADIUS);

      /* Smooth pulse and rotation toward target */
      const targetPulse = proximity * 0.35;
      const targetRot = proximity * 0.06;
      shape.pulseAmount += (targetPulse - shape.pulseAmount) * 0.08;
      shape.extraRotation += (targetRot - shape.extraRotation) * 0.06;

      const totalScale = breatheScale + shape.pulseAmount;
      const totalRotation = shape.rotation + shape.extraRotation;
      const finalSize = shape.size * totalScale;
      const finalOpacity = shape.opacity + proximity * 0.12;

      /* Draw the shape */
      switch (shape.type) {
        case "cube":
          drawCube(ctx, shape.x, shape.y, finalSize, totalRotation, shape.color, finalOpacity);
          break;
        case "hexagon":
          drawHexagon(ctx, shape.x, shape.y, finalSize, totalRotation, shape.color, finalOpacity);
          break;
        case "diamond":
          drawDiamond(ctx, shape.x, shape.y, finalSize, totalRotation, shape.color, finalOpacity);
          break;
        case "circle":
          drawCircle(ctx, shape.x, shape.y, finalSize, totalRotation, shape.color, finalOpacity);
          break;
      }
    }

    ctx.globalAlpha = 1;
    frameRef.current = requestAnimationFrame(render);
  }, []);

  /* ── Init & cleanup ──────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      canvas.width = vw * dpr;
      canvas.height = vh * dpr;
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);

      /* Recreate shapes on resize */
      shapesRef.current = createShapes(vw, vh);
    };

    resize();

    /* Debounced resize handler */
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    };
    window.addEventListener("resize", handleResize);

    /* Start render loop */
    frameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
    };
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      id="shader-background"
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
