import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import { getSettings } from "@/lib/hotel";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return <SiteShell settings={settings}>{children}</SiteShell>;
}
