"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, Camera, Mail, MapPin, Menu, Phone, UserRound, X } from "lucide-react";
import type { HotelSettings } from "@/db/schema";
import { ChatWidget } from "@/components/chat-widget";
import { hotelEmailUrl, hotelMapUrl, hotelPhoneUrl } from "@/lib/contact";
import { authFetch, setSessionToken } from "@/lib/client-session";
import { memberHref } from "@/lib/member-gate";
import { rememberSitePath } from "@/lib/site-navigation";
import { whatsappUrl } from "@/lib/whatsapp";
import { WhatsAppMark } from "@/components/whatsapp-mark";
import { mergePalette, paletteIsCustom } from "@/lib/quote-pdf-theme";
import { themeVariableStyle } from "@/lib/platform-colors";

type Context = { locale: "fr" | "en"; setLocale: (locale: "fr" | "en") => void; settings: HotelSettings; member: boolean | null; setMember: (value: boolean) => void };
const SiteContext = createContext<Context | null>(null);
export function useSite() { const value = useContext(SiteContext); if (!value) throw new Error("Site context missing"); return value; }
export const tr = (locale: string, fr: string, en: string) => locale === "en" ? en : fr;

const revealSelector = ".intro-section, .rooms-section, .experience-feature, .events-section, .quote-banner, .closing-section, .page-intro, .editorial-page, .contact-grid, .account-dashboard, .account-auth, .tracking-grid, .catalog-grid, .catalog-bottom-cta, .detail-main, .detail-aside";

function useSectionReveal(route: string) {
  useLayoutEffect(() => {
    const root = document.querySelector(".site-shell");
    if (!(root instanceof HTMLElement)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: "0px 0px 8% 0px" });
    const place = (node: HTMLElement) => {
      const box = node.getBoundingClientRect();
      const onScreen = box.top < window.innerHeight && box.bottom > 0;
      if (onScreen && box.top < window.innerHeight * 0.45) node.classList.add("is-visible", "reveal-shown");
      else if (onScreen) node.classList.add("is-visible");
      else observer.observe(node);
    };
    const arm = (node: HTMLElement) => {
      if (node.classList.contains("reveal")) return;
      node.classList.add("reveal");
      if (reduced) {
        node.classList.add("is-visible", "reveal-shown");
        return;
      }
      place(node);
    };
    const revealWaiting = () => {
      root.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)").forEach((node) => {
        observer.unobserve(node);
        place(node);
      });
    };
    root.querySelectorAll<HTMLElement>(revealSelector).forEach(arm);
    const changes = new MutationObserver(() => root.querySelectorAll<HTMLElement>(revealSelector).forEach(arm));
    changes.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", revealWaiting);
    root.classList.add("motion-ready");
    return () => {
      observer.disconnect();
      changes.disconnect();
      window.removeEventListener("resize", revealWaiting);
      root.classList.remove("motion-ready");
      root.querySelectorAll<HTMLElement>(".reveal").forEach((node) => node.classList.remove("reveal", "is-visible", "reveal-shown"));
    };
  }, [route]);
}
export { whatsappUrl };

function Brand({ settings, light = false }: { settings: HotelSettings; light?: boolean }) {
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => { setLogoFailed(false); }, [settings.logoUrl]);
  if (settings.logoUrl && !logoFailed) return <span className="brand-with-image"><img onError={() => setLogoFailed(true)} src={settings.logoUrl} alt={settings.hotelName} className="brand-image" /></span>;
  return <span className={`brand-wordmark ${light ? "brand-light" : ""}`}><span className="brand-mark">✦</span><span className="brand-main">PALACIO</span><span className="brand-small">H O T E L</span></span>;
}

function Header() {
  const { locale, setLocale, settings, member } = useSite();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => { setMounted(true); }, []);
  const query = search.toString();
  useEffect(() => { setOpen(false); }, [pathname, query]);
  const links: { href: string; match?: string; fr: string; en: string }[] = [
    { href: "/", fr: "Accueil", en: "Home" },
    { href: "/hebergements?categorie=accommodation", fr: "Hébergements", en: "Stay" },
    { href: "/hebergements?categorie=events", fr: "Événements", en: "Events" },
    { href: "/hebergements?categorie=service", fr: "Expériences", en: "Experiences" },
    { href: memberHref(member === true, "/devis"), match: "/devis", fr: "Devis sur mesure", en: "Get a quote" },
    { href: "/pages/notre-histoire", fr: "Notre histoire", en: "Our story" },
  ];
  const activeLink = (href: string, match?: string) => {
    if (!mounted) return false;
    const [path, query = ""] = (match || href).split("?");
    if (pathname !== path) return false;
    const expected = new URLSearchParams(query).get("categorie");
    return (search.get("categorie") || "") === (expected || "");
  };
  const accountAction = member === true
    ? <Link href="/compte" className="nav-user" aria-label={tr(locale, "Mon compte", "My account")}><UserRound size={18} strokeWidth={1.7}/></Link>
    : member === false
      ? <Link href="/compte" className="btn btn-outline nav-login">{tr(locale, "Se connecter", "Sign in")}</Link>
      : <span className="nav-account-slot" aria-hidden="true"/>;
  return <header className="site-header">
    <div className="topbar"><div className="container topbar-inner"><div className="topbar-left"><MapPin size={13} strokeWidth={1.8}/><span>{locale === "en" ? settings.addressEn : settings.addressFr}</span><span className="topbar-divider"/><span>{tr(locale, "Votre parenthèse d'exception à Douala", "Your exceptional escape in Douala")}</span></div><div className="topbar-right"><a href={hotelPhoneUrl(settings)}><Phone size={13}/>{settings.phone}</a><span className="topbar-divider"/><button onClick={() => setLocale(locale === "fr" ? "en" : "fr")} className="language-switch" aria-label={tr(locale, "Passer en anglais", "Switch to French")}>{locale.toUpperCase()} <span>⌄</span></button></div></div></div>
    <div className="nav-wrap"><div className="container nav-inner"><Link href="/" aria-label="Palacio Hotel" className="brand-link"><Brand settings={settings}/></Link><nav className={`main-nav ${open ? "is-open" : ""}`} aria-label="Navigation principale">{links.map((link) => <Link key={link.match || link.href} href={link.href} className={activeLink(link.href, link.match) ? "nav-active" : ""}>{tr(locale, link.fr, link.en)}</Link>)}<div className="mobile-nav-extra"><Link href="/contact">{tr(locale, "Nous contacter", "Contact us")}</Link><Link href="/compte">{member === true ? tr(locale, "Mon compte", "My account") : tr(locale, "Se connecter", "Sign in")}</Link><button onClick={() => setLocale(locale === "fr" ? "en" : "fr")}>{locale === "fr" ? "English" : "Français"}</button></div></nav><div className="nav-actions">{accountAction}<Link href={memberHref(member === true, "/reservation")} className="btn btn-primary nav-book">{tr(locale, "Réserver", "Book now")} <ArrowRight size={15}/></Link><button type="button" className="mobile-menu-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? tr(locale, "Fermer le menu", "Close menu") : tr(locale, "Ouvrir le menu", "Open menu")}>{open ? <X size={24}/> : <Menu size={24}/>}</button></div></div></div>
  </header>;
}

function Footer() {
  const { settings, locale, member } = useSite();
  const mapLink = hotelMapUrl(settings);
  return <footer className="site-footer"><div className="container"><div className="footer-top"><div className="footer-brand"><Link href="/"><Brand settings={settings} light/></Link><p>{tr(locale, "Une adresse singulière, des instants inoubliables. Bienvenue chez vous, à Douala.", "An extraordinary address, unforgettable moments. Welcome home in Douala.")}</p><div className="footer-social"><a href={whatsappUrl(settings.whatsapp, tr(locale, "Bonjour Palacio Hotel, j'aimerais vous contacter.", "Hello Palacio Hotel, I would like to contact you."))} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">WA</a><a href={settings.instagramUrl || "https://instagram.com"} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Camera size={17}/></a></div></div><div className="footer-col"><h4>{tr(locale, "Explorer", "Explore")}</h4><Link href="/hebergements?categorie=accommodation">{tr(locale, "Nos hébergements", "Accommodation")}</Link><Link href="/hebergements?categorie=events">{tr(locale, "Salles & événements", "Meetings & events")}</Link><Link href="/hebergements?categorie=service">{tr(locale, "Services & loisirs", "Services & leisure")}</Link><Link href="/pages/notre-histoire">{tr(locale, "Notre histoire", "Our story")}</Link></div><div className="footer-col"><h4>{tr(locale, "Votre séjour", "Your stay")}</h4><Link href={memberHref(member === true, "/reservation")}>{tr(locale, "Réserver un séjour", "Make a booking")}</Link><Link href={memberHref(member === true, "/devis")}>{tr(locale, "Demander un devis", "Request a quote")}</Link><Link href="/compte">{tr(locale, "Mon compte", "My account")}</Link><Link href="/contact">{tr(locale, "Nous contacter", "Contact us")}</Link></div><div className="footer-col footer-contact"><h4>{tr(locale, "Nous trouver", "Find us")}</h4><a href={mapLink} target="_blank" rel="noopener noreferrer"><MapPin size={16}/>{locale === "en" ? settings.addressEn : settings.addressFr}</a><a href={hotelPhoneUrl(settings)}><Phone size={16}/>{settings.phone}</a><a href={hotelEmailUrl(settings)}><Mail size={16}/>{settings.email}</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {settings.hotelName}. {tr(locale, "Tous droits réservés.", "All rights reserved.")}</span><div><Link href="/pages/confidentialite">{tr(locale, "Confidentialité", "Privacy")}</Link><Link href="/admin">Backoffice</Link><span>FR / EN</span></div></div></div></footer>;
}

export function SiteShell({ settings, children }: { settings: HotelSettings; children: ReactNode }) {
  const pathname = usePathname();
  const [locale, setLocaleState] = useState<"fr" | "en">("fr");
  const [member, setMember] = useState<boolean | null>(null);
  const search = useSearchParams();
  const preview = search.get("apercu");
  const namedPreview = preview === "midnight" || preview === "terracotta" || preview === "forest" ? preview : "";
  const [customPreview, setCustomPreview] = useState<ReturnType<typeof mergePalette> | null>(null);
  useEffect(() => {
    if (preview !== "personnalise") { setCustomPreview(null); return; }
    try { const stored = JSON.parse(localStorage.getItem("palacio_theme_preview") || "null"); setCustomPreview(paletteIsCustom(settings.theme, stored) ? mergePalette(settings.theme, stored) : null); } catch { setCustomPreview(null); }
  }, [preview, settings.theme]);
  const theme = namedPreview || settings.theme;
  useEffect(() => { const saved = window.localStorage.getItem("palacio_locale"); if (saved === "en") { setLocaleState("en"); document.documentElement.lang = "en"; } }, []);
  useEffect(() => { authFetch("/api/auth", { cache: "no-store" }).then((response) => response.json()).then((data) => { if (data?.token) setSessionToken(data.token); setMember(Boolean(data?.user)); }).catch(() => setMember(false)); }, []);
  const setLocale = (value: "fr" | "en") => { setLocaleState(value); window.localStorage.setItem("palacio_locale", value); document.documentElement.lang = value; };
  const previewing = Boolean(namedPreview && namedPreview !== settings.theme) || Boolean(customPreview);
  useSectionReveal(`${pathname}?${search.toString()}`);
  useEffect(() => {
    const save = () => rememberSitePath(`${window.location.pathname}${window.location.search}`);
    save();
    document.addEventListener("click", save, true);
    window.addEventListener("popstate", save);
    return () => {
      document.removeEventListener("click", save, true);
      window.removeEventListener("popstate", save);
    };
  }, [pathname, search]);
  return <SiteContext.Provider value={{ locale, setLocale, settings, member, setMember }}><div className="site-shell" data-theme={customPreview ? "custom" : theme} style={customPreview ? themeVariableStyle(settings.theme, customPreview) : previewing ? themeVariableStyle(theme) : undefined}>{previewing && <p className="theme-preview-banner">{locale === "en" ? "Unsaved theme preview" : "Aperçu du thème non enregistré"}</p>}<Header/>{children}<Footer/><a className="whatsapp-float" href={whatsappUrl(settings.whatsapp, tr(locale, "Bonjour Palacio Hotel ! J'aimerais avoir plus d'informations.", "Hello Palacio Hotel! I would like more information."))} target="_blank" rel="noopener noreferrer" aria-label="Contacter sur WhatsApp"><WhatsAppMark className="whatsapp-icon" size={31}/><span>{tr(locale, "Écrivez-nous", "Chat with us")}</span></a><ChatWidget/></div></SiteContext.Provider>;
}
