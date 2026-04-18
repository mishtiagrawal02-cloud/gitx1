<div align="center">

# 🛡️ GitX1 PR Moderator

**The Ultimate AI Slop Firewall for Open-Source Repositories**

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/gitx1-pr-moderator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-v0.1.0-brightgreen.svg)]()
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange.svg)]()

Protect your open-source repositories from low-effort, AI-generated pull requests without blocking genuine human contributors. **GitX1** calculates a **Slop Score** for every PR instantly, securely, and entirely locally.

</div>

---

## 🎥 See it in Action

Check out this quick demonstration of how GitX1 seamlessly integrates into your GitHub workflow:

<p align="center">
  <video src="https://github.com/mishtiagrawal02-cloud/gitx1/raw/main/assets/demo-video.mp4" controls width="100%"></video>
</p>

*(If the video doesn't load automatically, [click here to view the raw mp4 file](https://github.com/mishtiagrawal02-cloud/gitx1/raw/main/assets/demo-video.mp4).)*

---

## 🌟 Why GitX1?

The proliferation of autonomous coding agents and Large Language Models (LLMs) has reconfigured software engineering. While helpful for writing code, it has also led to an influx of "AI Slop"—low-effort, auto-generated pull requests that drain maintainer time.

**GitX1** is built to give maintainers back their time by doing the heavy lifting:

- **🕵️‍♂️ Multi-Signal Slop Analysis:** Analyzes diffs, commit messages, code burstiness, linguistic structures, and contributor history to generate an accurate 0–100 **Slop Score**.
- **🔒 100% Local & Privacy-First:** The extension makes **zero** outbound network calls to external APIs. All analysis runs directly in a sandboxed WebAssembly (WASM) runtime inside your browser. **Your proprietary code never leaves your machine.**
- **⚡ Real-Time In-DOM Badging:** A lightweight, non-intrusive score badge is injected directly into the GitHub PR page. Instantly see the likelihood of AI-generated content without leaving your workflow.
- **📊 Extended Dashboard (Side Panel):** Open Chrome's Side Panel to see exactly *why* a PR was flagged, including detailed metric breakdowns (readability engines, formulaic pattern detection, vocabulary scoring).

## 🚀 How It Works

GitX1 utilizes a distributed multi-engine analyzer built using Rust (compiled to WASM) and TypeScript content scripts:

1. **Content Script (DOM listener)** - Detects when you land on a GitHub Pull Request page.
2. **Turbo-Nav Aware** - Seamlessly handles GitHub's SPA (`turbo:load`) navigation architecture.
3. **Background Worker** - Receives the PR data and routes it to our WASM-powered analysis engines.
4. **Slop Badging** - Returns the probability score and elegantly displays it in the PR header.
5. **Dashboard** - Exposes a detailed breakdown via Chrome's Side Panel API.

```ascii
┌──────────────┐     PR_PAGE_DETECTED     ┌────────────────┐
│Content Script│ ─────────────────────▶   │ Service Worker │
│(Badge on DOM)│ ◀─────────────────────   │ (Background)   │
└──────────────┘   UPDATE_SLOP_BADGE      └────────┬───────┘
                                                   │ ▲
                                        GET_PR_DATA│ │PR_DATA_RESPONSE
                                   REQUEST_ANALYSIS│ │ANALYSIS_UPDATE
                                                   ▼ │
                                          ┌─────────────────┐
                                          │   Side Panel    │
                                          │ (Dashboard UI)  │
                                          └─────────────────┘
```

## 🏗️ Project Architecture

This repository is a monorepo consisting of four major pieces:

- `/src` & `/public`: The core Manifest V3 Chrome Extension powered by TypeScript. Fits natively into the Chrome Extension API.
- `/gitx1-wasm`: High-performance Rust engines for diff parsing and AST checking, compiled directly to WASM for browser use.
- `/landing`: Next.js 15 landing page showcasing the product, research paper, and privacy policies.
- `/server`: Node.js/TypeScript backend webhook processor for specific CI/CD repository integrations.

## 🛠️ Development & Installation

### Prerequisites
- Node.js (v18+)
- Rust & Cargo (if modifying the WASM engines)
- Chrome or Edge browser

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/mishtiagrawal02-cloud/gitx1.git
cd gitx1

# 2. Install dependencies for the extension
npm install

# 3. Build the extension (watch mode for dev)
npm run dev

# Or for a production build
npm run build
```

### Loading the Extension in Chrome

1. Build the project using `npm run dev` or `npm run build`.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click **Load unpacked** and select the generated `dist/` folder in the project directory.
5. Go to any GitHub Pull Request page.
6. The Slop Score badge will appear, and you can click the GitX1 extension icon to open the detailed Side Panel.

## 🧠 The Science

The analytical foundation of GitX1 is based on empirical research regarding AI generation footprints in code bases. To dive deeper into the multi-signal algorithm, structure, datasets, and WASM engine design:
- 📖 [Read the GitX1 Research Paper](https://gitx1.vercel.app/research-paper.pdf)
- 🌐 [Visit the Official Landing Page](https://gitx1.vercel.app/)

## 🤝 Contributing

We welcome contributions from everyone! Whether it's adding new analysis engines, improving UI, or enhancing our WASM implementation:

1. Fork the repo and create your branch from `main`.
2. Ensure you've run `npm run format` and `npm run typecheck`.
3. Submit a Pull Request with a clear description of your changes.

---

<div align="center">
  <p>Built with ❤️ by maintainers, for maintainers.</p>
  <p><strong>Open Source under the MIT License</strong></p>
</div>
