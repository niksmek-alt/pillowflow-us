import { EASE, MQ } from "./motion-tokens.js";

const GSAP_VERSION = "3.12.5";
const CDN = `https://cdnjs.cloudflare.com/ajax/libs/gsap/${GSAP_VERSION}`;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export const gsapReady = (async () => {
  await loadScript(`${CDN}/gsap.min.js`);
  await loadScript(`${CDN}/ScrollTrigger.min.js`);

  const { gsap } = window;
  gsap.registerPlugin(window.ScrollTrigger);
  gsap.defaults({ ease: EASE.out, duration: 0.8 });

  const mm = gsap.matchMedia();
  mm.add(MQ.reduceMotion, () => {
    gsap.globalTimeline.timeScale(100);
    window.ScrollTrigger.getAll().forEach((trigger) => trigger.disable(false));
  });

  window.addEventListener("load", () => window.ScrollTrigger.refresh());
  return gsap;
})();

export async function useGsap() {
  return gsapReady;
}
