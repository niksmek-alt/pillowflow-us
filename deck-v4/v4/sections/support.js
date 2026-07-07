import { registerSection } from "../scroll-orchestrator.js";
import { EASE, STAGGER } from "../motion-tokens.js";

registerSection({
  id: "business",
  order: 4,
  pin: false,
  build(gsap) {
    const section = document.getElementById("business");
    if (!section) return null;

    const copy = section.querySelectorAll(".pf-support-copy > *");
    const media = section.querySelector(".pf-support-media");
    const image = section.querySelector(".pf-support-media img");
    const benefits = section.querySelectorAll(".pf-benefit-item");

    gsap.set(copy, { opacity: 0, y: 26 });
    gsap.set(media, { opacity: 0, y: 42, scale: 0.98 });
    gsap.set(image, { scale: 1.06 });
    gsap.set(benefits, { opacity: 0, x: 18 });

    const tl = gsap.timeline({ defaults: { ease: EASE.out } });
    tl
      .to(copy, { opacity: 1, y: 0, stagger: 0.06, duration: 0.42 }, 0)
      .to(media, { opacity: 1, y: 0, scale: 1, duration: 0.54 }, 0.08)
      .to(image, { scale: 1.01, duration: 0.72, ease: "power2.out" }, 0.08)
      .to(benefits, { opacity: 1, x: 0, stagger: STAGGER.cards, duration: 0.36 }, 0.28);

    return tl;
  },
});
