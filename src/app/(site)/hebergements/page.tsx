import { CatalogClient } from "@/components/catalog-client";
import { getPublicCatalog } from "@/lib/hotel";

// Catalog data is tag-cached (revalidated by the backoffice); the category filter
// is applied client-side, so the page renders from cache.
export const revalidate = 60;

export default async function CatalogPage() {
  const items = await getPublicCatalog();
  return <CatalogClient items={items} initialCategory="all" />;
}
