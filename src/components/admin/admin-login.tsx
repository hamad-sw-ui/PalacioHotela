"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { setSessionToken } from "@/lib/client-session";

const DEMO_PASSWORD = "Palacio2026!";

export function AdminLogin({ demo, demoEmail, supportEmail, hotelAddress, onSuccess }: { demo: boolean; demoEmail: string; supportEmail: string; hotelAddress: string; onSuccess: () => void }) {
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  // In demo mode the credentials are already public on this screen: pre-fill them so the
  // form can be submitted as is (grey placeholders were easily mistaken for filled fields).
  const [email, setEmail] = useState(demo ? demoEmail : "");
  const [password, setPassword] = useState(demo ? DEMO_PASSWORD : "");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const en = locale === "en";

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", email, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (en ? "Sign-in failed. Please try again." : "Connexion impossible. Réessayez."));
      if (!["admin", "staff"].includes(data.user?.role)) {
        await fetch("/api/auth", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
        throw new Error(en ? "This account has no backoffice access." : "Ce compte n’a pas accès au backoffice.");
      }
      setSessionToken(data.token);
      onSuccess();
    } catch (err) {
      const offline = err instanceof TypeError;
      setError(offline ? (en ? "The server cannot be reached. Check your connection and try again." : "Le serveur est injoignable. Vérifiez votre connexion puis réessayez.") : err instanceof Error ? err.message : "Connexion impossible.");
      setBusy(false);
    }
  }

  return <main className="admin-login"><div className="admin-login-visual"><Link href="/" className="admin-login-brand"><span>✦</span> PALACIO <small>H O T E L</small></Link><div className="admin-login-quote"><div className="eyebrow eyebrow-light"><span className="eyebrow-line"/> BACKOFFICE</div><h1>{en ? "Every detail, beautifully managed." : "L’excellence se cultive dans les détails."}</h1><p>{en ? "Your space to create memorable experiences, every day." : "Votre espace pour imaginer des expériences mémorables, chaque jour."}</p></div><span className="admin-login-copyright">© {new Date().getFullYear()} Palacio Hotel · {hotelAddress}</span></div><div className="admin-login-panel"><div className="admin-login-top"><Link href="/">← {en ? "Back to website" : "Retour au site"}</Link><button type="button" onClick={() => setLocale(en ? "fr" : "en")}>{en ? "FR" : "EN"}</button></div><div className="admin-login-form-wrap"><div className="admin-login-lock"><ShieldCheck size={24}/></div><span className="admin-login-kicker">PALACIO HOTEL · ADMINISTRATION</span><h2>{en ? "Welcome back." : "Heureux de vous retrouver."}</h2><p>{en ? "Sign in to manage your hotel." : "Connectez-vous pour gérer votre établissement."}</p><form onSubmit={submit}><label className="field"><span>{en ? "EMAIL ADDRESS" : "ADRESSE E-MAIL"}</span><input type="email" name="email" autoComplete="username" required placeholder={en ? "name@example.com" : "nom@exemple.com"} value={email} onChange={(e) => setEmail(e.target.value)}/></label><label className="field"><span>{en ? "PASSWORD" : "MOT DE PASSE"}</span><div className="password-field"><input type={show ? "text" : "password"} name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={en ? "Your password" : "Votre mot de passe"}/><button type="button" onClick={() => setShow(!show)} aria-label={en ? "Show password" : "Afficher le mot de passe"}>{show ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>{error && <div className="notice notice-error" role="alert">{error}</div>}<button type="submit" className="btn btn-primary admin-login-submit" disabled={busy}>{busy ? <Loader2 size={16} className="spin"/> : <LockKeyhole size={16}/>} {busy ? (en ? "Signing in..." : "Connexion...") : (en ? "Sign in to backoffice" : "Accéder au backoffice")} <ArrowRight size={16}/></button></form>{demo && <div className="admin-demo-note"><strong>{en ? "Demo access" : "Accès démonstration"}</strong><span>{demoEmail} / {DEMO_PASSWORD}</span><button type="button" onClick={() => { setEmail(demoEmail); setPassword(DEMO_PASSWORD); setError(""); }}><KeyRound size={14}/>{en ? "Fill in the demo access" : "Remplir l’accès démo"}</button><small>{en ? "Configure ADMIN_EMAIL and ADMIN_PASSWORD for production." : "Configurez ADMIN_EMAIL et ADMIN_PASSWORD pour la production."}</small></div>}<a className="admin-login-newtab" href="/admin" target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>{en ? "Open the backoffice in a new tab" : "Ouvrir le backoffice dans un nouvel onglet"}</a><div className="admin-login-help">{en ? "Need assistance?" : "Besoin d’aide ?"} <a href={`mailto:${supportEmail}`}>{en ? "Contact support" : "Contacter l’équipe"}</a></div></div></div></main>;
}
