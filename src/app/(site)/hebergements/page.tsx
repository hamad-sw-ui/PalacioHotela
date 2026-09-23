import { CatalogClient } from "@/components/catalog-client";
import { getPublicCatalog } from "@/lib/hotel";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const query = await searchParams;
  const items = await getPublicCatalog();
  return <CatalogClient items={items} initialCategory={query.categorie || "all"}/>;
}
