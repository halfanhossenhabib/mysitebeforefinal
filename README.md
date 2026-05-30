# Chess Mastery

A polished, mobile-first browser chess game with AI, multiple modes, and modern UX.

**Live:** [https://halfanhossenhabib.github.io/mysitebeforefinal/](https://halfanhossenhabib.github.io/mysitebeforefinal/)

## Features

- **Gameplay:** Click + drag moves, legal-move hints, capture indicators, last-move & check highlights, smooth piece animations
- **Pawn promotion:** Modal chooser (Queen, Rook, Bishop, Knight)
- **Modes:** Human vs AI, Human vs Human, AI vs AI demo
- **AI engine:** Web Worker with alpha-beta pruning, iterative deepening, piece-square tables, quiescence search, move ordering, mobility, and endgame awareness — 5 difficulty levels from Beginner to Master
- **Chess clocks:** Presets: Untimed, 1+0, 3+2, 5+0, 10+0
- **Game-end screens:** Checkmate, stalemate, draw, resignation, timeout
- **Tools:** FEN copy/load, PGN copy/download, localStorage auto-save/resume
- **Board themes:** Midnight, Classic, Mint, Slate + Classic/Outline piece styles
- **Sound effects:** Synthesized move/capture/check/castle/promote/end sounds with mute toggle
- **Accessibility:** Keyboard navigation (arrow keys + Enter), ARIA labels, focus states, prefers-reduced-motion support
- **Mobile-first:** Responsive from 320px to desktop, no horizontal scroll, 44px+ touch targets

## Tech

- **chess.js** (0.10.3 CDN) — legal move validation
- **Vanilla JS** — no framework, no build step
- **Web Worker** — AI never blocks the UI thread
- **CSS Grid + Flexbox** — responsive layout with `clamp()`, `min()`, `max()`
- **Web Audio API** — lightweight synthesized sounds

## File structure

```
index.html          — semantic HTML shell, dialogs, a11y
css/style.css       — mobile-first responsive CSS, themes
js/app.js           — UI logic, board rendering, input, clocks, save/resume
js/ai.worker.js     — alpha-beta AI engine (runs in Web Worker)
favicon.svg         — app icon
```

## How to test

1. Open `index.html` in any modern browser or deploy to GitHub Pages.
2. Play a game — click or drag pieces.
3. Try keyboard: Tab to board, arrow keys to navigate, Enter/Space to select/move.
4. Open Settings to switch mode, difficulty, time control, or theme.
5. Test on mobile — the board scales perfectly with no horizontal scroll.
6. Use Tools tab for FEN/PGN export, save/resume.

## Deploy

Push to any GitHub repo with Pages enabled — no build step needed.

## License

MIT — Halfan Hossen Habib
