"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { CatalogItem } from "@/db/schema";
import { ItemCard } from "@/components/item-card";
import { StaySearchForm } from "@/components/stay-search-form";
import { PageBack } from "@/components/page-back";
import { tr, useSite } from "@/components/site-shell";
import { reservationHref, unitsNeeded, type AvailabilityStay } from "@/lib/availability-search";
import { memberHref } from "@/lib/member-gate";

export function AvailabilityClient({ stay, results }: { stay: AvailabilityStay | null; results: { item: CatalogItem; remaining: number }[] }) {
  const { locale, member } = useSite();
  return <main>
    <section className="page-hero" style={{ backgroundImage: "url('/images/palacio-suite.jpg')" }}><div className="container page-hero-inner"><PageBack /><div className="breadcrumb"><Link href="/">{tr(locale, "Accueil", "Home")}</Link><span>/</span><span>{tr(locale, "Disponibilités", "Availability")}</span></div><h1>{tr(locale, "Espaces disponibles", "Available spaces")}</h1><p>{stay ? tr(locale, `Du ${stay.checkIn} au ${stay.checkOut}, pour ${stay.guests} voyageur${stay.guests > 1 ? "s" : ""}.`, `From ${stay.checkIn} to ${stay.checkOut}, for ${stay.guests} guest${stay.guests > 1 ? "s" : ""}.`) : tr(locale, "Choisissez vos dates et le nombre de voyageurs.", "Choose your dates and number of guests.")}</p></div></section>
    <section className="page-content"><div className="container availability-page">
      <StaySearchForm initial={stay ?? undefined}/>
      {stay && <div className="catalog-toolbar"><span className="catalog-count">{results.length} {tr(locale, results.length > 1 ? "espaces libres" : "espace libre", results.length === 1 ? "available space" : "available spaces")}</span></div>}
      {stay && results.length > 0 && <div className="catalog-grid">{results.map(({ item, remaining }, index) => {
        const needed = unitsNeeded(item.capacity, stay.guests) ?? 1;
        const stock = tr(locale, `${remaining} unité${remaining > 1 ? "s" : ""} libre${remaining > 1 ? "s" : ""}`, `${remaining} unit${remaining > 1 ? "s" : ""} free`);
        const party = needed > 1 ? tr(locale, `${needed} unités pour ${stay.guests} pers.`, `${needed} units for ${stay.guests} guests`) : "";
        return <article className="availability-card" key={item.id}><ItemCard item={item} index={index}/><div className="availability-card-foot"><p>{stock}{party ? ` · ${party}` : ""}</p><Link className="btn btn-primary" href={memberHref(member === true, reservationHref(item.id, stay))}>{tr(locale, "Réserver", "Book")}<ArrowRight size={16}/></Link></div></article>;
      })}</div>}
      {stay && results.length === 0 && <div className="empty-state"><Sparkles size={29}/><h3>{tr(locale, "Aucun espace libre", "Nothing available")}</h3><p>{tr(locale, "Aucun espace ne peut accueillir ce nombre de voyageurs sur ces dates. Modifiez la recherche, ou demandez une proposition sur mesure.", "No space can host this many guests on these dates. Adjust the search, or ask for a tailored proposal.")}</p><Link href={memberHref(member === true, "/devis")} className="btn btn-primary">{tr(locale, "Demander un devis", "Request a quote")}<ArrowRight size={16}/></Link></div>}
    </div></section>
  </main>;
}
