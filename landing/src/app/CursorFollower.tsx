"use client";

import { useEffect, useRef } from "react";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  MAGNETIC CURSOR FOLLOWER                                        */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const INTERACTIVE_SELECTORS = [
  "a",
  "button",
  "[role='button']",
  ".bento-card-glass",
  ".bento-card",
  "input",
  "textarea",
  "select",
];

const SELECTOR_STRING = INTERACTIVE_SELECTORS.join(", ");

export default function CursorFollower() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -100, y: -100 });
  const targetRef = useRef({ x: -100, y: -100 });
  const scaleRef = useRef(1);
  const targetScaleRef = useRef(1);
  const frameRef = useRef(0);
  const isTouch = useRef(false);

  useEffect(() => {
    /* Skip on touch-only devices */
    const touchCheck = () => { isTouch.current = true; };
    window.addEventListener("touchstart", touchCheck, { once: true });

    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    /* ── Mouse move ──────────────────────────────────────────── */
    const handleMouseMove = (e: MouseEvent) => {
      if (isTouch.current) return;
      targetRef.current = { x: e.clientX, y: e.clientY };

      /* Check if hovering an interactive element */
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.closest(SELECTOR_STRING)) {
        targetScaleRef.current = 2;
        ring.style.borderColor = "rgba(0, 128, 128, 0.5)";
        ring.style.background = "rgba(0, 128, 128, 0.06)";
        dot.style.opacity = "0";
      } else {
        targetScaleRef.current = 1;
        ring.style.borderColor = "rgba(0, 128, 128, 0.35)";
        ring.style.background = "transparent";
        dot.style.opacity = "1";
      }
    };

    /* ── Click pulse ─────────────────────────────────────────── */
    const handleMouseDown = () => {
      if (isTouch.current) return;
      ring.style.transition = "transform 0.1s ease";
      scaleRef.current = targetScaleRef.current * 0.75;
    };
    const handleMouseUp = () => {
      if (isTouch.current) return;
      ring.style.transition = "";
      scaleRef.current = targetScaleRef.current;
    };

    /* ── Hide on mouse leave ─────────────────────────────────── */
    const handleMouseLeave = () => {
      ring.style.opacity = "0";
      dot.style.opacity = "0";
    };
    const handleMouseEnter = () => {
      if (isTouch.current) return;
      ring.style.opacity = "1";
      dot.style.opacity = "1";
    };

    /* ── Animation loop (smooth lerp) ────────────────────────── */
    const animate = () => {
      const lerp = 0.15;
      posRef.current.x += (targetRef.current.x - posRef.current.x) * lerp;
      posRef.current.y += (targetRef.current.y - posRef.current.y) * lerp;
      scaleRef.current += (targetScaleRef.current - scaleRef.current) * 0.12;

      const x = posRef.current.x;
      const y = posRef.current.y;
      const s = scaleRef.current;

      ring.style.transform = `translate(${x - 18}px, ${y - 18}px) scale(${s})`;
      dot.style.transform = `translate(${x - 3}px, ${y - 3}px)`;

      frameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    document.documentElement.addEventListener("mouseenter", handleMouseEnter);

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
      window.removeEventListener("touchstart", touchCheck);
    };
  }, []);

  return (
    <>
      {/* Outer ring */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] hidden md:block"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "1.5px solid rgba(0, 128, 128, 0.35)",
          transition: "border-color 0.25s ease, background 0.25s ease, opacity 0.3s ease",
          willChange: "transform",
        }}
        aria-hidden="true"
      />
      {/* Inner dot */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] hidden md:block"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--accent)",
          transition: "opacity 0.2s ease",
          willChange: "transform",
        }}
        aria-hidden="true"
      />
    </>
  );
}
