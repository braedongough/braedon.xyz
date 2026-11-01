# braedon.xyz

Personal website for Braedon Gough. A static site with no build step, styled like a 16-bit Sega Genesis game on a black arcade cabinet.

## Stack

- Plain HTML, CSS, and vanilla JS. No framework, bundler, or dependencies.
- `serve.ts` is a Bun static file server on port 3000 for local development only (`bun run dev`).
- Hosted as static files with a custom domain (`CNAME`).

## Project structure

```
index.html        About / landing page
projects.html     Project list (cartridge panels)
reading.html      Reading list, generated from a Google Sheet (see below)
cv.html           Redirect to /#cv (the CV lives on the About page)
contact.html      Contact links (arrow-key selectable menu)
404.html          "Game Over" page with auto-continue countdown
genesis.css       Single shared stylesheet
main.js           All site behavior (see below)
starfield.js      Parallax starfield canvas, loaded by main.js
fonts/            Silkscreen pixel font (woff2 + license)
core-pallet.md    Reference palette and color philosophy
serve.ts          Bun dev server
scripts/          sync-reading.ts (Google Sheet → reading.html)
.github/workflows sync-reading.yml (weekly sync)
favicon.png       Favicon
```

## Design system: "Genesis arcade"

Clean, glossy 16-bit look: near-black background, neon accents, hard edges. See `core-pallet.md` for the full palette and its philosophy.

### Rules

- No border radii (enforced globally with `border-radius: 0 !important`), no blur, no soft gradients on UI.
- Hard color boundaries, bevels, and dithering instead of smooth shading.
- Saturated, arcade-like colors only. Avoid muted, desaturated, or gray tones.
- Use the CSS custom properties in the `:root` tokens block of `genesis.css`. Don't hardcode new hex values.

### Key tokens

| Token                                | Value                                  | Usage                         |
| ------------------------------------ | -------------------------------------- | ----------------------------- |
| `--bg`                               | `#0A0A14`                              | Page background               |
| `--panel` / `--panel-deep`           | `#003B63` / `#001B35`                  | Panel fills                   |
| `--outline`                          | `#1479D1`                              | Borders, HUD rule, scrollbar  |
| `--cream`                            | `#FFF7D0`                              | Body text                     |
| `--cyan` / `--magenta` / `--lime`    | `#00D9E8` / `#F02CA8` / `#91F26A`      | Neon accents, cartridge colors |
| `--gold` / `--gold-deep`             | `#FFD91A` / `#FFB500`                  | Warm highlights               |

### Typography

- `--font-hud`: Silkscreen pixel font for HUD, labels, and headings-as-UI. Always uppercase.
- `--font-body`: system sans-serif, 18px, line-height 1.6.

### Page patterns

- Every page except 404 has the same `<nav aria-label="Main">`, with the current page marked `class="active" aria-current="page"`. `main.js` turns it into the sticky HUD bar at runtime.
- Each page's `<main>` starts directly with its `<h1>`.
- Every page has the same `site-footer` with the copyright and the Konami-code hint.
- Projects are `.cart` panels with a color modifier (`cart--cyan`, `cart--magenta`, `cart--lime`).
- The CV is on the About page (`index.html`, `#cv`) and uses `.cv-grid` with `.cv-col` sections of `.cv-entry` items (`h3`, `.role`, `.period`).
- Lists marked `data-select-menu` get arrow-key cursor navigation.
- `genesis.css` and `main.js` are organized into commented sections (`/* ---------- Name ---------- */`). Add new rules to the matching section.

## Behavior (`main.js`)

All interactivity lives in one IIFE in `main.js`, loaded with `defer` on every page:

- HUD chrome built from the page's `<nav>`.
- Arrow-key cursors for the nav and `data-select-menu` lists. Arrow keys and WASD also steer the starfield.
- Konami code (↑↑↓↓←→←→BA) sets off a burst of pixel flames from the bottom of the screen (skipped with reduced motion).
- 404 countdown back to `/`.
- Reading list search, dropdown filters, and sort, with state kept in the URL.
- Query switch: `?nostars` skips the starfield.
- Respects `prefers-reduced-motion`. The starfield renders one static frame, and animations are disabled in CSS.

## Reading list sync

- `scripts/sync-reading.ts` (`bun run sync:reading`) reads the "Reading List" tab of a private Google Sheet with a service account key in `GOOGLE_SERVICE_ACCOUNT_KEY`. It has no dependencies; it signs the OAuth JWT with Web Crypto.
- It rewrites only the block between `<!-- reading-list:start -->` and `<!-- reading-list:end -->` in `reading.html`. Don't hand-edit that block.
- Every sheet column is rendered, except headers starting with `_`. The first two columns are the title and byline. Column behavior is inferred from values: dates become the default sort (newest first), short repeating values become filter dropdowns and tags, and everything else is searchable text.
- `.github/workflows/sync-reading.yml` runs it every Monday at 06:00 UTC (and on demand) and commits `reading.html` only when it changed. It needs the `GOOGLE_SERVICE_ACCOUNT_KEY` repo secret.

## Conventions

- Keep it minimal. No new dependencies, build steps, or unnecessary wrappers.
- The site never plays sound.
- One stylesheet (`genesis.css`) and one behavior script (`main.js`, plus `starfield.js`).
- Pages must stay readable without JS. JS only adds chrome and effects.
- When adding a page, copy an existing page's `<head>`, nav, and footer exactly, and add the link to the nav on every page.
- Pages load `/genesis.css?v=N` and `/main.js?v=N`. GitHub Pages lets browsers cache assets for 10 minutes, so when a change to either file must ship together with HTML changes, bump `N` on every page (including `404.html`).

## Amp orbs

- `.agents/setup` makes sure Bun is installed.
- `.amp/services.yaml` declares the `web` service (`bun run serve.ts` on port 3000). Run `amp orb services ensure` to start it and get the portal URL.
