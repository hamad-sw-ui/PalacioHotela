export function requestKindLabel(kind: string, locale: string) {
  const labels: Record<string, [string, string]> = {
    accommodation: ["Hébergement", "Accommodation"],
    conference_room: ["Salle de conférence", "Conference room"],
    event_hall: ["Salle de fête", "Event hall"],
    service: ["Services et loisirs", "Services and leisure"],
    restaurant: ["Restauration", "Dining"],
    mixed: ["Expérience sur mesure", "Tailored experience"],
  };
  return labels[kind]?.[locale === "en" ? 1 : 0] || kind.replaceAll("_", " ");
}
