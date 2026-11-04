import type { CatalogItem } from "@/db/schema";

/** Filter keys shown in the catalog toolbar, mirroring the UI tabs.
 *  "conference_room" is kept for backward-compatible URLs only; since the
 *  retirement of the conferences section the public catalog no longer
 *  contains that category, so the tab simply shows nothing. */
export const CATALOG_FILTERS = ["all", "accommodation", "event_hall", "service", "restaurant", "events", "conference_room"] as const;
export type CatalogFilter = (typeof CATALOG_FILTERS)[number];

function isCatalogFilter(value: string): value is CatalogFilter {
  return (CATALOG_FILTERS as readonly string[]).includes(value);
}

/**
 * Single source of truth for the client-side catalog filtering. Accepts any
 * user-supplied category and falls back to "all" for unknown values, so an
 * unexpected query parameter never hides the whole catalog.
 */
export function filterCatalog(items: CatalogItem[], category: string | null | undefined): CatalogItem[] {
  if (!category || category === "all" || !isCatalogFilter(category)) return items;
  if (category === "events") return items.filter((item) => item.category === "conference_room" || item.category === "event_hall");
  return items.filter((item) => item.category === category);
}
