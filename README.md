# Games Hub - Halfan Hossen Habib

A modern, single-page Games Hub for Halfan Hossen Habib's GitHub Pages site, restyled to match the "Midnight Lab" theme of the main portfolio at [halfanhossenhabib.github.io/mysite](https://halfanhossenhabib.github.io/mysite/).

The page lists playful HTML / CSS / JavaScript games and links out to each one. It uses a deep teal/mint/cyan dark theme, glassmorphism cards, an animated dot-grid background, ambient particles, gradient text, smooth reveal-on-scroll, and tilt + spotlight game cards.

## Featured Games

- [Chess Mastery (Powered by Lovable AI)](https://halfanhossenhabib.github.io/chess/)
- [Snake Game](https://halfanhossenhabib.github.io/snakegame/)
- [Tic Tac Toe](https://halfanhossenhabib.github.io/tic-tac-toe/)
- [Neon Gravity](https://halfanhossenhabib.github.io/neongravity/)
- [Neon Stack](https://halfanhossenhabib.github.io/neonstack/)

## Technologies Used

- HTML5
- CSS3 (custom properties, glassmorphism, gradients, dot-grid background)
- Vanilla JavaScript (IntersectionObserver, Canvas particles, tilt/spotlight cards)
- Font Awesome (icons)
- Google Fonts (Inter, Space Grotesk, JetBrains Mono)
- GitHub Pages

No build step. No frameworks. The page is a single `index.html` with inlined CSS and JS plus a small `favicon.svg`.

## Local Setup

Serve the folder with any static web server, for example:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Build and Deploy

This is a plain static site, so there is nothing to compile.

1. Edit `index.html` (or `favicon.svg`).
2. Test locally with a static server.
3. Commit and push to the GitHub Pages branch.
4. GitHub Pages will publish the updated files automatically.

## Theme

The site uses the Midnight Lab palette from the main portfolio:

```css
--bg: #02110f;
--bg-2: #06211f;
--bg-3: #082f2d;
--surface: rgba(8, 47, 45, 0.68);
--surface-2: rgba(6, 33, 31, 0.86);
--ink: #f0fdfa;
--ink-2: #ccfbf1;
--muted: #8bb8b1;
--line: rgba(45, 212, 191, 0.18);
--line-2: rgba(45, 212, 191, 0.28);
--line-bright: rgba(45, 212, 191, 0.58);
--cyan: #06b6d4;
--teal: #2dd4bf;
--mint: #10b981;
--grad: linear-gradient(135deg, #06b6d4 0%, #2dd4bf 55%, #10b981 100%);
```

## Accessibility

- Semantic landmarks (`header`, `main`, `section`, `footer`).
- Skip link to the games grid.
- Visible 2px teal focus rings on all interactive elements.
- ARIA labels on the navigation, mobile menu toggle, hero visual, and footer.
- Honors `prefers-reduced-motion` (animations and transitions collapse to ~1ms).

## External Links Preserved

- Home (portfolio): `https://halfanhossenhabib.github.io/mysite/`
- Projects: `https://halfanhossenhabib.github.io/mysite/#projects`
- Contact: `https://halfanhossenhabib.github.io/mysite/#contact`
