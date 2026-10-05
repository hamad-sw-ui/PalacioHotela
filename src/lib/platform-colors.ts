import type { CSSProperties } from "react";
import { getQuotePdfPalette, mergePalette, type QuotePdfPalette } from "@/lib/quote-pdf-theme";

export const platformColors = [
  "rgba(255,255,255,.65)",
  "rgba(255,255,255,.45)",
  "rgba(223,191,144,.5)",
  "rgba(192,154,99,.13)",
  "rgba(255,255,255,.2)",
  "rgba(19,44,32,.055)",
  "rgba(41,66,51,.08)",
  "rgba(19,47,35,.12)",
  "rgba(21,44,33,.11)",
  "rgba(13,25,20,.16)",
  "rgba(11,27,22,.87)",
  "rgba(18,42,30,.23)",
  "rgba(13,36,29,.87)",
  "rgba(13,36,29,.46)",
  "rgba(12,31,27,.76)",
  "rgba(15,36,30,.55)",
  "rgba(13,32,28,.08)",
  "rgba(13,36,29,.1)",
  "rgba(7,29,25,.38)",
  "#172e2524",
  "#093b2590",
  "#092a1d6e",
  "#14291c14",
  "#112b1b1c",
  "#183d2c1c",
  "#1e382510",
  "#21371f16",
  "#173e2eaa",
  "#102b25dc",
  "#0f3024d8",
  "#1c3c2b92",
  "#122e2029",
  "#ffffff18",
  "#ffffff0c",
  "#ffffff06",
  "#ffffff13",
  "#091d14a8",
  "#142b2160",
  "#07160c73",
  "#ffffff14",
  "#ffffffc7",
  "#ffffff88",
  "#142a203a",
  "#18382e",
  "#102d26",
  "#20392f",
  "#6e786f",
  "#c09a63",
  "#e0bd83",
  "#faf9f5",
  "#f3f2ed",
  "#1b303c",
  "#11242e",
  "#203744",
  "#bf9a68",
  "#dfbe89",
  "#f0f3f3",
  "#6d3f31",
  "#512c23",
  "#533d32",
  "#c88860",
  "#e2b184",
  "#f7f0e9",
  "#5d6879",
  "#f7f8f8",
  "#76615a",
  "#fbf8f5",
  "#f8f7f3",
  "#20382e",
  "#b9c3b8",
  "#edf1e9",
  "#9eab9e",
  "#f3f1e9",
  "#a3aca2",
  "#f6f3e9",
  "#33453b",
  "#f1f3ec",
  "#f6f1e6",
  "#e7d8bf",
  "#e8ebe5",
  "#f3f2ec",
  "#90988d",
  "#e1e6df",
  "#9ba59b",
  "#b4beb2",
  "#a1a99d",
  "#d9d4c8",
  "#f4f3ee",
  "#ddd7cb",
  "#fefdf9",
  "#8b978b",
  "#7c877d",
  "#eeeae4",
  "#999f97",
  "#9da59b",
  "#d5dcd1",
  "#8fa49a",
  "#c0cfc4",
  "#f1f4ec",
  "#fbfaf6",
  "#c2bdaf",
  "#efddbb",
  "#d1ddd2",
  "#cda771",
  "#e1c49b",
  "#dcc29b",
  "#f8f7f2",
  "#dedfd7",
  "#102c24",
  "#f8f8f1",
  "#bccbbd",
  "#496054",
  "#efeee5",
  "#a98255",
  "#e2b980",
  "#cbd6cc",
  "#e7c28d",
  "#cba36e",
  "#385146",
  "#9eafa0",
  "#218259",
  "#9ed6ad",
  "#e6ebe3",
  "#a8bbaa",
  "#dec193",
  "#c8d5c7",
  "#9bda9e",
  "#fafbf8",
  "#364b3e",
  "#eaece7",
  "#d5dfd4",
  "#ecf2ec",
  "#e7ebe5",
  "#a5ada3",
  "#edf2ea",
  "#cbd8ce",
  "#dce1d8",
  "#7b877c",
  "#f3f3ed",
  "#e9ece5",
  "#3d5042",
  "#fbfcf9",
  "#dfe5dd",
  "#aab2a8",
  "#889489",
  "#dce3d9",
  "#f4f7f1",
  "#8a9589",
  "#f2f6ee",
  "#506252",
  "#fff1ed",
  "#c76b52",
  "#8b4031",
  "#edf7ee",
  "#3b8b55",
  "#276441",
  "#c0d0c2",
  "#d0dacd",
  "#b7c9bb",
  "#efeee7",
  "#f1f3ed",
  "#586a5a",
  "#fff2d8",
  "#9a6a12",
  "#e8f5e9",
  "#297044",
  "#fcebea",
  "#a24d45",
  "#f0f2ed",
  "#8d998e",
  "#ccdbd0",
  "#e0e6db",
  "#6d7c6e",
  "#748275",
  "#506254",
  "#dfe6dd",
  "#f3f5ef",
  "#778477",
  "#e4e9df",
  "#e4e7e0",
  "#849084",
  "#8a9688",
  "#277148",
  "#eef7ef",
  "#ae5b41",
  "#fff0ed",
  "#e0e6dd",
  "#566959",
  "#e3e8df",
  "#fcfcf8",
  "#8b988a",
  "#c8d2c7",
  "#dde5db",
  "#8c978a",
  "#f6f8f4",
  "#cbd4c9",
  "#f3f4ef",
  "#607261",
  "#687867",
  "#204431",
  "#9ba69a",
  "#718072",
  "#d7e0d4",
  "#e0e6dc",
  "#6a7a6b",
  "#e2e8df",
  "#c8ad7e",
  "#fdfbf5",
  "#819081",
  "#d6ddd3",
  "#348758",
  "#ba6f56",
  "#e5e9e1",
  "#456052",
  "#cbdbca",
  "#b9cbb9",
  "#436450",
  "#c0d1c3",
  "#dfc08c",
  "#a98456",
  "#8b978d",
  "#a2afa2",
  "#cad4ca",
  "#c7d1c7",
  "#6e7e70",
  "#f5f6f1",
  "#819084",
  "#edddc4",
  "#f6f7f2",
  "#899788",
  "#8c988a",
  "#e6e9e2",
  "#899489",
  "#819083",
  "#dfbf90",
  "#dfebdf",
  "#7d8d7f",
  "#758475",
  "#e1e6dc",
  "#f1f2ea",
  "#8b988b",
  "#7d8b7c",
  "#839084",
  "#e6ede4",
  "#637466",
  "#1d3c2c",
  "#ecf1e6",
  "#cfddcd",
  "#718071",
  "#243d30",
  "#d6dfd4",
  "#a18152",
  "#a88d67",
  "#869386",
  "#738472",
  "#f4f6f0",
  "#49624d",
  "#213d2b",
  "#869486",
  "#899589",
  "#c9d6c6",
  "#234531",
  "#eef4ec",
  "#5f7663",
  "#f5f7f3",
  "#263c2f",
  "#d7e3d8",
  "#3a5948",
  "#769484",
  "#afc5b5",
  "#b2c7b5",
  "#355342",
  "#9eb7a2",
  "#aec5b2",
  "#e6ebe5",
  "#9ba79d",
  "#284034",
  "#9ba79b",
  "#3d5443",
  "#b59469",
  "#e4ebe2",
  "#bd8157",
  "#e6ebe2",
  "#e7ece5",
  "#a47c4e",
  "#eef0eb",
  "#839083",
  "#8e9b8e",
  "#cb9d5d",
  "#d9b67d",
  "#d4ae78",
  "#c8d7c9",
  "#d4af7d",
  "#e8ede6",
  "#738476",
  "#c6a573",
  "#213d2d",
  "#87988a",
  "#d4a665",
  "#edf0e9",
  "#98a49a",
  "#a48255",
  "#edf0ea",
  "#e6efe7",
  "#2b6141",
  "#f6eddd",
  "#aa7e45",
  "#9ba69b",
  "#a3afa4",
  "#98a59a",
  "#9b815e",
  "#cfb38b",
  "#1b4a32",
  "#9ea99e",
  "#eef1eb",
  "#39503d",
  "#f1f4ee",
  "#a18259",
  "#8d9c8f",
  "#a5794b",
  "#a48c6c",
  "#89978a",
  "#e1e9df",
  "#99a99b",
  "#556b57",
  "#526b56",
  "#dfe9df",
  "#f4f8f2",
  "#4d684f",
  "#d7e3d5",
  "#456148",
  "#748675",
  "#946f42",
  "#284331",
  "#f7f4ee",
  "#86988b",
  "#a27846",
  "#f3f6f1",
  "#9b4c42",
  "#fcf1ef",
  "#f9faf7",
  "#89998b",
  "#4d634f",
  "#9ba99c",
  "#2a4936",
  "#eef3ed",
  "#52715c",
  "#e7efe6",
  "#416b4a",
  "#a0aa9d",
  "#c7a574",
  "#314c39",
  "#e4ebe3",
  "#aa8758",
  "#819184",
  "#e9ede7",
  "#476749",
  "#94a194",
  "#f9fbf6",
  "#a98553",
  "#f5f1e7",
  "#788779",
  "#a6b2a5",
  "#a47b4f",
  "#a8b3a8",
  "#813f35",
  "#e0bd84",
  "#e5ebe2",
  "#b08b5b",
  "#425945",
  "#e9eee8",
  "#89988b",
  "#c6d0c4",
  "#266346",
  "#455c49",
  "#e9eee6",
  "#9aac98",
  "#9eaba0",
  "#d9e2d7",
  "#365a3f",
  "#f5f8f3",
  "#dfe7db",
  "#355338",
  "#426147",
  "#dbe4d9",
  "#f1d1c9",
  "#b35949",
  "#d2ae79",
  "#213a2a",
  "#e4c694",
  "#6a7d6d",
  "#edf3ec",
  "#244d35",
  "#c6a16d",
  "#899789",
  "#eef2eb",
  "#a2b2a4",
  "#e3eae1",
  "#295638",
  "#99a798",
  "#2c6341",
  "#ebeee9",
  "#edf2eb",
  "#a78354",
  "#879589",
  "#a5afa2",
  "#a07437",
  "#fff4df",
  "#25754a",
  "#e5f4e8",
  "#e8ede7",
  "#96a298",
  "#99a69a",
  "#e3e9e2",
  "#fafbf9",
  "#a8463d",
  "#254331",
  "#e1e8df",
  "#e0e7df",
  "#f5f1e8",
  "#f4f6f2",
  "#8a958b",
  "#6c866f",
  "#e7f0e5",
  "#c7d3c7",
  "#327049",
  "#9b7041",
  "#fff",
] as const;

const brandKeys = ["primary", "dark", "accent", "accentLight", "ink", "muted", "paper", "soft", "border", "footer"] as const;

function normalizeHex(value: string) {
  const text = value.trim().toLowerCase();
  if (!text.startsWith("#")) return text;
  const hex = text.slice(1);
  if (hex.length === 3 || hex.length === 4) return `#${hex.split("").map((part) => part + part).join("")}`;
  return `#${hex}`;
}

export function tokenName(raw: string) {
  return `--c-${raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function channel(value: string) {
  const text = normalizeHex(value).slice(1);
  const rgb = text.length >= 6 ? text.slice(0, 6) : text;
  const alpha = text.length === 8 ? parseInt(text.slice(6), 16) / 255 : 1;
  return { r: parseInt(rgb.slice(0, 2), 16), g: parseInt(rgb.slice(2, 4), 16), b: parseInt(rgb.slice(4, 6), 16), a: alpha, eight: text.length === 8 };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255; const gn = g / 255; const bn = b / 255;
  const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  const sector = Math.floor(h / 60) % 6;
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector];
  return rgb.map((part) => Math.round((part + m) * 255));
}

function formatColor(r: number, g: number, b: number, a: number, eight: boolean) {
  const hex = [r, g, b].map((part) => Math.max(0, Math.min(255, part)).toString(16).padStart(2, "0")).join("");
  if (a < 1 || eight) return `#${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0")}`;
  return `#${hex}`;
}

function exactBrand(theme: "midnight" | "terracotta") {
  const forest = getQuotePdfPalette("forest");
  const next = getQuotePdfPalette(theme);
  return Object.fromEntries(brandKeys.map((key) => [normalizeHex(forest[key]), normalizeHex(next[key])]));
}

function alreadyThemed(value: string, theme: "midnight" | "terracotta") {
  const target = new Set(Object.values(exactBrand(theme)));
  return target.has(normalizeHex(value));
}

function parseColor(raw: string) {
  const text = raw.trim().toLowerCase();
  const rgba = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgba) return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: rgba[4] === undefined ? 1 : Number(rgba[4]), kind: "rgb" as const };
  if (!text.startsWith("#")) return null;
  const parsed = channel(text);
  if ([parsed.r, parsed.g, parsed.b].some((part) => Number.isNaN(part))) return null;
  return { ...parsed, kind: "hex" as const };
}

function formatParsed(parsed: { r: number; g: number; b: number; a: number; kind: "hex" | "rgb"; eight?: boolean }) {
  if (parsed.kind === "rgb") {
    const rgb = [parsed.r, parsed.g, parsed.b].map((part) => Math.round(part)).join(",");
    return parsed.a < 1 ? `rgba(${rgb},${parsed.a})` : `rgb(${rgb})`;
  }
  return formatColor(parsed.r, parsed.g, parsed.b, parsed.a, Boolean(parsed.eight));
}

export function themeColor(raw: string, theme: string) {
  if (theme !== "midnight" && theme !== "terracotta") return raw;
  if (raw.trim().toLowerCase() === "#fff" || raw.trim().toLowerCase() === "#ffffff") return raw;
  if (raw.trim().startsWith("#") && alreadyThemed(raw, theme)) return raw;
  const mapped = raw.trim().startsWith("#") ? exactBrand(theme)[normalizeHex(raw)] : undefined;
  if (mapped) return mapped;
  const parsed = parseColor(raw);
  if (!parsed) return raw;
  if ([parsed.r, parsed.g, parsed.b].some((part) => Number.isNaN(part))) return raw;
  const { h, s, l } = rgbToHsl(parsed.r, parsed.g, parsed.b);
  if (s < 0.02) return raw;
  if ((h < 16 || h > 348) && s > 0.4) return raw;
  const gold = h >= 20 && h <= 58 && s >= 0.16;
  const targetHue = gold ? (theme === "midnight" ? 36 : 22) : (theme === "midnight" ? 202 : 14);
  const nextSat = gold ? s : theme === "midnight" ? Math.min(1, s * 0.72) : Math.min(1, s * 0.88);
  const [r, g, b] = hslToRgb(targetHue, nextSat, l);
  return formatParsed({ ...parsed, r, g, b });
}

export function themeVariableStyle(theme: string, custom?: QuotePdfPalette | null): CSSProperties {
  const palette = custom ?? getQuotePdfPalette(theme);
  const style: Record<string, string> = {
    "--deep": palette.primary,
    "--deeper": palette.dark,
    "--ink": palette.ink,
    "--muted": palette.muted,
    "--gold": palette.accent,
    "--gold-light": palette.accentLight,
    "--paper": palette.paper,
    "--pale": palette.soft,
  };
  for (const color of platformColors) style[tokenName(color)] = custom ? themeColorForPalette(color, palette) : themeColor(color, theme);
  return style as CSSProperties;
}

function themeColorForPalette(raw: string, palette: QuotePdfPalette) {
  const forest = getQuotePdfPalette("forest");
  const norm = normalizeHex(raw);
  for (const key of brandKeys) {
    if (normalizeHex(forest[key]) === norm) return palette[key];
  }
  if (raw.trim().toLowerCase() === "#fff" || raw.trim().toLowerCase() === "#ffffff") return raw;
  const parsed = parseColor(raw);
  if (!parsed) return raw;
  const { h, s, l } = rgbToHsl(parsed.r, parsed.g, parsed.b);
  if (s < 0.02) return raw;
  if ((h < 16 || h > 348) && s > 0.4) return raw;
  const target = parseColor(palette.primary);
  const targetHue = target ? rgbToHsl(target.r, target.g, target.b).h : h;
  const gold = h >= 20 && h <= 58 && s >= 0.16;
  const accent = parseColor(palette.accent);
  const accentHue = accent ? rgbToHsl(accent.r, accent.g, accent.b).h : targetHue;
  const [r, g, b] = hslToRgb(gold ? accentHue : targetHue, gold ? s : Math.min(1, s * 0.8), l);
  return formatParsed({ ...parsed, r, g, b });
}
