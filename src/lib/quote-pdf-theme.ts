export type QuotePdfPalette = {
  primary: string;
  dark: string;
  accent: string;
  accentLight: string;
  ink: string;
  muted: string;
  paper: string;
  soft: string;
  border: string;
  footer: string;
  white: string;
};

const palettes: Record<string, QuotePdfPalette> = {
  forest: { primary: "#18382e", dark: "#102d26", accent: "#c09a63", accentLight: "#e0bd83", ink: "#20392f", muted: "#6e786f", paper: "#faf9f5", soft: "#f3f2ed", border: "#dfe6dd", footer: "#f0eee8", white: "#ffffff" },
  midnight: { primary: "#1b303c", dark: "#11242e", accent: "#bf9a68", accentLight: "#dfbe89", ink: "#203744", muted: "#5d6879", paper: "#f7f8f8", soft: "#f0f3f3", border: "#d9e0e0", footer: "#e5e8ee", white: "#ffffff" },
  terracotta: { primary: "#6d3f31", dark: "#512c23", accent: "#c88860", accentLight: "#e2b184", ink: "#533d32", muted: "#76615a", paper: "#fbf8f5", soft: "#f7f0e9", border: "#eaded5", footer: "#f0e3dc", white: "#ffffff" },
};

export function getQuotePdfPalette(theme: string) {
  return palettes[theme] || palettes.forest;
}

export const paletteRoles = ["primary", "dark", "accent", "accentLight", "ink", "muted", "paper", "soft", "border", "footer", "white"] as const;

export function hexColor(raw: unknown) {
  const text = String(raw ?? "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(text)) return null;
  const full = text.length === 3 ? text.split("").map((part) => part + part).join("") : text;
  return `#${full.toLowerCase()}`;
}

export function mergePalette(theme: string | null | undefined, custom: unknown): QuotePdfPalette {
  const base = { ...getQuotePdfPalette(theme || "forest") };
  if (!custom || typeof custom !== "object") return base;
  for (const key of paletteRoles) {
    const value = hexColor((custom as Record<string, unknown>)[key]);
    if (value) base[key] = value;
  }
  return base;
}

export function paletteIsCustom(theme: string | null | undefined, custom: unknown) {
  const base = getQuotePdfPalette(theme || "forest");
  const merged = mergePalette(theme, custom);
  return paletteRoles.some((key) => merged[key] !== base[key]);
}

const quoteThemes = new Set(["forest", "midnight", "terracotta"]);

export function resolveQuoteTheme(quote: { themeSnapshot?: string | null }, settings: { theme?: string | null }) {
  if (quote.themeSnapshot && quoteThemes.has(quote.themeSnapshot)) return quote.themeSnapshot;
  if (settings.theme && quoteThemes.has(settings.theme)) return settings.theme;
  return "forest";
}

export function resolveQuotePalette(quote: { themeSnapshot?: string | null; themePaletteSnapshot?: unknown }, settings: { theme?: string | null; themeColors?: unknown }) {
  if (quote.themePaletteSnapshot && typeof quote.themePaletteSnapshot === "object") return mergePalette(quote.themeSnapshot || settings.theme, quote.themePaletteSnapshot);
  if (quote.themeSnapshot) return getQuotePdfPalette(resolveQuoteTheme(quote, settings));
  return mergePalette(settings.theme, settings.themeColors);
}
