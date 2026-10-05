const activityTargets = {
  booking: "bookings",
  bookings: "bookings",
  quote: "quotes",
  quotes: "quotes",
  message: "messages",
  messages: "messages",
  catalog: "catalog",
  page: "pages",
  pages: "pages",
  user: "users",
  users: "users",
} as const;

export type ActivityTarget = (typeof activityTargets)[keyof typeof activityTargets];

export function activityTarget(entity: string): ActivityTarget | null {
  return activityTargets[entity as keyof typeof activityTargets] ?? null;
}

export function activityShouldBeWritten(resource: string, action: string, quiet = false) {
  if (action === "read" && resource === "messages") return false;
  if (action === "read" && resource === "notifications" && quiet) return false;
  return true;
}

function textField(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function activityDetail(resource: string, action: string, result: unknown) {
  const record = result && typeof result === "object" ? result as Record<string, unknown> : null;
  if (action === "bulk" && record && typeof record.count === "number") return `Traitement groupé : ${record.count} élément(s).`;
  if (action === "reply" && resource === "messages") {
    const subject = textField(record, "subject");
    const delivery = record?.emailSent === false ? "E-mail non envoyé" : "E-mail envoyé";
    return subject ? `${subject} · ${delivery}` : delivery;
  }
  const reference = textField(record, "reference");
  const name = textField(record, "guestName") || textField(record, "fullName") || textField(record, "name") || textField(record, "nameFr") || textField(record, "titleFr") || textField(record, "subject") || textField(record, "hotelName");
  return [reference, name].filter(Boolean).join(" · ");
}
