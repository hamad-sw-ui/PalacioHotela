"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, Banknote, CalendarDays, Check, CheckCircle2, CreditCard, Info, Loader2, MessageCircle, ShieldCheck, Users, Wallet } from "lucide-react";
import type { CatalogItem } from "@/db/schema";
import { HeroGallery } from "@/components/hero-gallery";
import { ItemCard } from "@/components/item-card";
import { itemSlides } from "@/lib/catalog-gallery";
import { normalizeCatalogFeatures } from "@/lib/catalog-features";
import { authFetch } from "@/lib/client-session";
import { daysBetween, formatXaf, validDateRange } from "@/lib/format";
import { memberHref, signInHref } from "@/lib/member-gate";
import { PageBack } from "@/components/page-back";
import { tr, useSite, whatsappUrl } from "@/components/site-shell";

type Method = "cash" | "card" | "paypal";
type Account = { fullName: string; email: string; phone?: string | null };

export function DetailClient({ item, related, config }: { item: CatalogItem; related: CatalogItem[]; items: CatalogItem[]; config: { card: boolean; paypal: boolean; cash: boolean; paypalRate: number | null; stripeRate?: number | null } }) {
  const { locale, settings, member } = useSite();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const draftKey = `palacio_detail_book_${item.id}`;
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(Math.min(item.capacity, 2));
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<Method>(config.cash ? "cash" : config.card ? "card" : "paypal");
  const [consent, setConsent] = useState(false);
  const [phone, setPhone] = useState("");
  const [me, setMe] = useState<Account | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ reference: string; token: string; paymentError?: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const here = `${pathname}${search.toString() ? `?${search}` : ""}`;
  const quantityMax = remaining !== null ? Math.min(25, remaining) : 25;
  const soldOut = remaining === 0;
  const nights = validDateRange(checkIn, checkOut) ? daysBetween(checkIn, checkOut) : 0;
  const total = item.price * quantity * (["night", "day"].includes(item.pricingUnit) && nights > 0 ? nights : 1);
  const phoneMissing = Boolean(me) && (me?.phone || "").trim().length < 6 && phone.trim().length < 6;

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) || "null") as Record<string, unknown> | null;
      if (saved && typeof saved === "object") {
        if (typeof saved.checkIn === "string") setCheckIn(saved.checkIn);
        if (typeof saved.checkOut === "string") setCheckOut(saved.checkOut);
        if (typeof saved.guests === "number") setGuests(Math.min(500, Math.max(1, saved.guests)));
        if (typeof saved.quantity === "number") setQuantity(Math.min(25, Math.max(1, saved.quantity)));
        if (typeof saved.notes === "string") setNotes(saved.notes.slice(0, 2000));
        if (saved.method === "cash" || saved.method === "card" || saved.method === "paypal") setMethod(saved.method);
        if (typeof saved.consent === "boolean") setConsent(saved.consent);
      }
    } catch { /* a broken draft must not block the page */ }
    setDraftReady(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady || success) return;
    sessionStorage.setItem(draftKey, JSON.stringify({ checkIn, checkOut, guests, quantity, notes, method, consent }));
  }, [draftReady, success, draftKey, checkIn, checkOut, guests, quantity, notes, method, consent]);

  useEffect(() => {
    authFetch("/api/auth", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => {
      const user = data?.user as Account | undefined;
      if (!user) return;
      setMe(user);
      setPhone((current) => current || user.phone || "");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!validDateRange(checkIn, checkOut)) { setRemaining(null); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/availability?itemId=${item.id}&checkIn=${checkIn}&checkOut=${checkOut}`, { signal: controller.signal }).then((r) => r.json()).then((d) => setRemaining(d.availability?.[0]?.remaining ?? null)).catch(() => {}).finally(() => setLoading(false));
    return () => controller.abort();
  }, [item.id, checkIn, checkOut]);

  useEffect(() => { if (quantityMax >= 1 && quantity > quantityMax) setQuantity(quantityMax); }, [quantityMax, quantity]);

  async function reserve() {
    setError("");
    if (member !== true) { router.push(signInHref(here)); return; }
    if (!validDateRange(checkIn, checkOut)) { setError(tr(locale, "Veuillez choisir des dates valides.", "Please select valid dates.")); return; }
    if (soldOut || (remaining !== null && remaining < quantity)) { setError(tr(locale, "Cet espace n'est plus disponible pour ces dates.", "This space is no longer available for these dates.")); return; }
    if (guests > item.capacity * quantity) { setError(tr(locale, "Le nombre de personnes dépasse la capacité.", "Guest count exceeds capacity.")); return; }
    if (phoneMissing) { setError(tr(locale, "Ajoutez un numéro de téléphone.", "Add a phone number.")); return; }
    if (!consent) { setError(tr(locale, "Veuillez accepter le traitement de vos données.", "Please accept our privacy policy.")); return; }
    setSubmitting(true);
    try {
      const response = await authFetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id, checkIn, checkOut, guests, quantity, guestName: me?.fullName || "", guestEmail: me?.email || "", guestPhone: phone, notes, paymentMethod: method, locale }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur de réservation.");
      sessionStorage.removeItem(draftKey);
      if (data.redirectUrl) { window.location.assign(data.redirectUrl); return; }
      setSuccess({ reference: data.reference, token: data.token, paymentError: data.paymentError });
    } catch (err) { setError(err instanceof Error ? err.message : "Une erreur est survenue."); }
    finally { setSubmitting(false); }
  }

  const category = item.category === "accommodation" ? tr(locale, "Hébergement", "Accommodation") : item.category === "conference_room" ? tr(locale, "Conférence", "Meeting") : item.category === "event_hall" ? tr(locale, "Événement", "Event") : item.category === "restaurant" ? tr(locale, "Gastronomie", "Dining") : tr(locale, "Service & loisir", "Service & leisure");
  const name = locale === "en" ? item.nameEn : item.nameFr;
  const photos = itemSlides(item);
  const slides = (photos.length ? photos : [item.image || "/images/palacio-hero.jpg"]).map((src) => ({ src, alt: name }));
  const features = normalizeCatalogFeatures(item.features);
  return <main><HeroGallery className="detail-hero" label={name} previousLabel={tr(locale, "Précédent", "Previous")} nextLabel={tr(locale, "Suivant", "Next")} slides={slides}><div className="container page-hero-inner"><PageBack /><div className="breadcrumb"><Link href="/">{tr(locale, "Accueil", "Home")}</Link><span>/</span><Link href="/hebergements">{tr(locale, "Découvrir", "Discover")}</Link><span>/</span>{name}</div><span className="eyebrow eyebrow-light"><span className="eyebrow-line"/>{category.toUpperCase()}</span><h1>{name}</h1><p>{locale === "en" ? item.descriptionEn : item.descriptionFr}</p></div></HeroGallery><section className="page-content"><div className="container detail-grid"><div className="detail-main"><div className="detail-topline"><span><Users size={16}/> {tr(locale, "Jusqu’à", "Up to")} {item.capacity} {tr(locale, "personnes", "guests")}</span><span><CheckCircle2 size={16}/> {tr(locale, "Service Palacio", "Palacio service")}</span><span><CalendarDays size={16}/> {tr(locale, "Sur réservation", "By reservation")}</span></div>{features.length > 0 && <div className="detail-features">{features.map((feature) => <span key={`${feature.labelFr}-${feature.value}`}><strong>{feature.value}</strong> {locale === "en" ? feature.labelEn : feature.labelFr}</span>)}</div>}<div className="eyebrow"><span className="eyebrow-line"/>{tr(locale, "DÉCOUVRIR L’ESPACE", "DISCOVER THE SPACE")}</div><h2 className="detail-title">{tr(locale, "Un espace imaginé pour ", "A space designed for ")}<em>{tr(locale, "vos plus beaux instants.", "your finest moments.")}</em></h2><p className="detail-description">{locale === "en" ? item.descriptionEn : item.descriptionFr} {tr(locale, "Chaque détail est pensé pour vous offrir une expérience chaleureuse et élégante, à la hauteur de vos attentes.", "Every detail is considered to offer you a warm, elegant experience that exceeds expectations.")}</p><div className="detail-inline-image"><img onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/palacio-hero.jpg"; }} src={item.image} alt={name}/></div><h3 className="detail-subheading">{tr(locale, "Ce qui vous attend", "What awaits you")}</h3><div className="amenities-grid">{(locale === "en" ? item.amenitiesEn : item.amenitiesFr).map((amenity) => <span key={amenity}><Check size={16}/>{amenity}</span>)}</div><div className="detail-help"><MessageCircle size={22}/><div><strong>{tr(locale, "Une question, une envie particulière ?", "A question or special request?")}</strong><p>{tr(locale, "Notre équipe est là pour imaginer le séjour ou l’événement parfait pour vous.", "Our team is here to help create your perfect stay or event.")}</p></div><a href={whatsappUrl(settings.whatsapp, tr(locale, `Bonjour, j'aimerais en savoir plus sur ${item.nameFr}.`, `Hello, I'd like to know more about ${item.nameEn}.`))} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={19}/></a></div></div><aside className="detail-aside"><div className="detail-book-card"><div className="detail-book-inner">{success ? <div className="detail-book-done"><div className="success-icon"><Check size={33}/></div><h3>{tr(locale, "Demande enregistrée !", "Request received!")}</h3><p>{tr(locale, "Votre demande de réservation est entre de bonnes mains. Notre équipe vous confirmera sa disponibilité très prochainement.", "Your booking request is in good hands. Our team will confirm availability shortly.")}</p><div className="success-reference">{success.reference}</div>{success.paymentError && <p className="notice notice-error">{success.paymentError}</p>}<Link href={`/reservation/confirmation?token=${success.token}`} className="btn btn-primary detail-cta">{tr(locale, "Suivre ma réservation", "View my booking")}<ArrowRight size={17}/></Link></div> : <><span className="eyebrow"><span className="eyebrow-line"/>{tr(locale, "VOTRE EXPÉRIENCE", "YOUR EXPERIENCE")}</span><h3>{name}</h3><div className="detail-price"><small>{tr(locale, "À partir de", "From")}</small><strong>{formatXaf(item.price, locale)}</strong><span> / {tr(locale, item.pricingUnit === "night" ? "nuit" : item.pricingUnit === "day" ? "jour" : "pers.", item.pricingUnit === "night" ? "night" : item.pricingUnit === "day" ? "day" : "person")}</span></div><div className="form-grid detail-date-fields"><label className="field"><span>{tr(locale, "DU", "FROM")}</span><input type="date" min={today} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut && checkOut <= e.target.value) setCheckOut(""); }}/></label><label className="field"><span>{tr(locale, "AU", "TO")}</span><input type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)}/></label><label className="field"><span>{tr(locale, "NOMBRE DE PERSONNES", "NUMBER OF GUESTS")} *</span><input type="number" min={1} max={500} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}/></label><label className="field"><span>{tr(locale, "NOMBRE D’UNITÉS", "QUANTITY")} *</span><input type="number" min={1} max={Math.max(quantityMax, 1)} value={quantity} disabled={soldOut} onChange={(e) => { if (quantityMax < 1) return; setQuantity(Math.max(1, Math.min(quantityMax, Number(e.target.value) || 1))); }}/>{remaining !== null && <small className="field-hint">{soldOut ? tr(locale, "Complet à ces dates.", "Fully booked for these dates.") : tr(locale, `Maximum ${quantityMax} unité(s) pour ces dates.`, `Up to ${quantityMax} unit(s) for these dates.`)}</small>}</label></div>{checkIn && checkOut && <div className={`availability-result ${remaining === 0 ? "unavailable" : ""}`}><span className="availability-dot"/>{loading ? tr(locale, "Vérification...", "Checking...") : remaining === null ? tr(locale, "Choisissez des dates valides", "Select valid dates") : remaining > 0 ? tr(locale, `${remaining} disponible(s) pour ces dates`, `${remaining} available for these dates`) : tr(locale, "Complet à ces dates", "Unavailable on these dates")}</div>}{nights > 0 && <div className="detail-estimate"><span>{tr(locale, "Montant estimé TTC", "Estimated total incl. tax")}</span><strong>{formatXaf(total, locale)}</strong></div>}<label className="field"><span>{tr(locale, "DEMANDE PARTICULIÈRE (OPTIONNEL)", "SPECIAL REQUEST (OPTIONAL)")}</span><textarea placeholder={tr(locale, "Une occasion spéciale, une préférence ? Dites-nous tout...", "A special occasion or preference? Tell us more...")} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000}/></label>{phoneMissing && <label className="field"><span>{tr(locale, "TÉLÉPHONE", "PHONE")} *</span><input type="tel" minLength={6} placeholder="+237 6..." value={phone} onChange={(e) => setPhone(e.target.value)}/></label>}<div className="detail-payment"><span className="eyebrow"><span className="eyebrow-line"/>{tr(locale, "MODE DE PAIEMENT", "PAYMENT METHOD")}</span><div className="payment-options"><button type="button" className={`payment-option ${method === "cash" ? "active" : ""}`} onClick={() => setMethod("cash")}><Banknote size={20}/><span><strong>{tr(locale, "Payer à l’hôtel", "Pay at the hotel")}</strong><small>{tr(locale, "Espèces, à votre arrivée", "Cash on arrival")}</small></span><span className="payment-check">{method === "cash" && <Check size={14}/>}</span></button><button type="button" disabled={!config.card} className={`payment-option ${method === "card" ? "active" : ""}`} onClick={() => setMethod("card")}><CreditCard size={20}/><span><strong>{tr(locale, "Carte bancaire", "Credit / debit card")}</strong><small>{config.card ? tr(locale, "Paiement sécurisé en EUR via Stripe", "Secure payment in EUR via Stripe") : tr(locale, "Bientôt disponible", "Coming soon")}</small></span><span className="payment-check">{method === "card" && <Check size={14}/>}</span></button><button type="button" disabled={!config.paypal} className={`payment-option ${method === "paypal" ? "active" : ""}`} onClick={() => setMethod("paypal")}><Wallet size={20}/><span><strong>PayPal</strong><small>{config.paypal ? tr(locale, "Paiement sécurisé en EUR", "Secure payment in EUR") : tr(locale, "Bientôt disponible", "Coming soon")}</small></span><span className="payment-check">{method === "paypal" && <Check size={14}/>}</span></button></div>{method === "card" && config.card && config.stripeRate ? <p className="payment-info"><Info size={15}/>{tr(locale, `Stripe facture en EUR au taux de ${config.stripeRate} XAF/EUR.`, `Stripe charges in EUR at ${config.stripeRate} XAF/EUR.`)}</p> : null}{method === "paypal" && config.paypalRate && <p className="payment-info"><Info size={15}/>{tr(locale, `PayPal facture en EUR au taux configuré de ${config.paypalRate} XAF/EUR.`, `PayPal charges in EUR at the configured rate of ${config.paypalRate} XAF/EUR.`)}</p>}</div><label className="consent-line"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}/><span>{tr(locale, "J’accepte que mes données soient utilisées pour traiter ma demande conformément à la ", "I agree to my information being used to process my request under the ")}<Link href="/pages/confidentialite" target="_blank">{tr(locale, "politique de confidentialité", "privacy policy")}</Link>.</span></label>{error && <div className="notice notice-error" role="alert">{error}</div>}<button type="button" className="btn btn-primary detail-cta" disabled={submitting || remaining === 0 || (remaining !== null && remaining < quantity)} onClick={() => { void reserve(); }}>{submitting ? <Loader2 size={17} className="spin"/> : <ShieldCheck size={17}/>} {remaining === 0 ? tr(locale, "Complet à ces dates", "Unavailable on these dates") : submitting ? tr(locale, "Enregistrement...", "Submitting...") : method === "cash" ? tr(locale, "Réserver cet espace", "Book this space") : tr(locale, "Continuer vers le paiement sécurisé", "Continue to secure payment")}<ArrowRight size={17}/></button><Link href={memberHref(member === true, `/devis?itemId=${item.id}&kind=${item.category}`)} className="detail-quote-link">{tr(locale, "Demander un devis sur mesure", "Request a tailored quote")}<ArrowUpRight size={15}/></Link></>}</div></div></aside></div></section>{related.length > 0 && <section className="rooms-section section-pad"><div className="container"><div className="eyebrow"><span className="eyebrow-line"/>{tr(locale, "POUR PROLONGER LE PLAISIR", "MORE TO EXPLORE")}</div><h2 className="section-title">{tr(locale, "Vous aimerez ", "You may also ")}<em>{tr(locale, "aussi.", "love.")}</em></h2><div className="cards-grid">{related.slice(0,3).map((r,i) => <ItemCard key={r.id} item={r} index={i}/>)}</div></div></section>}</main>;
}
