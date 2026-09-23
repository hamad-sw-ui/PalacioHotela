import { HomeClient } from "@/components/home-client";
import { getPublicCatalog } from "@/lib/hotel";

export default async function HomePage() {
  const items = await getPublicCatalog();
  return <HomeClient items={items}/>;
}
