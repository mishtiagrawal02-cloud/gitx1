# GitX1 — PR Moderator Chrome Extension

A Manifest V3 Chrome Extension to moderate GitHub pull requests with AI-powered **Slop Score** analysis.

## Architecture

```
gitx1/
├── manifest.json              # MV3 manifest
├── webpack.config.js          # Build config (3 entry points)
├── tsconfig.json              # Strict TypeScript config
├── src/
│   ├── types/
│   │   └── messages.ts        # Shared message protocol (discriminated union)
│   ├── background/
│   │   └── service-worker.ts  # State management, message routing, analysis
│   ├── content/
│   │   ├── content-script.ts  # Lightweight badge injector
│   │   └── content.css        # Badge styles (GitHub-native look)
│   └── sidepanel/
│       ├── sidepanel.html     # Dashboard layout
│       ├── sidepanel.ts       # UI logic + messaging
│       └── sidepanel.css      # Premium dark theme
└── public/
    └── icons/                 # Extension icons (16/48/128px)
```

## Message Flow

```
┌──────────────┐     PR_PAGE_DETECTED     ┌────────────────┐
│Content Script │ ─────────────────────▶  │ Service Worker  │
│(Badge on DOM) │ ◀─────────────────────  │ (Background)    │
└──────────────┘   UPDATE_SLOP_BADGE      └────────┬───────┘
                                                    │ ▲
                                         GET_PR_DATA│ │PR_DATA_RESPONSE
                                    REQUEST_ANALYSIS│ │ANALYSIS_UPDATE
                                                    ▼ │
                                          ┌─────────────────┐
                                          │   Side Panel     │
                                          │  (Dashboard UI)  │
                                          └─────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Build in watch mode (dev)
npm run dev

# Production build
npm run build

# Type check only
npm run typecheck
```

## Loading in Chrome

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" → select the `dist/` folder
5. Navigate to any GitHub PR page
6. Click the extension icon to open the side panel

## Key Design Decisions

- **Side Panel API** — Complex analysis UI lives in the side panel, not injected into GitHub's DOM
- **Lightweight content script** — Only injects a tiny Slop Score badge (< 1KB CSS)
- **Typed messages** — All contexts share a discriminated union (`ExtensionMessage`) for type-safe messaging
- **Turbo-aware** — Content script handles GitHub's SPA navigation via `turbo:load`
- **Session storage** — PR state uses `chrome.storage.session` (scoped to browser session)
# gitx1
