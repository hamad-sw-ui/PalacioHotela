import type { Metadata } from "next";
import type { ReactNode } from "react";
import { quoteTabIconUrl } from "@/lib/brand-logos";
import { getSettings } from "@/lib/hotel";
import { mergePalette } from "@/lib/quote-pdf-theme";
import { themeVariableStyle } from "@/lib/platform-colors";
import { hotelCity } from "@/lib/location-copy";
import "./globals.css";
import "./extra.css";
import "./quote-enhancements.css";

function iconType(url: string) {
  if (/\.jpe?g(?:\?|$)/i.test(url)) return "image/jpeg";
  if (/\.webp(?:\?|$)/i.test(url)) return "image/webp";
  return "image/png";
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const icon = quoteTabIconUrl(settings);
  const routed = icon ? `/icon?v=${encodeURIComponent(icon)}` : undefined;
  const city = hotelCity(settings, "fr");
  return {
    title: { default: `${settings?.hotelName || "Palacio Hotel"} | L'art de vivre à ${city}`, template: `%s | ${settings?.hotelName || "Palacio Hotel"}` },
    description: `Découvrez le ${settings?.hotelName || "Palacio Hotel"} à ${city} : chambres et suites d'exception, événements, restaurant, spa et séjours sur mesure. Réservez ou demandez votre devis.`,
    keywords: [settings?.hotelName || "Palacio Hotel", `hôtel ${city}`, "réservation hôtel", `salle de conférence ${city}`, "devis hôtel"],
    icons: icon && routed
      ? {
          icon: [
            { url: icon, type: iconType(icon) },
            { url: routed, type: "image/png", sizes: "32x32" },
          ],
          apple: [{ url: icon }],
          shortcut: routed,
        }
      : undefined,
  };
}

const cursorHydrationGuard = `
(() => {
  const selector = "[data-cursor-ref],[data-cursor-element-id]";
  const cleanElement = (element) => {
    if (!(element instanceof Element)) return;
    element.removeAttribute("data-cursor-ref");
    element.removeAttribute("data-cursor-element-id");
    element.querySelectorAll(selector).forEach((child) => {
      child.removeAttribute("data-cursor-ref");
      child.removeAttribute("data-cursor-element-id");
    });
  };
  const cleanBodyCursor = () => {
    if (document.body?.style.cursor === "none") document.body.style.removeProperty("cursor");
  };
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") cleanElement(mutation.target);
      mutation.addedNodes.forEach(cleanElement);
    }
    cleanBodyCursor();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-cursor-ref", "data-cursor-element-id", "style"],
  });
  cleanElement(document.documentElement);
  cleanBodyCursor();
  window.addEventListener("load", () => {
    setTimeout(() => {
      cleanElement(document.documentElement);
      cleanBodyCursor();
      observer.disconnect();
    }, 1500);
  }, { once: true });
})();
`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  const theme = settings?.theme === "midnight" || settings?.theme === "terracotta" ? settings.theme : "forest";
  const colors = settings?.themeColors ? mergePalette(theme, settings.themeColors) : null;
  return <html lang="fr" data-theme={theme} style={themeVariableStyle(theme, colors)} data-scroll-behavior="smooth">
    <head>
      {process.env.NODE_ENV === "development" && <script id="cursor-hydration-guard" dangerouslySetInnerHTML={{ __html: cursorHydrationGuard }} />}
    </head>
    <body>{children}</body>
  </html>;
}
