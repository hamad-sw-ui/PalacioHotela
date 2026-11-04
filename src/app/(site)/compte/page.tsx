import { AccountClient } from "@/components/account-client";

// Session-driven page: reads the query string client-side, must render per request.
export const dynamic = "force-dynamic";

export default function AccountPage() { return <AccountClient />; }
