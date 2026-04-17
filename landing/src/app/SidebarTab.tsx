"use client";

import { useState, useRef, useEffect } from "react";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  SIDEBAR TAB — "Get Free Credits" Lead Capture                    */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function SidebarTab() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  /* Close on click outside */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      setTimeout(() => document.addEventListener("click", handler), 10);
    }
    return () => document.removeEventListener("click", handler);
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    /* In production, this would call an API. For the demo, we simulate success. */
    setSubmitted(true);
    setTimeout(() => {
      setIsOpen(false);
      setTimeout(() => setSubmitted(false), 500);
    }, 2000);
  };

  return (
    <>
      {/* ── Vertical Tab (always visible) ──────────────────────── */}
      <button
        id="sidebar-tab-trigger"
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 z-40 hidden md:flex items-center justify-center"
        style={{
          transform: "translateY(-50%) rotate(-90deg) translateX(50%)",
          transformOrigin: "right center",
          transition: "all 0.3s ease",
          opacity: isOpen ? 0 : 1,
          pointerEvents: isOpen ? "none" : "auto",
        }}
        aria-label="Open lead capture form"
      >
        <span
          className="flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg"
          style={{ background: "#3D9970" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Get Free Credits
        </span>
      </button>

      {/* ── Slide-out Panel ────────────────────────────────────── */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 z-50 h-full flex items-center pointer-events-none"
      >
        <div
          className="pointer-events-auto w-80 rounded-l-2xl border border-r-0 border-border overflow-hidden"
          style={{
            background: "var(--card-bg)",
            boxShadow: isOpen ? "-8px 0 32px rgba(0,0,0,0.12)" : "none",
            transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease",
            transform: isOpen ? "translateX(0)" : "translateX(100%)",
            opacity: isOpen ? 1 : 0,
          }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: "rgba(61, 153, 112, 0.12)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3D9970" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-heading">
                Free Credits
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground-muted/50 transition-colors hover:bg-background-subtle hover:text-heading"
              aria-label="Close panel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Panel body */}
          <div className="p-5">
            {submitted ? (
              /* Success state */
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "rgba(61, 153, 112, 0.12)" }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3D9970" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-heading">
                  You&apos;re in! 🎉
                </p>
                <p className="text-xs text-foreground-muted">
                  Check your inbox for your free credits link.
                </p>
              </div>
            ) : (
              /* Form state */
              <>
                <p className="text-sm text-foreground-muted leading-relaxed mb-1">
                  Get <strong className="text-heading">50 free analysis credits</strong> for
                  your team. No credit card required.
                </p>
                <p className="text-xs text-foreground-muted/50 mb-5">
                  We'll send your credits link — zero spam, ever.
                </p>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label
                      htmlFor="sidebar-email"
                      className="mb-1.5 block text-xs font-medium text-heading"
                    >
                      Work Email
                    </label>
                    <input
                      id="sidebar-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-heading placeholder:text-foreground-muted/40 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: "#3D9970" }}
                  >
                    Claim Free Credits →
                  </button>
                </form>

                <p className="mt-4 text-center text-[10px] text-foreground-muted/40 leading-relaxed">
                  By submitting, you agree to receive product updates.
                  <br />
                  Unsubscribe anytime. Privacy-first — always.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
