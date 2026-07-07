# PillowFlow Cinematic V4 audit

Branch: `pillowflow-cinematic-v4`

## Current project shape

- The repository is a static site. The live deck build appears to live in `deck-v3/`.
- `deck-v3/index.html` is an Astro-built static document with generated islands and existing CSS/JS assets.
- Existing motion is split across CDN GSAP/ScrollTrigger and `deck-v3/assets/v3.js`.
- Three.js is already used for the product model, with GLB/FBX assets in `deck-v3/assets/models/`.
- The V4 work has been isolated in `deck-v4/` so the current deck remains available for comparison.

## Preserved brand decisions

- Primary orange: `#f04e23`.
- Product/render orange: `#e8673a`.
- Premium warm white hero background.
- Charcoal cinematic problem/business sections.
- Pill CTA language and minimal fleet-deck navigation.

## V4 architecture decisions

- `deck-v4/index.html` owns the 11-section story shell.
- `deck-v4/v4/motion-tokens.js` centralizes durations, eases, staggers, breakpoints, and pin lengths.
- `deck-v4/v4/scroll-orchestrator.js` owns section registration, ScrollTrigger setup, desktop pinning, and mobile fallback behavior.
- `#pf-product` is one persistent fixed element. It is rendered once and positioned by the orchestrator/section modules.
- `deck-v4/v4/product-renderer.js` renders the existing `PF_Hero_Orange.optimized.glb` into the persistent product element.
- `deck-v4/v4/sections/hero.js` implements Task 02 and demonstrates the section contract for Tasks 03-11.

## Known follow-on work

- Task 03 should reuse `#seat-landing-anchor` and `ctx.productFlightVars()` for the pinned hero-to-seat transition.
- Task 04 now has the first seat scene and SVG callout pass in place.
- Task 11 should reuse `#final-product-anchor` so the persistent product returns to the same opening float behavior.
