export const DUR = {
  micro: 0.18,
  short: 0.4,
  base: 0.8,
  long: 1.4,
  cinematic: 2.2,
};

export const EASE = {
  out: "power3.out",
  inOut: "power2.inOut",
  cinematic: "expo.inOut",
  landing: "back.out(1.4)",
  draw: "power1.inOut",
};

export const STAGGER = {
  callouts: 0.2,
  cards: 0.12,
  widgets: 0.15,
};

export const PIN = {
  heroToProblem: 2.2,
  problemCallouts: 1.6,
  problemToBusiness: 1.4,
  dashboard: 1.2,
};

export const BP = {
  mobile: 480,
  tablet: 768,
  laptop: 1024,
  desktop: 1440,
};

export const MQ = {
  mobile: `(max-width: ${BP.tablet - 1}px)`,
  desktop: `(min-width: ${BP.tablet}px)`,
  reduceMotion: "(prefers-reduced-motion: reduce)",
};
