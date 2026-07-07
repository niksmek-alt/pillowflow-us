import { registerSection } from "../scroll-orchestrator.js";
import { DUR, EASE } from "../motion-tokens.js";

function placeProduct(gsap, ctx, anchor, { mobile = false } = {}) {
  if (!ctx.product || !anchor) return;
  const vars = ctx.rectVars(anchor, {
    rotate: mobile ? -5 : -7,
    scale: mobile ? 0.88 : 1,
  });
  gsap.set(ctx.product, vars);
}

registerSection({
  id: "hero",
  order: 1,
  pin: false,
  build(gsap, ctx, { mobile }) {
    const hero = document.getElementById("hero");
    const anchor = document.getElementById("hero-product-anchor");
    const revealItems = hero ? hero.querySelectorAll("[data-reveal]") : [];
    const flowLines = hero ? hero.querySelectorAll(".pf-flow-line") : [];
    const scrollDot = hero ? hero.querySelector(".pf-scroll-indicator i b") : null;

    placeProduct(gsap, ctx, anchor, { mobile });

    const sync = () => placeProduct(gsap, ctx, anchor, { mobile });
    window.addEventListener("resize", sync, { passive: true });
    window.addEventListener("orientationchange", sync, { passive: true });
    window.addEventListener("load", sync, { once: true });

    if (!mobile && ctx.product) {
      gsap.to(ctx.product, {
        y: "+=18",
        rotation: "-=1.6",
        duration: 3.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }

    if (flowLines.length) {
      gsap.set(flowLines, { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.to(flowLines, {
        strokeDashoffset: 0,
        duration: 2.6,
        stagger: 0.18,
        ease: EASE.draw,
        delay: 0.2,
      });
    }

    if (scrollDot) {
      gsap.to(scrollDot, {
        y: 14,
        opacity: 0.2,
        repeat: -1,
        duration: 1.3,
        ease: "power2.inOut",
      });
    }

    const tl = gsap.timeline({ defaults: { ease: EASE.out } });
    tl
      .fromTo(".pf-nav", { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: DUR.base }, 0.05)
      .to(revealItems, { y: 0, opacity: 1, duration: DUR.long, stagger: 0.08 }, 0.14);

    if (ctx.product) {
      tl.fromTo(ctx.product, { opacity: 0, scale: mobile ? 0.82 : 0.92 }, { opacity: 1, scale: mobile ? 0.88 : 1, duration: DUR.long }, 0.24);
    }

    tl.fromTo(".pf-product-shadow", { opacity: 0, scale: 0.72 }, { opacity: 1, scale: 1, duration: DUR.base }, 0.54)
      .fromTo(".pf-scroll-indicator", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: DUR.short }, 0.9);

    return null;
  },
});
