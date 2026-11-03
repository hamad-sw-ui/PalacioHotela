import { Suspense, type ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";
import { getSettings } from "@/lib/hotel";
import { settingsForBrowser } from "@/lib/smtp";

// The shell reads tag-cached settings (revalidated by the backoffice); pages decide
// their own rendering strategy — vitrine pages revalidate, transactional ones stay dynamic.
// The Suspense boundary lets client components using useSearchParams (in the shell,
// the catalog filters, the booking or quote forms) render during static prerender
// with the CSR bailout instead of forcing every page to be dynamic.

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
    <Suspense fallback={null}>
      <SiteShell settings={settingsForBrowser(settings)}>{children}</SiteShell>
    </Suspense>
  );
}
