import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSettings } from "@/lib/hotel";
import "./globals.css";
import "./extra.css";
import "./quote-enhancements.css";

export const metadata: Metadata = {
  title: { default: "Palacio Hotel | L'art de vivre à Douala", template: "%s | Palacio Hotel" },
  description: "Découvrez le Palacio Hotel à Douala : chambres et suites d'exception, événements, restaurant, spa et séjours sur mesure. Réservez ou demandez votre devis.",
  keywords: ["Palacio Hotel", "hôtel Douala", "réservation hôtel", "salle de conférence Douala", "devis hôtel"],
};

export const dynamic = "force-dynamic";

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
  return <html lang="fr" data-theme={theme} data-scroll-behavior="smooth">
    {process.env.NODE_ENV === "development" && <head><script dangerouslySetInnerHTML={{ __html: cursorHydrationGuard }}/></head>}
    <body>{children}</body>
  </html>;
}
