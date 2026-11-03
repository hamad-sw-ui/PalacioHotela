import { HomeClient } from "@/components/home-client";
import { getPublicCatalog } from "@/lib/hotel";

// Catalog/settings come from tagged server caches the backoffice revalidates on change,
// so the page only needs a short revalidation period instead of a fresh render per visit.
export const revalidate = 60;

export default async function HomePage() {
  const items = await getPublicCatalog();
  return <HomeClient items={items}/>;
}
