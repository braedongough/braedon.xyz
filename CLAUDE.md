# braedon.xyz

Personal website for Braedon Gough — a static site with no build step.

## Stack

- Plain HTML + CSS (no framework, no bundler)
- Bun file server (`bun run serve.ts`) on port 3000
- Run `bun run dev` or `bun run serve.ts` to serve locally

## Project structure

```
index.html        — About / landing page
projects.html     — Project list
cv.html           — Experience and education
contact.html      — Contact links
styles.css        — Single shared stylesheet
serve.ts          — Bun static file server
favicon.png       — Site favicon
```

## Design system — "Editorial warmth"

New Yorker editorial feel on forge-warmed parchment. Clean serif typography with warm tones inspired by the Imskir, Iron Eater artwork.

### Color palette

| Role               | Color     | Usage                              |
| ------------------ | --------- | ---------------------------------- |
| Background         | `#FAF6F0` | Warm off-white/parchment           |
| Text               | `#2A2520` | Dark charcoal (not pure black)     |
| Accent / links     | `#B8860B` | Deep amber-gold (darkgoldenrod)    |
| Secondary text     | `#8B7D6B` | Warm gray (dates, metadata)        |
| Decorative borders | `#D4A854` | Lighter gold (hr, h2 underlines)   |
| List separators    | `#e8e0d4` | Subtle warm rule between list items|

### Typography

- Font: Georgia / Times New Roman / serif
- Body: 18px, line-height 1.6
- Nav links: small-caps, lowercase, 0.05em letter-spacing
- Headings: normal weight, 0.02em letter-spacing
- h2s have a gold bottom border

### Key patterns

- Every page has `<hr>` after `</nav>` — thin gold separator
- CV entries use a gold left border (`border-left: 2px solid #D4A854`)
- List items separated by subtle bottom borders (not last child)
- Links are amber-gold with underline offset; hover removes underline
- Nav active/hover uses gold underline with 4px offset
- Max-width: 700px, centered

## Conventions

- No JavaScript on the site (server is Bun, pages are static HTML)
- All styling in a single `styles.css` — no CSS-in-JS, no preprocessor
- Pages share identical `<nav>` with the current page marked `class="active"`
- Keep it minimal — no unnecessary divs, wrappers, or abstractions
