export function preloadPriority() {
  const items = [...document.querySelectorAll("[data-priority]")];

  return Promise.all(
    items.map((el) => new Promise((resolve) => {
      if (el instanceof HTMLImageElement) {
        if (el.complete) return resolve();
        el.addEventListener("load", resolve, { once: true });
        el.addEventListener("error", resolve, { once: true });
        return;
      }

      if (el instanceof HTMLVideoElement) {
        if (el.readyState >= 2) return resolve();
        el.addEventListener("loadeddata", resolve, { once: true });
        el.addEventListener("error", resolve, { once: true });
        return;
      }

      resolve();
    }))
  );
}

export function initLazyAssets() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll("[data-lazy]").forEach((el) => {
      if (el.dataset.src) el.src = el.dataset.src;
    });
    document.querySelectorAll("[data-lazy-video]").forEach((el) => {
      if (el.dataset.src) {
        el.src = el.dataset.src;
        el.load();
      }
    });
    return null;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;

        if (el.hasAttribute("data-lazy") && el.dataset.src) {
          el.src = el.dataset.src;
          el.removeAttribute("data-lazy");
        }

        if (el.hasAttribute("data-lazy-video") && el.dataset.src) {
          el.src = el.dataset.src;
          el.load();
          el.play().catch(() => {});
          el.removeAttribute("data-lazy-video");
        }

        io.unobserve(el);
      }
    },
    { rootMargin: "600px 0px" }
  );

  document.querySelectorAll("[data-lazy], [data-lazy-video]").forEach((el) => io.observe(el));
  return io;
}

export async function gatedReveal(bodyClass = "v4-ready", { minimumMs = 680 } = {}) {
  const startedAt = performance.now();
  await preloadPriority();
  const elapsed = performance.now() - startedAt;
  if (elapsed < minimumMs) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, minimumMs - elapsed);
    });
  }
  document.documentElement.classList.add(bodyClass);
}
