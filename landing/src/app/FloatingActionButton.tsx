"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ─── Speed Dial Actions ──────────────────────────────────────── */

const ACTIONS = [
  {
    label: "View Docs",
    href: "https://github.com/AIMishtworking/gitx1#readme",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="9" y1="9" x2="16" y2="9" />
        <line x1="9" y1="13" x2="14" y2="13" />
      </svg>
    ),
    color: "var(--accent)",
  },
  {
    label: "Star on GitHub",
    href: "https://github.com/AIMishtworking/gitx1",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    color: "#e6a817",
  },
  {
    label: "Join Discord",
    href: "https://discord.gg/gitx1",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
    color: "#5865F2",
  },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  FAB COMPONENT                                                   */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const fabRef = useRef<HTMLDivElement>(null);

  /* ── Scroll direction detection ────────────────────────────── */
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY.current;

        /* Only trigger after 8px of movement to avoid jitter */
        if (delta > 8) {
          /* Scrolling down → hide */
          setIsVisible(false);
          setIsOpen(false);
        } else if (delta < -8) {
          /* Scrolling up → show */
          setIsVisible(true);
        }

        lastScrollY.current = currentY;
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ── Click outside to close ────────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("click", handler);
    }
    return () => document.removeEventListener("click", handler);
  }, [isOpen]);

  /* ── Escape key to close ───────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handler);
    }
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div
      ref={fabRef}
      id="floating-action-button"
      className="fixed right-6 bottom-6 z-50 flex flex-col-reverse items-center gap-3"
      style={{
        transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease",
        transform: isVisible ? "translateY(0) scale(1)" : "translateY(24px) scale(0.8)",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
      }}
    >
      {/* ── Main FAB Button ────────────────────────────────────── */}
      <button
        id="fab-trigger"
        onClick={toggleOpen}
        aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
        aria-expanded={isOpen}
        className="group relative flex items-center justify-center rounded-full shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3D9970]"
        style={{
          width: 56,
          height: 56,
          background: "#3D9970",
          transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease",
          transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
          boxShadow: isOpen
            ? "0 6px 20px rgba(61, 153, 112, 0.4)"
            : "0 4px 14px rgba(61, 153, 112, 0.35)",
        }}
      >
        {/* Lightning bolt icon */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-300"
          style={{
            transform: isOpen ? "rotate(-45deg) scale(0.9)" : "rotate(0) scale(1)",
          }}
        >
          {isOpen ? (
            /* Plus icon (rotated 45° by parent = ×) */
            <>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </>
          ) : (
            /* Lightning bolt */
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" stroke="white" strokeWidth="1" />
          )}
        </svg>

        {/* Pulse ring on rest state */}
        {!isOpen && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{
              background: "rgba(61, 153, 112, 0.25)",
              animationDuration: "2.5s",
            }}
          />
        )}
      </button>

      {/* ── Speed Dial Actions ──────────────────────────────────── */}
      {ACTIONS.map((action, i) => {
        const reverseIndex = ACTIONS.length - 1 - i;
        /* Spring-staggered entrance: items fan out from bottom */
        const delay = isOpen ? reverseIndex * 60 : i * 30;
        const translateY = isOpen ? 0 : 20;
        const scaleVal = isOpen ? 1 : 0.3;
        const opacityVal = isOpen ? 1 : 0;

        return (
          <div
            key={action.label}
            className="flex items-center gap-3"
            style={{
              transition: `all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
              transform: `translateY(${translateY}px) scale(${scaleVal})`,
              opacity: opacityVal,
              pointerEvents: isOpen ? "auto" : "none",
            }}
          >
            {/* Tooltip label */}
            <span
              className="rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-md"
              style={{
                background: "var(--card-bg)",
                color: "var(--heading)",
                border: "1px solid var(--border)",
                transition: `opacity 0.3s ease ${delay + 100}ms`,
                opacity: isOpen ? 1 : 0,
              }}
            >
              {action.label}
            </span>

            {/* Action button */}
            <a
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              id={`fab-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
              aria-label={action.label}
              className="flex items-center justify-center rounded-full shadow-md transition-transform duration-200 hover:scale-110 active:scale-95"
              style={{
                width: 44,
                height: 44,
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                color: action.color,
              }}
            >
              {action.icon}
            </a>
          </div>
        );
      })}

      {/* ── Backdrop overlay when open ──────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 -z-10"
          style={{ background: "rgba(0, 0, 0, 0.08)" }}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
