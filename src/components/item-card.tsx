"use client";

import Link from "next/link";
import { ArrowUpRight, BedDouble, CalendarDays, Sparkles, Users } from "lucide-react";
import type { CatalogItem } from "@/db/schema";
import { formatXaf } from "@/lib/format";
import { tr, useSite } from "@/components/site-shell";

const categoryNames: Record<string, [string, string]> = { accommodation: ["Hébergement", "Accommodation"], conference_room: ["Conférences", "Meetings"], event_hall: ["Événements", "Events"], service: ["Expérience", "Experience"], restaurant: ["Gastronomie", "Dining"] };

export function ItemCard({ item, index = 0 }: { item: CatalogItem; index?: number }) {
  const { locale } = useSite();
  const label = categoryNames[item.category] || ["Expérience", "Experience"];
  return <article className="item-card" style={{ animationDelay: `${index * 90}ms` }}><Link href={`/hebergements/${item.slug}`} className="item-card-image"><img onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/palacio-hero.jpg"; }} src={item.image || "/images/palacio-suite.jpg"} alt={locale === "en" ? item.nameEn : item.nameFr} loading="lazy"/><span className="item-card-label">{tr(locale, label[0], label[1])}</span><span className="item-card-arrow"><ArrowUpRight size={20}/></span></Link><div className="item-card-content"><div className="item-card-meta"><span>{item.category === "accommodation" ? <BedDouble size={14}/> : item.category === "service" || item.category === "restaurant" ? <Sparkles size={14}/> : <CalendarDays size={14}/>} {tr(locale, label[0], label[1])}</span><span><Users size={14}/> {item.capacity} {tr(locale, "pers.", "guests")}</span></div><Link href={`/hebergements/${item.slug}`}><h3>{locale === "en" ? item.nameEn : item.nameFr}</h3></Link><p>{locale === "en" ? item.descriptionEn : item.descriptionFr}</p><div className="item-card-bottom"><div><span>{tr(locale, "À partir de", "From")}</span><strong>{formatXaf(item.price, locale)}</strong><small> / {tr(locale, item.pricingUnit === "night" ? "nuit" : item.pricingUnit === "day" ? "jour" : "pers.", item.pricingUnit === "night" ? "night" : item.pricingUnit === "day" ? "day" : "person")}</small></div><Link href={`/hebergements/${item.slug}`} aria-label={`${tr(locale, "Découvrir", "Discover")} ${item.nameFr}`} className="round-link"><ArrowUpRight size={20}/></Link></div></div></article>;
}
