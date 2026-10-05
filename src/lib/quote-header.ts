/**
 * A non-empty snapshot stays on the quote. An empty snapshot means the quote was sent
 * without a custom header. Null follows the current settings, so saving or clearing
 * the header image changes every quote that has not frozen one.
 */
export function resolveQuoteHeaderImage(quote: { headerImageUrl?: string | null }, settings: { quoteHeaderImageUrl?: string | null }) {
  if (quote.headerImageUrl) return quote.headerImageUrl;
  if (quote.headerImageUrl === "") return "";
  return settings.quoteHeaderImageUrl || "";
}

/** A saved copy stays on the quote. An empty copy means it was sent without a logo. Null follows the current logo. */
export function resolveQuoteLogo(quote: { logoSnapshot?: string | null }, settings: { logoUrl?: string | null }) {
  if (quote.logoSnapshot) return quote.logoSnapshot;
  if (quote.logoSnapshot === "") return "";
  return settings.logoUrl || "";
}

/** The small theme mark. A saved copy stays. An empty copy means the quote was sent without one. A draft follows the current tertiary logo; an older sent quote keeps its original header. */
export function resolveQuoteMonogram(quote: { tertiaryLogoSnapshot?: string | null; status?: string | null }, settings: { tertiaryLogoUrl?: string | null }) {
  if (quote.tertiaryLogoSnapshot) return quote.tertiaryLogoSnapshot;
  if (quote.tertiaryLogoSnapshot === "") return "";
  if (quote.status === "new" || quote.status === "in_review" || !quote.status) return settings.tertiaryLogoUrl || "";
  return "";
}
