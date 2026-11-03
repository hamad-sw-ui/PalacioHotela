import { AdminGate } from "@/components/admin/admin-gate";
import { getAdmin } from "@/lib/auth";
import { ensureAdminAccount, ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/hotel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await ensureSeeded();
  await ensureAdminAccount();
  const admin = await getAdmin();
  const settings = await getSettings();
  return <AdminGate initialAuthenticated={Boolean(admin)} supportEmail={settings.email} hotelAddress={settings.addressFr} secondaryLogoUrl={settings.secondaryLogoUrl} backgroundImageUrl={settings.heroImage || "/images/palacio-hero.jpg"}/>;
}
