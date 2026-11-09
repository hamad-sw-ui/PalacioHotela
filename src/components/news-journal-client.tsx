"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Newspaper, X } from "lucide-react";
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
  const galleryImages = page.galleryImages.map((image) => siteImage(image, "/images/palacio-hero.jpg"));
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const activeImageIndexRef = useRef(activeImageIndex);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const galleryButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isLightboxOpen = activeImageIndex !== null;

  useEffect(() => {
    activeImageIndexRef.current = activeImageIndex;
  }, [activeImageIndex]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const currentIndex = activeImageIndexRef.current;
      if (currentIndex === null) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setActiveImageIndex(null);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveImageIndex((currentIndex - 1 + galleryImages.length) % galleryImages.length);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveImageIndex((currentIndex + 1) % galleryImages.length);
      } else if (event.key === "Tab") {
        const focusableButtons = lightboxRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!focusableButtons?.length) return;
        const firstButton = focusableButtons[0];
        const lastButton = focusableButtons[focusableButtons.length - 1];
        if (!lightboxRef.current?.contains(document.activeElement)) {
          event.preventDefault();
          firstButton.focus();
        } else if (event.shiftKey && document.activeElement === firstButton) {
          event.preventDefault();
          lastButton.focus();
        } else if (!event.shiftKey && document.activeElement === lastButton) {
          event.preventDefault();
          firstButton.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      triggerButtonRef.current?.focus();
    };
  }, [isLightboxOpen, galleryImages.length]);

  const openLightbox = (index: number) => {
    triggerButtonRef.current = galleryButtonRefs.current[index];
    setActiveImageIndex(index);
  };
  const closeLightbox = () => setActiveImageIndex(null);
  const showPreviousImage = () => setActiveImageIndex((index) => index === null ? null : (index - 1 + galleryImages.length) % galleryImages.length);
  const showNextImage = () => setActiveImageIndex((index) => index === null ? null : (index + 1) % galleryImages.length);

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
          {galleryImages.length > 0 && <section className="news-article-gallery-section" aria-label={L("Galerie de l’article", "Article photo gallery")}>
            <header className="news-article-gallery-heading">
              <div><p className="news-kicker">{L("EN IMAGES", "IN PICTURES")}</p><h2>{L("Les coulisses de l’histoire", "A closer look")}</h2></div>
              <span>{String(galleryImages.length).padStart(2, "0")} {L("PHOTOS", "PHOTOS")}</span>
            </header>
            <div className="news-article-gallery" data-count={galleryImages.length}>
              {galleryImages.map((image, index) => <figure key={`${image}-${index}`}>
                <button
                  className="news-article-gallery-image"
                  type="button"
                  ref={(element) => { galleryButtonRefs.current[index] = element; }}
                  onClick={() => openLightbox(index)}
                  aria-label={`${L("Ouvrir la photo", "Open photo")} ${index + 1} ${L("sur", "of")} ${galleryImages.length}`}
                >
                  <img src={image} alt={`${copy.title} — ${L("photo", "photo")} ${index + 1}`} loading="lazy"/>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                </button>
              </figure>)}
            </div>
          </section>}
          <aside className="news-contact-cta">
            <div><span className="news-kicker">{L("VOTRE PROCHAIN SÉJOUR", "YOUR NEXT STAY")}</span><h2>{L("L’hospitalité du Palacio vous attend.", "Palacio hospitality is waiting for you.")}</h2></div>
            <Link className="btn btn-primary" href="/contact">{L("Parlons de votre séjour", "Plan your stay")}<ArrowRight size={16}/></Link>
          </aside>
          <Link href="/actualites" className="news-back-link"><ArrowLeft size={15}/>{L("Toutes les actualités", "All news")}</Link>
        </div>
      </article>
    </div>
    {activeImageIndex !== null && <div
      className="news-lightbox"
      ref={lightboxRef}
      role="dialog"
      aria-modal="true"
      aria-label={L("Visionneuse de photos", "Photo viewer")}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeLightbox();
      }}
    >
      <button className="news-lightbox-close" type="button" ref={closeButtonRef} onClick={closeLightbox} aria-label={L("Fermer la photo", "Close photo viewer")}><X size={23}/></button>
      <button className="news-lightbox-nav news-lightbox-previous" type="button" onClick={showPreviousImage} disabled={galleryImages.length < 2} aria-label={L("Photo précédente", "Previous photo")}><ChevronLeft size={28}/></button>
      <figure className="news-lightbox-figure">
        <img src={galleryImages[activeImageIndex]} alt={`${copy.title} — ${L("photo", "photo")} ${activeImageIndex + 1}`}/>
        <figcaption aria-live="polite">{copy.title}<span>{String(activeImageIndex + 1).padStart(2, "0")} / {String(galleryImages.length).padStart(2, "0")}</span></figcaption>
      </figure>
      <button className="news-lightbox-nav news-lightbox-next" type="button" onClick={showNextImage} disabled={galleryImages.length < 2} aria-label={L("Photo suivante", "Next photo")}><ChevronRight size={28}/></button>
    </div>}
  </main>;
}
