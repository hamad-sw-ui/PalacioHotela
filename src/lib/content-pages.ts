const reservedPageSlugs = new Set(["notre-histoire", "confidentialite"]);

export const reservedPageMessage = "Cette page est liée au menu, à l’accueil ou au consentement des formulaires. Son lien et sa publication restent en place.";

export function reservedPageChangeBlocked(slug: string, change: { remove?: boolean; slug?: string; published?: boolean } = {}) {
  if (!reservedPageSlugs.has(slug)) return false;
  const slugChanges = change.slug !== undefined && change.slug !== slug;
  return Boolean(change.remove || slugChanges || change.published === false);
}
