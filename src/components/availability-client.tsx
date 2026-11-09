"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { CatalogItem } from "@/db/schema";
import { ItemCard } from "@/components/item-card";
import { StaySearchForm } from "@/components/stay-search-form";
import { PageBack } from "@/components/page-back";
import { tr, useSite } from "@/components/site-shell";
import { fitsGuestDemand, reservationHref, unitsNeeded, type AvailabilityStay } from "@/lib/availability-search";
import { memberHref } from "@/lib/member-gate";
import { siteImage } from "@/lib/site-image";

export function AvailabilityClient({ stay, results }: { stay: AvailabilityStay | null; results: { item: CatalogItem; remaining: number }[] }) {
  const { locale, settings, member } = useSite();
  return <main>
    <section className="page-hero" style={{ backgroundImage: `url('${siteImage(settings.pageHeroImage, "/images/palacio-suite.jpg")}')` }}><div className="container page-hero-inner"><PageBack /><div className="breadcrumb"><Link href="/">{tr(locale, "Accueil", "Home")}</Link><span>/</span><span>{tr(locale, "Disponibilités", "Availability")}</span></div><h1>{tr(locale, "Résultats de votre recherche", "Your search results")}</h1><p>{stay ? tr(locale, `Du ${stay.checkIn} au ${stay.checkOut}, pour ${stay.guests} client${stay.guests > 1 ? "s" : ""}.`, `From ${stay.checkIn} to ${stay.checkOut}, for ${stay.guests} guest${stay.guests > 1 ? "s" : ""}.`) : tr(locale, "Choisissez vos dates et le nombre de clients.", "Choose your dates and number of guests.")}</p></div></section>
    <section className="page-content"><div className="container availability-page">
      <StaySearchForm initial={stay ?? undefined}/>
      {stay && <p className="availability-result"><span className="availability-dot"/>{tr(locale, "Les disponibilités sont indicatives et seront confirmées par l’hôtel avant validation de votre réservation.", "Availability is indicative and will be confirmed by the hotel before your booking is finalized.")}</p>}
      {stay && <div className="catalog-toolbar"><span className="catalog-count">{results.length} {tr(locale, results.length > 1 ? "hébergements correspondant à votre recherche" : "hébergement correspondant à votre recherche", results.length === 1 ? "accommodation matching your search" : "accommodations matching your search")}</span></div>}
      {stay && results.length > 0 && <div className="catalog-grid">{results.map(({ item, remaining }, index) => {
        const needed = unitsNeeded(item.capacity, stay.guests) ?? 1;
        const canRequest = fitsGuestDemand(item.capacity, remaining, stay.guests);
        const stock = canRequest
          ? tr(locale, `${remaining} unité${remaining > 1 ? "s" : ""} disponible${remaining > 1 ? "s" : ""}`, `${remaining} unit${remaining > 1 ? "s" : ""} currently available`)
          : remaining > 0
            ? tr(locale, `${remaining} unité${remaining > 1 ? "s" : ""} disponible${remaining > 1 ? "s" : ""} · ${needed} requise${needed > 1 ? "s" : ""}`, `${remaining} unit${remaining > 1 ? "s" : ""} currently available · ${needed} required`)
            : tr(locale, "Complet aux dates recherchées", "Fully booked for these dates");
        const party = needed > 1 ? tr(locale, `${needed} unités pour ${stay.guests} pers.`, `${needed} units for ${stay.guests} guests`) : "";
        return <article className="availability-card" key={item.id}><ItemCard item={item} index={index} stay={stay ?? undefined}/><div className="availability-card-foot"><p className={`availability-result${canRequest ? "" : " unavailable"}`} role="status"><span className="availability-dot"/>{stock}{party ? ` · ${party}` : ""}</p>{canRequest ? <Link className="btn btn-primary" href={memberHref(member === true, reservationHref(item.id, stay))}>{tr(locale, "Réserver", "Book")}<ArrowRight size={16}/></Link> : <a className="btn btn-outline" href="#stay-search">{tr(locale, "Modifier les dates", "Change dates")}</a>}</div></article>;
      })}</div>}
      {stay && results.length === 0 && <div className="empty-state"><Sparkles size={29}/><h3>{tr(locale, "Aucun hébergement correspondant", "No matching accommodation")}</h3><p>{tr(locale, `Aucun hébergement actif ne peut accueillir ${stay.guests} personne${stay.guests > 1 ? "s" : ""}, même avec plusieurs unités. Modifiez le nombre de personnes ou demandez une proposition sur mesure.`, `No active accommodation can host ${stay.guests} guest${stay.guests > 1 ? "s" : ""}, even across multiple units. Adjust the guest count or request a tailored proposal.`)}</p><Link href={memberHref(member === true, "/devis")} className="btn btn-primary">{tr(locale, "Demander un devis", "Request a quote")}<ArrowRight size={16}/></Link></div>}
    </div></section>
  </main>;
}
