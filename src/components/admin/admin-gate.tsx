"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminApp } from "@/components/admin/admin-app";
import { AdminLogin } from "@/components/admin/admin-login";
import { authFetch, getSessionToken, setSessionToken } from "@/lib/client-session";

type View = "checking" | "login" | "app";

/**
 * Decides between the sign-in screen and the backoffice in the browser, so access does not
 * depend on a cookie reaching the server (cookies are often refused when the site is embedded).
 */
export function AdminGate({ initialAuthenticated, demo, demoEmail, supportEmail, hotelAddress }: { initialAuthenticated: boolean; demo: boolean; demoEmail: string; supportEmail: string; hotelAddress: string }) {
  const [view, setView] = useState<View>(initialAuthenticated ? "app" : "checking");

  useEffect(() => {
    if (initialAuthenticated) return;
    if (!getSessionToken()) { setView("login"); return; }
    let cancelled = false;
    authFetch("/api/auth", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (!cancelled) setView(data.user && ["admin", "staff"].includes(data.user.role) ? "app" : "login"); })
      .catch(() => { if (!cancelled) setView("login"); });
    return () => { cancelled = true; };
  }, [initialAuthenticated]);

  const signedOut = useCallback(() => { setSessionToken(null); setView("login"); }, []);
  const signedIn = useCallback(() => setView("app"), []);

  if (view === "checking") return <div className="admin-loading"><Loader2 className="spin" size={34}/><span>PALACIO BACKOFFICE</span></div>;
  if (view === "login") return <AdminLogin demo={demo} demoEmail={demoEmail} supportEmail={supportEmail} hotelAddress={hotelAddress} onSuccess={signedIn}/>;
  return <AdminApp onSignedOut={signedOut}/>;
}
