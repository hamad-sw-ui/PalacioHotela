"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, SlidersHorizontal, Sparkles } from "lucide-react";
import type { CatalogItem } from "@/db/schema";
import { ItemCard } from "@/components/item-card";
import { tr, useSite } from "@/components/site-shell";

const filters = [
  { key: "all", fr: "Tout découvrir", en: "Discover all" },
  { key: "accommodation", fr: "Hébergements", en: "Accommodation" },
  { key: "conference_room", fr: "Conférences", en: "Meetings" },
  { key: "event_hall", fr: "Événements", en: "Events" },
  { key: "service", fr: "Services & loisirs", en: "Services & leisure" },
  { key: "restaurant", fr: "Gastronomie", en: "Dining" },
];

export function CatalogClient({ items, initialCategory }: { items: CatalogItem[]; initialCategory: string }) {
  const { locale } = useSite();
  const [filter, setFilter] = useState(initialCategory || "all");
  useEffect(() => { setFilter(initialCategory || "all"); }, [initialCategory]);
  const shown = filter === "all" ? items : items.filter((item) => item.category === filter);
  function change(key: string) { setFilter(key); window.history.replaceState(null, "", `/hebergements${key === "all" ? "" : `?categorie=${key}`}`); }
  return <main><section className="page-hero" style={{ backgroundImage: "url('/images/palacio-suite.jpg')" }}><div className="container page-hero-inner"><div className="breadcrumb"><Link href="/">{tr(locale, "Accueil", "Home")}</Link><span>/</span><span>{tr(locale, "Découvrir", "Discover")}</span></div><h1>{tr(locale, "L’univers Palacio", "The Palacio world")}</h1><p>{tr(locale, "Un lieu pour chaque envie, une expérience pour chaque histoire.", "A place for every desire, an experience for every story.")}</p></div></section><section className="page-content"><div className="container"><div className="page-intro"><div className="eyebrow"><span className="eyebrow-line"/>{tr(locale, "PRENEZ LE TEMPS DE CHOISIR", "TAKE YOUR TIME TO CHOOSE")}</div><h2>{tr(locale, "Votre prochaine belle ", "Your next beautiful ")}<em>{tr(locale, "histoire.", "story.")}</em></h2><p>{tr(locale, "Séjours, célébrations ou moments pour soi : explorez tout ce que Palacio a imaginé pour vous.", "Stays, celebrations or moments for yourself: discover everything Palacio has imagined for you.")}</p></div><div className="catalog-toolbar"><div className="filter-tabs"><SlidersHorizontal size={17}/>{filters.map((tab) => <button key={tab.key} className={`filter-tab ${filter === tab.key ? "active" : ""}`} onClick={() => change(tab.key)}>{tr(locale, tab.fr, tab.en)}</button>)}</div><span className="catalog-count">{shown.length} {tr(locale, "expériences", "experiences")}</span></div>{shown.length ? <div className="catalog-grid">{shown.map((item, i) => <ItemCard key={item.id} item={item} index={i}/>)}</div> : <div className="empty-state"><Sparkles size={29}/><h3>{tr(locale, "À venir très bientôt", "Coming soon")}</h3><p>{tr(locale, "Explorez une autre catégorie en attendant.", "Explore another category in the meantime.")}</p></div>}<div className="catalog-bottom-cta"><div><span className="eyebrow eyebrow-light"><span className="eyebrow-line"/>{tr(locale, "À VOTRE IMAGE", "MADE FOR YOU")}</span><h2>{tr(locale, "Une envie particulière ?", "Something special in mind?")}</h2><p>{tr(locale, "Partagez votre idée, nous ferons le reste.", "Tell us your idea, we'll take care of the rest.")}</p></div><Link href="/devis" className="btn btn-gold">{tr(locale, "Créer mon devis", "Request a quote")}<ArrowRight size={17}/></Link></div></div></section></main>;
}
