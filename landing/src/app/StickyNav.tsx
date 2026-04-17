"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function StickyNav() {
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      /* Hero detection */
      const threshold = window.innerHeight * 0.85;
      setScrolledPastHero(window.scrollY > threshold);

      /* Page scroll progress (0–100) */
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
      setScrollProgress(Math.min(progress, 100));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-500 ease-out ${
        scrolledPastHero
          ? "border-border/60 bg-background/80 backdrop-blur-xl translate-y-0"
          : "border-transparent bg-background/60 backdrop-blur-md translate-y-0"
      }`}
    >
      {/* ── Scroll Progress Bar (2px) ──────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 h-[2px]"
        style={{
          width: `${scrollProgress}%`,
          background: "var(--accent)",
          transition: "width 0.1s linear",
        }}
        aria-hidden="true"
      />

      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <a
          href="/"
          id="nav-logo"
          className="flex items-center gap-2.5 text-heading font-semibold tracking-tight transition-opacity hover:opacity-80"
        >
          <Image
            src="/shield-icon.png"
            alt="GitX1 Logo"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span>
            GitX1
            <span className="font-normal text-foreground-muted">
              {" "}PR Moderator
            </span>
          </span>
        </a>

        {/* Nav links */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/AIMishtworking/gitx1"
            id="nav-github"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground-muted transition-colors hover:text-heading"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="#how-it-works"
            id="nav-how-it-works"
            className="hidden text-sm text-foreground-muted transition-colors hover:text-heading sm:block"
          >
            How it Works
          </a>
          <a
            href="#features"
            id="nav-features"
            className="hidden text-sm text-foreground-muted transition-colors hover:text-heading sm:block"
          >
            Features
          </a>
          <a
            href="#privacy"
            id="nav-privacy"
            className="hidden text-sm text-foreground-muted transition-colors hover:text-heading md:block"
          >
            Privacy
          </a>

          {/* Sticky CTA + Trust Signal — slides in after hero */}
          <div
            className={`flex items-center gap-2.5 transition-all duration-500 ${
              scrolledPastHero
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-4 pointer-events-none"
            }`}
          >
            {/* Trust Signal */}
            <span
              className={`hidden items-center gap-1.5 rounded-full border border-accent/20 bg-accent-light px-3 py-1.5 text-[11px] font-semibold text-accent transition-all duration-500 min-[560px]:flex ${
                scrolledPastHero
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-2"
              }`}
              style={{ transitionDelay: scrolledPastHero ? "200ms" : "0ms" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              5k+ Installs
            </span>

            {/* CTA Button */}
            <a
              href="https://chromewebstore.google.com/detail/gitx1-pr-moderator"
              id="nav-cta-chrome"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:bg-accent-hover hover:shadow-lg hover:scale-[1.03] active:scale-[0.97]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
                <line x1="12" y1="8" x2="21" y2="5" stroke="currentColor" strokeWidth="1.5" />
                <line x1="8.5" y1="14" x2="2" y2="17" stroke="currentColor" strokeWidth="1.5" />
                <line x1="15.5" y1="14" x2="17" y2="22" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="hidden min-[480px]:inline">Add to Chrome</span>
              <span className="min-[480px]:hidden">Install</span>
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}
