export const colors = {
  background: "#081718",
  backgroundDeep: "#061112",
  surface: "#112426",
  surfaceRaised: "#17302F",
  surfaceSunken: "#0C1C1D",
  hairline: "#22403D",
  hairlineStrong: "#2F5550",
  text: "#F4F6ED",
  textMuted: "#A3B8AE",
  textFaint: "#6F877F",
  mint: "#97E8CD",
  mintSoft: "#97E8CD22",
  mintDim: "#3E7466",
  amber: "#F2B84B",
  amberSoft: "#F2B84B1F",
  coral: "#FF8A7A",
  coralSoft: "#FF8A7A1F",
  onAccent: "#081718",
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 12, md: 18, lg: 24, xl: 28, pill: 999 };
export const type = {
  hero: { fontSize: 34, lineHeight: 40, fontWeight: "700" as const, letterSpacing: -0.6 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "600" as const, letterSpacing: -0.2 },
  body: { fontSize: 17, lineHeight: 24, fontWeight: "400" as const },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: "400" as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "700" as const, letterSpacing: 1.6 },
  readout: { fontSize: 64, lineHeight: 70, fontWeight: "300" as const, letterSpacing: -1.5, fontVariant: ["tabular-nums" as const] },
};
