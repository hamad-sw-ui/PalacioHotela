import { AdminGate } from "@/components/admin/admin-gate";
import { getAdmin } from "@/lib/auth";
import { ensureAdminAccount, ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await ensureSeeded();
  await ensureAdminAccount();
  const admin = await getAdmin();
  const demo = !process.env.ADMIN_PASSWORD;
  const demoEmail = demo ? (process.env.ADMIN_EMAIL || "admin@palaciohotel.com").toLowerCase() : "";
  return <AdminGate initialAuthenticated={Boolean(admin)} demo={demo} demoEmail={demoEmail}/>;
}
