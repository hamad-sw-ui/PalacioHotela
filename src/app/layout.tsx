import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./extra.css";

export const metadata: Metadata = {
  title: { default: "Palacio Hotel | L'art de vivre à Douala", template: "%s | Palacio Hotel" },
  description: "Découvrez le Palacio Hotel à Douala : chambres et suites d'exception, événements, restaurant, spa et séjours sur mesure. Réservez ou demandez votre devis.",
  keywords: ["Palacio Hotel", "hôtel Douala", "réservation hôtel", "salle de conférence Douala", "devis hôtel"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
