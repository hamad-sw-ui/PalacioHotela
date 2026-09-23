"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ContentPage } from "@/db/schema";
import { tr, useSite } from "@/components/site-shell";

export function ContentPageClient({ page }: { page: ContentPage }) {
  const { locale } = useSite();
  const title = locale === "en" ? page.titleEn : page.titleFr;
  const paragraphs = (locale === "en" ? page.bodyEn : page.bodyFr).split(/\n\s*\n/).filter(Boolean);
  return <main><section className="page-hero" style={{ backgroundImage: `url('${page.image || "/images/palacio-hero.jpg"}')` }}><div className="container page-hero-inner"><div className="breadcrumb"><Link href="/">{tr(locale, "Accueil", "Home")}</Link><span>/</span>{title}</div><h1>{title}</h1></div></section><section className="page-content"><div className="container editorial-page"><span className="eyebrow"><span className="eyebrow-line"/>{tr(locale, "PALACIO HOTEL · DOUALA", "PALACIO HOTEL · DOUALA")}</span><h2>{title}</h2>{paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}<Link href="/contact" className="btn btn-primary">{tr(locale, "Parlons de votre séjour", "Let's talk about your stay")}<ArrowRight size={16}/></Link></div></section></main>;
}
