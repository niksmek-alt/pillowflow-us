import { registerSection } from "../scroll-orchestrator.js";
import { EASE, PIN, STAGGER } from "../motion-tokens.js";

registerSection({
  id: "problem",
  order: 3,
  pin: true,
  pinMobile: false,
  pinLength: PIN.problemCallouts,
  scrubMobile: false,
  onEnter(gsap, ctx) {
    if (ctx.product) gsap.set(ctx.product, { autoAlpha: 0 });
  },
  onEnterBack(gsap, ctx) {
    if (ctx.product) gsap.set(ctx.product, { autoAlpha: 0 });
  },
  build(gsap, ctx, { mobile }) {
    const section = document.getElementById("problem");
    if (!section) return null;

    const callouts = section.querySelectorAll(".pf-callout");
    const calloutPaths = section.querySelectorAll(".pf-callout path");
    const copyItems = section.querySelectorAll(".pf-problem-copy > *");

    gsap.set(callouts, { opacity: 0, y: 22 });
    gsap.set(calloutPaths, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.set(copyItems, { opacity: 0, y: 28 });
    gsap.set(section.querySelector(".pf-problem-seat"), { opacity: 0.65, scale: mobile ? 0.92 : 0.94, y: mobile ? 36 : 52 });
    gsap.set(section.querySelector(".pf-seat-photo"), { scale: mobile ? 1.08 : 1.04 });

    const tl = gsap.timeline({ defaults: { ease: EASE.out } });

    if (ctx.product) {
      tl.to(ctx.product, { opacity: 0, overwrite: "auto", duration: 0.01, ease: "none" }, 0);
    }

    tl
      .to(copyItems, { opacity: 1, y: 0, stagger: 0.06, duration: 0.38 }, 0.05)
      .to(section.querySelector(".pf-problem-seat"), { opacity: 1, y: 0, scale: 1, duration: 0.44 }, 0.08)
      .to(section.querySelector(".pf-seat-photo"), { scale: 1.012, duration: 0.54, ease: "power2.out" }, 0.08)
      .to(callouts, { opacity: 1, y: 0, stagger: STAGGER.callouts, duration: 0.3 }, 0.38)
      .to(calloutPaths, { strokeDashoffset: 0, stagger: STAGGER.callouts, duration: 0.38, ease: EASE.draw }, 0.38)
      .to(section.querySelector(".pf-seat-contact-glow"), { opacity: 0.85, scale: 1.1, duration: 0.22, yoyo: true, repeat: 1 }, 0.95);

    return tl;
  },
});
