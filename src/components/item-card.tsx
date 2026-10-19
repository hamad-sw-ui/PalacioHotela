"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BedDouble, CalendarDays, ChevronLeft, ChevronRight, Sparkles, Users } from "lucide-react";
import type { CatalogItem } from "@/db/schema";
import { itemSlides } from "@/lib/catalog-gallery";
import { catalogItemHref, type AvailabilityStay } from "@/lib/availability-search";
import { formatXaf } from "@/lib/format";
import { tr, useSite } from "@/components/site-shell";
import { siteImage } from "@/lib/site-image";

const categoryNames: Record<string, [string, string]> = { accommodation: ["Hébergement", "Accommodation"], conference_room: ["Conférences", "Meetings"], event_hall: ["Événements", "Events"], service: ["Expérience", "Experience"], restaurant: ["Gastronomie", "Dining"] };

export function ItemCard({ item, index = 0, stay }: { item: CatalogItem; index?: number; stay?: AvailabilityStay }) {
  const { locale, settings } = useSite();
  const label = categoryNames[item.category] || ["Expérience", "Experience"];
  const name = locale === "en" ? item.nameEn : item.nameFr;
  const slides = itemSlides(item);
  const photos = slides.length ? slides : [item.image || siteImage(settings.fallbackImage, "/images/palacio-suite.jpg")];
  const itemHref = catalogItemHref(item.slug, stay);
  const [photo, setPhoto] = useState(0);
  const current = photos[Math.min(photo, photos.length - 1)];
  const step = (direction: -1 | 1) => setPhoto((value) => (Math.min(value, photos.length - 1) + direction + photos.length) % photos.length);
  const image = photos.length < 2
    ? <Link href={itemHref} className="item-card-image"><img onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = siteImage(settings.fallbackImage, "/images/palacio-hero.jpg"); }} src={current} alt={name} loading="lazy"/><span className="item-card-label">{tr(locale, label[0], label[1])}</span></Link>
    : <div className="item-card-image item-card-gallery"><Link href={itemHref} className="item-card-track-link"><span className="item-card-track" style={{ transform: `translateX(-${Math.min(photo, photos.length - 1) * 100}%)` }}>{photos.map((src) => <img key={src} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = siteImage(settings.fallbackImage, "/images/palacio-hero.jpg"); }} src={src} alt={name} loading="lazy"/>)}</span><span className="item-card-label">{tr(locale, label[0], label[1])}</span></Link><span className="item-card-photo-count">{photos.length} {tr(locale, "photos", "photos")}</span><button type="button" className="item-card-nav prev" aria-label={tr(locale, "Photo précédente", "Previous photo")} onClick={() => step(-1)}><ChevronLeft size={16}/></button><button type="button" className="item-card-nav next" aria-label={tr(locale, "Photo suivante", "Next photo")} onClick={() => step(1)}><ChevronRight size={16}/></button></div>;
  return <article className="item-card" style={{ animationDelay: `${index * 90}ms` }}>{image}<div className="item-card-content"><div className="item-card-meta"><span>{item.category === "accommodation" ? <BedDouble size={14}/> : item.category === "service" || item.category === "restaurant" ? <Sparkles size={14}/> : <CalendarDays size={14}/>} {tr(locale, label[0], label[1])}</span><span><Users size={14}/> {item.capacity} {tr(locale, "pers.", "guests")}</span></div><Link href={itemHref}><h3>{name}</h3></Link><p>{locale === "en" ? item.descriptionEn : item.descriptionFr}</p><div className="item-card-bottom"><div><span>{tr(locale, "À partir de", "From")}</span><strong>{formatXaf(item.price, locale)}</strong><small> / {tr(locale, item.pricingUnit === "night" ? "nuit" : item.pricingUnit === "day" ? "jour" : "pers.", item.pricingUnit === "night" ? "night" : item.pricingUnit === "day" ? "day" : "person")}</small></div><Link href={itemHref} aria-label={`${tr(locale, "Découvrir", "Discover")} ${item.nameFr}`} className="round-link"><ArrowUpRight size={20}/></Link></div></div></article>;
}
