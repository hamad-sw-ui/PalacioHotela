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
  const demo = !process.env.ADMIN_PASSWORD;
  const demoEmail = demo ? (process.env.ADMIN_EMAIL || "admin@palaciohotel.com").toLowerCase() : "";
  return <AdminGate initialAuthenticated={Boolean(admin)} demo={demo} demoEmail={demoEmail} supportEmail={settings.email} hotelAddress={settings.addressFr}/>;
}
