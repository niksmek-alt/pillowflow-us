# Task 01 - Foundation and architecture

This branch uses `deck-v4/` as the isolated V4 working copy. The current `deck-v3/` deck remains untouched for comparison.

## What is included

- `index.html`: V4 story shell with the 11 planned sections.
- `v4/tokens.css`: brand tokens, layout primitives, Hero styling, responsive rules.
- `v4/motion-tokens.js`: durations, eases, staggers, pin lengths, breakpoints.
- `v4/gsap-setup.js`: GSAP 3.12.5 and ScrollTrigger loader.
- `v4/scroll-orchestrator.js`: section registry, ScrollTrigger setup, pinning, mobile fallback, persistent product helpers.
- `v4/asset-loader.js`: priority and lazy asset loading utilities.
- `v4/product-renderer.js`: Three.js renderer for the existing PF-X01 GLB.
- `v4/sections/hero.js`: Task 02 Hero module using the section contract.

## Architecture

The product is one persistent element: `#pf-product`.

It is rendered once, remains in the DOM, and is moved by section modules through the scroll orchestrator. Task 03 can move it from the Hero anchor to the seat anchor, Task 05 can keep it anchored during the camera push, and Task 11 can return it to the same opening float.

## Section contract

Each task after the Hero should create one module in `v4/sections/`:

```js
import { registerSection } from "../scroll-orchestrator.js";

registerSection({
  id: "problem",
  order: 4,
  pin: true,
  pinLength: 1.6,
  build(gsap, ctx, { mobile }) {
    const tl = gsap.timeline();
    return tl;
  },
});
```

Then import it from `index.html`.

## Definition of done

- Branch created: `pillowflow-cinematic-v4`.
- Existing deck audited.
- Branding preserved.
- GSAP and ScrollTrigger configured.
- Reusable animation architecture in place.
- Reusable section shell in place.
- Asset loading utilities in place.
- Responsive layout prepared.
- Current live deck not redesigned.
