"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Camera, Mail, MapPin, Menu, Phone, UserRound, X } from "lucide-react";
import type { HotelSettings } from "@/db/schema";
import { ChatWidget } from "@/components/chat-widget";
import { hotelEmailUrl, hotelMapUrl, hotelPhoneUrl } from "@/lib/contact";

type Context = { locale: "fr" | "en"; setLocale: (locale: "fr" | "en") => void; settings: HotelSettings };
const SiteContext = createContext<Context | null>(null);
export function useSite() { const value = useContext(SiteContext); if (!value) throw new Error("Site context missing"); return value; }
export const tr = (locale: string, fr: string, en: string) => locale === "en" ? en : fr;
export const whatsappUrl = (number: string, text: string) => `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

function Brand({ settings, light = false }: { settings: HotelSettings; light?: boolean }) {
  if (settings.logoUrl) return <span className="brand-with-image"><img src={settings.logoUrl} alt={settings.hotelName} className="brand-image" /></span>;
  return <span className={`brand-wordmark ${light ? "brand-light" : ""}`}><span className="brand-mark">✦</span><span className="brand-main">PALACIO</span><span className="brand-small">H O T E L</span></span>;
}

function Header() {
  const { locale, setLocale, settings } = useSite();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);
  const links = [
    { href: "/", fr: "Accueil", en: "Home" },
    { href: "/hebergements", fr: "Hébergements", en: "Stay" },
    { href: "/hebergements?categorie=conference_room", fr: "Événements", en: "Events" },
    { href: "/hebergements?categorie=service", fr: "Expériences", en: "Experiences" },
    { href: "/devis", fr: "Devis sur mesure", en: "Get a quote" },
    { href: "/pages/notre-histoire", fr: "Notre histoire", en: "Our story" },
  ];
  return <header className="site-header">
    <div className="topbar"><div className="container topbar-inner"><div className="topbar-left"><MapPin size={13} strokeWidth={1.8}/><span>{locale === "en" ? settings.addressEn : settings.addressFr}</span><span className="topbar-divider"/><span>{tr(locale, "Votre parenthèse d'exception à Douala", "Your exceptional escape in Douala")}</span></div><div className="topbar-right"><a href={hotelPhoneUrl(settings)}><Phone size={13}/>{settings.phone}</a><span className="topbar-divider"/><button onClick={() => setLocale(locale === "fr" ? "en" : "fr")} className="language-switch" aria-label={tr(locale, "Passer en anglais", "Switch to French")}>{locale.toUpperCase()} <span>⌄</span></button></div></div></div>
    <div className="nav-wrap"><div className="container nav-inner"><Link href="/" aria-label="Palacio Hotel" className="brand-link"><Brand settings={settings}/></Link><nav className={`main-nav ${open ? "is-open" : ""}`} aria-label="Navigation principale">{links.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href ? "nav-active" : ""} onClick={() => setOpen(false)}>{tr(locale, link.fr, link.en)}</Link>)}<div className="mobile-nav-extra"><Link href="/contact">{tr(locale, "Nous contacter", "Contact us")}</Link><Link href="/compte">{tr(locale, "Mon compte", "My account")}</Link><button onClick={() => setLocale(locale === "fr" ? "en" : "fr")}>{locale === "fr" ? "English" : "Français"}</button></div></nav><div className="nav-actions"><Link href="/compte" className="nav-user" aria-label={tr(locale, "Mon compte", "My account")}><UserRound size={18} strokeWidth={1.7}/></Link><Link href="/reservation" className="btn btn-primary nav-book">{tr(locale, "Réserver", "Book now")} <ArrowRight size={15}/></Link><button className="mobile-menu-button" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X size={24}/> : <Menu size={24}/>}</button></div></div></div>
  </header>;
}

function Footer() {
  const { settings, locale } = useSite();
  const mapLink = hotelMapUrl(settings);
  return <footer className="site-footer"><div className="container"><div className="footer-top"><div className="footer-brand"><Link href="/"><Brand settings={settings} light/></Link><p>{tr(locale, "Une adresse singulière, des instants inoubliables. Bienvenue chez vous, à Douala.", "An extraordinary address, unforgettable moments. Welcome home in Douala.")}</p><div className="footer-social"><a href={whatsappUrl(settings.whatsapp, tr(locale, "Bonjour Palacio Hotel, j'aimerais vous contacter.", "Hello Palacio Hotel, I would like to contact you."))} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">WA</a><a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Camera size={17}/></a></div></div><div className="footer-col"><h4>{tr(locale, "Explorer", "Explore")}</h4><Link href="/hebergements">{tr(locale, "Nos hébergements", "Accommodation")}</Link><Link href="/hebergements?categorie=conference_room">{tr(locale, "Salles & événements", "Meetings & events")}</Link><Link href="/hebergements?categorie=service">{tr(locale, "Services & loisirs", "Services & leisure")}</Link><Link href="/pages/notre-histoire">{tr(locale, "Notre histoire", "Our story")}</Link></div><div className="footer-col"><h4>{tr(locale, "Votre séjour", "Your stay")}</h4><Link href="/reservation">{tr(locale, "Réserver un séjour", "Make a booking")}</Link><Link href="/devis">{tr(locale, "Demander un devis", "Request a quote")}</Link><Link href="/compte">{tr(locale, "Mon compte", "My account")}</Link><Link href="/contact">{tr(locale, "Nous contacter", "Contact us")}</Link></div><div className="footer-col footer-contact"><h4>{tr(locale, "Nous trouver", "Find us")}</h4><a href={mapLink} target="_blank" rel="noopener noreferrer"><MapPin size={16}/>{locale === "en" ? settings.addressEn : settings.addressFr}</a><a href={hotelPhoneUrl(settings)}><Phone size={16}/>{settings.phone}</a><a href={hotelEmailUrl(settings)}><Mail size={16}/>{settings.email}</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {settings.hotelName}. {tr(locale, "Tous droits réservés.", "All rights reserved.")}</span><div><Link href="/pages/confidentialite">{tr(locale, "Confidentialité", "Privacy")}</Link><Link href="/admin">Backoffice</Link><span>FR / EN</span></div></div></div></footer>;
}

export function SiteShell({ settings, children }: { settings: HotelSettings; children: ReactNode }) {
  const [locale, setLocaleState] = useState<"fr" | "en">("fr");
  useEffect(() => { const saved = window.localStorage.getItem("palacio_locale"); if (saved === "en") { setLocaleState("en"); document.documentElement.lang = "en"; } }, []);
  const setLocale = (value: "fr" | "en") => { setLocaleState(value); window.localStorage.setItem("palacio_locale", value); document.documentElement.lang = value; };
  return <SiteContext.Provider value={{ locale, setLocale, settings }}><div className="site-shell" data-theme={settings.theme}><Header/>{children}<Footer/><a className="whatsapp-float" href={whatsappUrl(settings.whatsapp, tr(locale, "Bonjour Palacio Hotel ! J'aimerais avoir plus d'informations.", "Hello Palacio Hotel! I would like more information."))} target="_blank" rel="noopener noreferrer" aria-label="Contacter sur WhatsApp"><span className="whatsapp-icon">☎</span><span>{tr(locale, "Écrivez-nous", "Chat with us")}</span></a><ChatWidget/></div></SiteContext.Provider>;
}
