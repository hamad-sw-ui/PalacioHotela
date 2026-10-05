export type CatalogFeature = { labelFr: string; labelEn: string; value: string };

const LIMIT = 12;

/** Keeps complete lines only. A zero or a blank value stays off the public page. */
export function normalizeCatalogFeatures(input: unknown): CatalogFeature[] {
  if (!Array.isArray(input)) return [];
  const rows: CatalogFeature[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const labelFr = String(row.labelFr ?? "").trim().slice(0, 40);
    const labelEn = String(row.labelEn ?? "").trim().slice(0, 40) || labelFr;
    const value = String(row.value ?? "").trim().slice(0, 24);
    if (!labelFr || !labelEn || !value || value === "0") continue;
    rows.push({ labelFr, labelEn, value });
    if (rows.length >= LIMIT) break;
  }
  return rows;
}

export function featuresForNewItem(category: string, input: unknown) {
  const chosen = normalizeCatalogFeatures(input);
  return chosen.length ? chosen : suggestedFeatures(category);
}
export function suggestedFeatures(category: string): CatalogFeature[] {
  if (category === "accommodation") return [
    { labelFr: "Chambre", labelEn: "Bedroom", value: "1" },
    { labelFr: "Salon", labelEn: "Lounge", value: "1" },
    { labelFr: "Salle de bain", labelEn: "Bathroom", value: "1" },
  ];
  if (category === "conference_room") return [
    { labelFr: "Salle", labelEn: "Room", value: "1" },
    { labelFr: "Écran", labelEn: "Screen", value: "1" },
    { labelFr: "Microphone", labelEn: "Microphone", value: "2" },
  ];
  if (category === "event_hall") return [
    { labelFr: "Salle", labelEn: "Hall", value: "1" },
    { labelFr: "Piste", labelEn: "Dance floor", value: "1" },
    { labelFr: "Sonorisation", labelEn: "Sound system", value: "1" },
  ];
  if (category === "restaurant") return [
    { labelFr: "Salle", labelEn: "Dining room", value: "1" },
    { labelFr: "Terrasse", labelEn: "Terrace", value: "1" },
  ];
  return [
    { labelFr: "Prestation", labelEn: "Service", value: "1" },
    { labelFr: "Accompagnateur", labelEn: "Host", value: "1" },
  ];
}

/** Known demo articles. Applied only while an article still has no characteristics. */
export const demoCatalogFeatures: Record<string, CatalogFeature[]> = {
  "chambre-deluxe": [
    { labelFr: "Chambre", labelEn: "Bedroom", value: "1" },
    { labelFr: "Salle de bain", labelEn: "Bathroom", value: "1" },
  ],
  "chambre-jardin": [
    { labelFr: "Chambre", labelEn: "Bedroom", value: "1" },
    { labelFr: "Salle de bain", labelEn: "Bathroom", value: "1" },
  ],
  "suite-signature": [
    { labelFr: "Chambre", labelEn: "Bedroom", value: "1" },
    { labelFr: "Salon", labelEn: "Lounge", value: "1" },
    { labelFr: "Salle de bain", labelEn: "Bathroom", value: "1" },
  ],
  "suite-presidentielle": [
    { labelFr: "Chambre", labelEn: "Bedroom", value: "1" },
    { labelFr: "Salon", labelEn: "Lounge", value: "1" },
    { labelFr: "Salle de bain", labelEn: "Bathroom", value: "2" },
    { labelFr: "Terrasse", labelEn: "Terrace", value: "1" },
  ],
  "salon-acacia": [
    { labelFr: "Salle", labelEn: "Room", value: "1" },
    { labelFr: "Écran", labelEn: "Screen", value: "1" },
    { labelFr: "Pause-café", labelEn: "Coffee break", value: "1" },
  ],
  "salle-des-etoiles": [
    { labelFr: "Salle", labelEn: "Hall", value: "1" },
    { labelFr: "Sonorisation", labelEn: "Sound system", value: "1" },
    { labelFr: "Traiteur", labelEn: "Catering", value: "1" },
  ],
  "spa-bien-etre": [
    { labelFr: "Cabine", labelEn: "Treatment room", value: "2" },
    { labelFr: "Espace détente", labelEn: "Relaxation lounge", value: "1" },
  ],
  "table-palacio": [
    { labelFr: "Salle", labelEn: "Dining room", value: "1" },
    { labelFr: "Terrasse", labelEn: "Terrace", value: "1" },
  ],
  "escapade-douala": [
    { labelFr: "Guide", labelEn: "Guide", value: "1" },
    { labelFr: "Transport", labelEn: "Transport", value: "1" },
  ],
};
