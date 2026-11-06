"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Newspaper } from "lucide-react";
import type { ContentPage } from "@/db/schema";
import { useSite, tr } from "@/components/site-shell";
import { newsDisplayDate } from "@/lib/news-publication";
import { siteImage } from "@/lib/site-image";

function articleCopy(page: ContentPage, locale: string) {
  const localizedSummary = locale === "en" ? page.summaryEn : page.summaryFr;
  return {
    title: locale === "en" ? page.titleEn : page.titleFr,
    summary: localizedSummary || (locale === "en" ? page.bodyEn : page.bodyFr),
    hasSummary: Boolean(localizedSummary),
    body: locale === "en" ? page.bodyEn : page.bodyFr,
  };
}

function excerpt(summary: string, limit = 240) {
  const text = summary.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

function localizedDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function ArticleDate({ page }: { page: ContentPage }) {
  const { locale } = useSite();
  const date = newsDisplayDate(page);
  return <time dateTime={date.toISOString()} className="news-date"><CalendarDays size={14} aria-hidden="true"/>{localizedDate(date, locale)}</time>;
}

function NewsImage({ page, priority = false }: { page: ContentPage; priority?: boolean }) {
  const { locale } = useSite();
  const title = locale === "en" ? page.titleEn : page.titleFr;
  return <img
    src={siteImage(page.image, "/images/palacio-hero.jpg")}
    alt={title}
    loading={priority ? "eager" : "lazy"}
    fetchPriority={priority ? "high" : "auto"}
  />;
}

export function NewsJournalIndex({ items }: { items: ContentPage[] }) {
  const { locale, settings } = useSite();
  const heroImage = siteImage(settings.pageHeroImage, "/images/palacio-hero.jpg");
  const featured = items[0];
  const remaining = items.slice(1);
  const L = (fr: string, en: string) => tr(locale, fr, en);

  return <main className="news-journal">
    <section className="page-hero news-journal-hero" style={{ backgroundImage: `url('${heroImage}')` }}>
      <div className="container page-hero-inner">
        <div className="breadcrumb"><Link href="/">{L("Accueil", "Home")}</Link><span>/</span>{L("Actualités", "News")}</div>
        <p className="news-kicker">{L("LE JOURNAL DU PALACIO", "THE PALACIO JOURNAL")}</p>
        <h1>{L("Actualités", "News & stories")}</h1>
        <p className="news-intro">{L(
          "Les nouvelles du Palacio, les rendez-vous de la maison et les histoires qui font vivre notre hospitalité.",
          "News from the Palacio, happenings at the hotel and stories that bring our hospitality to life.",
        )}</p>
      </div>
    </section>

    <section className="page-content news-journal-content">
      <div className="container">
        {featured ? <>
          <div className="news-section-heading"><span>{L("À LA UNE", "IN THE SPOTLIGHT")}</span><i/></div>
          <article className="news-feature">
            <Link href={`/actualites/${featured.slug}`} className="news-feature-image" aria-label={`${L("Lire", "Read")}: ${articleCopy(featured, locale).title}`}>
              <NewsImage page={featured} priority/>
              <span className="news-feature-mark">{L("À découvrir", "Featured story")}</span>
            </Link>
            <div className="news-feature-copy">
              <ArticleDate page={featured}/>
              <h2><Link href={`/actualites/${featured.slug}`}>{articleCopy(featured, locale).title}</Link></h2>
              <p>{excerpt(articleCopy(featured, locale).summary, 300)}</p>
              <Link className="news-read-link" href={`/actualites/${featured.slug}`}>{L("Lire l’article", "Read the story")}<ArrowRight size={16}/></Link>
            </div>
          </article>
          {remaining.length > 0 && <>
            <div className="news-section-heading news-latest-heading"><span>{L("LES DERNIÈRES NOUVELLES", "LATEST STORIES")}</span><i/></div>
            <div className="news-grid">
              {remaining.map((page) => {
                const copy = articleCopy(page, locale);
                return <article className="news-card" key={page.id}>
                  <Link className="news-card-image" href={`/actualites/${page.slug}`} aria-label={`${L("Lire", "Read")}: ${copy.title}`}><NewsImage page={page}/></Link>
                  <div className="news-card-copy">
                    <ArticleDate page={page}/>
                    <h2><Link href={`/actualites/${page.slug}`}>{copy.title}</Link></h2>
                    <p>{excerpt(copy.summary, 210)}</p>
                    <Link className="news-read-link" href={`/actualites/${page.slug}`}>{L("Découvrir", "Discover")}<ArrowRight size={15}/></Link>
                  </div>
                </article>;
              })}
            </div>
          </>}
        </> : <div className="news-empty-state">
          <Newspaper size={28} aria-hidden="true"/>
          <p className="news-kicker">{L("LE JOURNAL DU PALACIO", "THE PALACIO JOURNAL")}</p>
          <h2>{L("Le prochain chapitre s’écrit bientôt.", "The next chapter is coming soon.")}</h2>
          <p>{L("Aucune actualité publiée pour le moment. Revenez bientôt découvrir les nouvelles de la maison.", "There are no published stories just yet. Please check back soon for news from the hotel.")}</p>
          <Link className="news-read-link" href="/contact">{L("Nous contacter", "Get in touch")}<ArrowRight size={16}/></Link>
        </div>}
      </div>
    </section>
  </main>;
}

export function NewsArticle({ page }: { page: ContentPage }) {
  const { locale } = useSite();
  const copy = articleCopy(page, locale);
  const paragraphs = copy.body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const L = (fr: string, en: string) => tr(locale, fr, en);
  const cover = siteImage(page.image, "/images/palacio-hero.jpg");

  return <main className="news-journal news-article">
    <div className="container news-article-wrap">
      <nav className="news-breadcrumb" aria-label={L("Fil d’Ariane", "Breadcrumb")}>
        <Link href="/">{L("Accueil", "Home")}</Link><span>/</span><Link href="/actualites">{L("Actualités", "News")}</Link><span>/</span><span aria-current="page">{copy.title}</span>
      </nav>
      <Link href="/actualites" className="news-back-link"><ArrowLeft size={15}/>{L("Retour aux actualités", "Back to news")}</Link>
      <article>
        <header className="news-article-header">
          <div className="news-article-heading">
            <p className="news-kicker">{L("LE JOURNAL DU PALACIO", "THE PALACIO JOURNAL")}</p>
            <ArticleDate page={page}/>
            <h1>{copy.title}</h1>
            {copy.hasSummary ? <p className="news-article-summary">{copy.summary}</p> : null}
          </div>
          <figure className="news-article-cover"><img src={cover} alt={copy.title} fetchPriority="high"/></figure>
        </header>
        <div className="news-article-body">
          {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          {page.galleryImages.length > 0 && <section className="news-article-gallery" aria-label={L("Galerie de l’article", "Article photo gallery")}>
            {page.galleryImages.map((image, index) => <figure key={`${image}-${index}`}><img src={siteImage(image, "/images/palacio-hero.jpg")} alt={`${copy.title} — ${L("photo", "photo")} ${index + 1}`} loading="lazy"/></figure>)}
          </section>}
          <aside className="news-contact-cta">
            <div><span className="news-kicker">{L("VOTRE PROCHAIN SÉJOUR", "YOUR NEXT STAY")}</span><h2>{L("L’hospitalité du Palacio vous attend.", "Palacio hospitality is waiting for you.")}</h2></div>
            <Link className="btn btn-primary" href="/contact">{L("Parlons de votre séjour", "Plan your stay")}<ArrowRight size={16}/></Link>
          </aside>
          <Link href="/actualites" className="news-back-link"><ArrowLeft size={15}/>{L("Toutes les actualités", "All news")}</Link>
        </div>
      </article>
    </div>
  </main>;
}
