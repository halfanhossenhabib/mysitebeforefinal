# Tricks & Tips - Halfan Hossen Habib

A modern, single-page Tricks & Tips site for Halfan Hossen Habib's GitHub Pages, restyled to match the "Midnight Lab" theme of the main portfolio at [halfanhossenhabib.github.io/mysite](https://halfanhossenhabib.github.io/mysite/) and the [Games Hub](https://halfanhossenhabib.github.io/mysite-games/) companion site.

The page collects simple, learner-friendly tech tricks and walks through publishing a free website with GitHub Pages, step by step. It uses a deep teal/mint/cyan dark theme, glassmorphism guide cards, an animated dot-grid background, ambient particles, gradient text, smooth reveal-on-scroll, and tilt + spotlight cards.

## Featured Trick

- **Host Free Website on GitHub** - a 9-step beginner-friendly guide that takes you from a single `index.html` file to a public GitHub Pages link.
- Companion video: [NetworkChuck on YouTube](https://www.youtube.com/watch?v=EXfFBEuCAr0).

## Technologies Used

- HTML5
- CSS3 (custom properties, glassmorphism, gradients, dot-grid background, gradient-mask borders)
- Vanilla JavaScript (IntersectionObserver, Canvas particles, tilt/spotlight cards, magnetic hover, custom cursor)
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

- Semantic landmarks (`header`, `main`, `section`, `article`, `aside`, `footer`).
- Skip link to the main content.
- Visible 2px teal focus rings on all interactive elements.
- ARIA labels on the navigation, mobile menu toggle, hero panel, tutorial aside, and footer.
- Honors `prefers-reduced-motion` (animations and transitions collapse to ~1ms, hero title revealed immediately).

## External Links Preserved

- Home (portfolio): `https://halfanhossenhabib.github.io/mysite/`
- YouTube tutorial (NetworkChuck on GitHub Pages): `https://www.youtube.com/watch?v=EXfFBEuCAr0`
