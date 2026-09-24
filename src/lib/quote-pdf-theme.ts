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
};

const palettes: Record<string, QuotePdfPalette> = {
  forest: { primary: "#18382e", dark: "#102d26", accent: "#c09a63", accentLight: "#e0bd83", ink: "#20392f", muted: "#6e786f", paper: "#faf9f5", soft: "#f3f2ed", border: "#dfe6dd" },
  midnight: { primary: "#1b303c", dark: "#11242e", accent: "#bf9a68", accentLight: "#dfbe89", ink: "#203744", muted: "#5d6879", paper: "#f7f8f8", soft: "#f0f3f3", border: "#d9e0e0" },
  terracotta: { primary: "#6d3f31", dark: "#512c23", accent: "#c88860", accentLight: "#e2b184", ink: "#533d32", muted: "#76615a", paper: "#fbf8f5", soft: "#f7f0e9", border: "#eaded5" },
};

export function getQuotePdfPalette(theme: string) {
  return palettes[theme] || palettes.forest;
}
