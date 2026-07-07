import { useGsap } from "./gsap-setup.js";
import { PIN, MQ } from "./motion-tokens.js";

const registry = [];

export function registerSection(definition) {
  registry.push(definition);
  registry.sort((a, b) => a.order - b.order);
}

export const ctx = {
  product: null,

  rectVars(targetEl, { rotate = 0, scale = 1, xPercent = -50, yPercent = -50 } = {}) {
    if (!this.product || !targetEl) return {};
    const target = targetEl.getBoundingClientRect();
    return {
      x: target.left + target.width / 2,
      y: target.top + target.height / 2,
      xPercent,
      yPercent,
      rotation: rotate,
      scale,
    };
  },

  productFlightVars(targetEl, { rotate = 0, scale = 1 } = {}) {
    if (!this.product || !targetEl) return {};
    const product = this.product.getBoundingClientRect();
    const target = targetEl.getBoundingClientRect();
    return {
      x: `+=${target.left + target.width / 2 - (product.left + product.width / 2)}`,
      y: `+=${target.top + target.height / 2 - (product.top + product.height / 2)}`,
      rotation: rotate,
      scale,
    };
  },
};

export async function initOrchestrator() {
  const gsap = await useGsap();
  const ScrollTrigger = window.ScrollTrigger;

  ctx.product = document.getElementById("pf-product");
  if (!ctx.product) {
    console.warn("[V4] #pf-product missing. Cinematic handoffs are disabled.");
  }

  const mm = gsap.matchMedia();

  for (const def of registry) {
    const el = document.getElementById(def.id);
    if (!el) {
      console.warn(`[V4] section #${def.id} is not in the DOM.`);
      continue;
    }

    mm.add(MQ.desktop, () => {
      const timeline = def.build(gsap, ctx, { mobile: false });
      if (!timeline) return undefined;

      const trigger = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: def.pin ? `+=${(def.pinLength ?? 1) * 100}%` : "bottom top",
        pin: Boolean(def.pin),
        scrub: def.pin ? 0.6 : false,
        animation: timeline,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      });

      return () => trigger.kill();
    });

    mm.add(MQ.mobile, () => {
      const timeline = def.build(gsap, ctx, { mobile: true });
      if (!timeline) return undefined;

      const mobilePin = Boolean(def.pinMobile ?? def.pin);
      const mobileScrub = Boolean(def.scrubMobile ?? mobilePin);
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: mobilePin ? "top top" : "top 75%",
        end: mobilePin ? `+=${(def.mobilePinLength ?? def.pinLength ?? 1) * 100}%` : undefined,
        pin: mobilePin,
        scrub: mobileScrub ? 0.55 : false,
        animation: timeline,
        toggleActions: mobileScrub ? undefined : (def.toggleActions ?? "play none none reverse"),
        anticipatePin: mobilePin ? 1 : 0,
        invalidateOnRefresh: true,
      });

      return () => trigger.kill();
    });
  }

  ScrollTrigger.refresh();
  return { gsap, ScrollTrigger };
}

export const PIN_LENGTHS = PIN;
