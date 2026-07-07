import { registerSection } from "../scroll-orchestrator.js";
import { EASE, PIN } from "../motion-tokens.js";

function productVars(ctx, anchor, mobile) {
  return {
    ...ctx.rectVars(anchor, {
      rotate: mobile ? -10 : -13,
      scale: mobile ? 0.62 : 0.66,
    }),
    ease: EASE.cinematic,
  };
}

registerSection({
  id: "transition-hero-problem",
  order: 2,
  pin: true,
  pinMobile: false,
  pinLength: PIN.heroToProblem,
  scrubMobile: false,
  build(gsap, ctx, { mobile }) {
    const section = document.getElementById("transition-hero-problem");
    const anchor = document.getElementById("seat-landing-anchor");
    if (!section || !anchor || !ctx.product) return null;

    const lines = section.querySelectorAll(".pf-transition-wave-line");
    const seat = section.querySelector(".pf-transition-seat");
    const seatPhoto = section.querySelector(".pf-seat-photo");
    const tl = gsap.timeline({ defaults: { ease: EASE.out } });

    gsap.set(lines, { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.set(seat, { opacity: 0, y: mobile ? 120 : 150, scale: mobile ? 0.82 : 0.86 });
    gsap.set(seatPhoto, { scale: mobile ? 1.12 : 1.08, yPercent: mobile ? 4 : 2 });
    gsap.set(section.querySelector(".pf-transition-caption"), { opacity: 0, y: 18 });
    gsap.set(section.querySelector(".pf-seat-contact-glow"), { opacity: 0, scale: 0.3 });

    tl
      .fromTo(".pf-nav", { y: 0, opacity: 1 }, { y: mobile ? 0 : -78, opacity: mobile ? 1 : 0, duration: 0.28, ease: "none" }, 0)
      .fromTo(section.querySelector(".pf-transition-wave-fill"), { yPercent: 22 }, { yPercent: -8, duration: 1, ease: "none" }, 0)
      .to(lines, { strokeDashoffset: 0, duration: 0.72, stagger: 0.06, ease: EASE.draw }, 0.05)
      .to(ctx.product, {
        x: () => productVars(ctx, anchor, mobile).x,
        y: () => productVars(ctx, anchor, mobile).y,
        xPercent: -50,
        yPercent: -50,
        rotation: mobile ? -10 : -13,
        scale: mobile ? 0.62 : 0.66,
        duration: 0.78,
        ease: EASE.cinematic,
      }, 0.06)
      .to(seat, { opacity: 1, y: 0, scale: 1, duration: 0.62, ease: "power3.out" }, 0.2)
      .to(seatPhoto, { scale: 1.012, yPercent: 0, duration: 0.62, ease: "power2.out" }, 0.2)
      .to(section.querySelector(".pf-seat-contact-glow"), { opacity: 1, scale: 1, duration: 0.28, ease: EASE.landing }, 0.72)
      .to(section.querySelector(".pf-transition-caption"), { opacity: 1, y: 0, duration: 0.3 }, 0.78)
      .to(ctx.product, { y: "+=8", rotation: mobile ? -7 : -10, duration: 0.18, ease: EASE.landing }, 0.78)
      .to(ctx.product, { opacity: 0.3, duration: 0.12, ease: "none" }, 0.34)
      .to(ctx.product, { opacity: 0, duration: 0.16, ease: "none" }, 0.46);

    return tl;
  },
});
