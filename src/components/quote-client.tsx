"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BedDouble, CalendarDays, Check, Download, Heart, Loader2, MessageCircle, Minus, Plus, ShieldCheck, Sparkles, Trash2, UserRound, Users, UtensilsCrossed } from "lucide-react";
import type { CatalogItem, SelectedItem } from "@/db/schema";
import { daysBetween, formatXaf, validDateRange } from "@/lib/format";
import { quoteLineTotal } from "@/lib/quote-pricing";
import type { QuoteAssistantResult } from "@/lib/quote-assistant-schema";
import { authFetch } from "@/lib/client-session";
import { getQuoteDraft, saveQuoteContact, setQuoteDraft, clearQuoteDraft, type QuoteDraftRestaurantLine } from "@/lib/quote-draft";
import { tr, useSite, whatsappUrl } from "@/components/site-shell";

type CartLine = { lineId: string; property_id: number; quantity: number; order_dates?: string[]; order_time?: string; meal_types?: string[]; parent_item_name?: string };
type Initial = { itemId?: string; kind?: string };
type Me = { user: { fullName: string; email: string; phone?: string | null; role?: string } | null };

const categories = [
  { key: "accommodation", fr: "Hébergements", en: "Accommodation", icon: BedDouble },
  { key: "conference_room", fr: "Conférences", en: "Conference rooms", icon: Users },
  { key: "event_hall", fr: "Salles de fête", en: "Event halls", icon: CalendarDays },
  { key: "service", fr: "Services & loisirs", en: "Services & leisure", icon: Sparkles },
  { key: "restaurant", fr: "Restauration", en: "Dining", icon: UtensilsCrossed },
];
const meals: [string, string, string][] = [
  ["breakfast", "Petit-déjeuner", "Breakfast"],
  ["lunch", "Déjeuner", "Lunch"],
  ["dinner", "Dîner", "Dinner"],
  ["snacks", "Collation", "Snacks"],
  ["other", "Autre", "Other"],
];

function id() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function lineFor(item: CatalogItem, line: CartLine): SelectedItem {
  return { property_id: item.id, type: item.category as SelectedItem["type"], name_fr: item.nameFr, name_en: item.nameEn, price: item.price, quantity: line.quantity, dates: line.order_dates, order_dates: line.order_dates, order_time: line.order_time, meal_types: line.meal_types, parent_item_name: line.parent_item_name };
}
function stayDates(checkIn: string, checkOut: string) {
  if (!validDateRange(checkIn, checkOut)) return [];
  return Array.from({ length: daysBetween(checkIn, checkOut) }, (_, index) => { const date = new Date(`${checkIn}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + index); return date.toISOString().slice(0, 10); });
}

export function QuoteClient({ items, initial }: { items: CatalogItem[]; initial: Initial }) {
  const { locale, settings } = useSite();
  const initialItem = items.find((item) => item.id === Number(initial.itemId));
  const [category, setCategory] = useState(initialItem?.category || (categories.some((x) => x.key === initial.kind) ? initial.kind! : "accommodation"));
  const [cart, setCart] = useState<CartLine[]>(initialItem ? [{ lineId: id(), property_id: initialItem.id, quantity: 1 }] : []);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [people, setPeople] = useState(2);
  const [mealTypes, setMealTypes] = useState<string[]>(["dinner"]);
  const [orderDates, setOrderDates] = useState<string[]>([]);
  const [orderTime, setOrderTime] = useState("");
  const [parentItemName, setParentItemName] = useState("");
  const [activeRestaurantLine, setActiveRestaurantLine] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [me, setMe] = useState<Me["user"]>(null);
  const signedIn = Boolean(me);
  const [company, setCompany] = useState("");
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [remaining, setRemaining] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantResult, setAssistantResult] = useState<QuoteAssistantResult | null>(null);
  const [assistantApplied, setAssistantApplied] = useState(false);
  const [result, setResult] = useState<{ reference: string; token: string; pdfUrl: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const shown = items.filter((item) => item.category === category);
  const reservationDays = useMemo(() => stayDates(checkIn, checkOut), [checkIn, checkOut]);
  const cartItems = useMemo(() => cart.map((line) => ({ line, item: items.find((item) => item.id === line.property_id) })).filter((entry) => entry.item) as { line: CartLine; item: CatalogItem }[], [cart, items]);
  const estimate = cartItems.reduce((sum, { line, item }) => sum + quoteLineTotal(lineFor(item, line)), 0);
  const peopleMax = cartItems.reduce((sum, { line, item }) => sum + (["accommodation", "conference_room", "event_hall"].includes(item.category) ? item.capacity * line.quantity : 0), 0);

  useEffect(() => {
    const draft = getQuoteDraft();
    const draftLines = [...draft.accommodationLines, ...draft.roomLines, ...draft.serviceLines, ...draft.restaurantLines].map((line) => ({ lineId: line.id || id(), property_id: line.property_id, quantity: line.quantity, order_dates: line.order_dates || line.dates, order_time: line.order_time, meal_types: line.meal_types, parent_item_name: line.parent_item_name }));
    if (draftLines.length) setCart(draftLines);
    if (draft.formSnapshot) { setName(draft.formSnapshot.name || ""); setEmail(draft.formSnapshot.email || ""); setPhone(draft.formSnapshot.phone || ""); setCompany(draft.formSnapshot.company || ""); setBudget(draft.formSnapshot.budget || ""); setMessage(draft.formSnapshot.message || ""); if (draft.formSnapshot.people) setPeople(draft.formSnapshot.people); if (draft.formSnapshot.checkIn) setCheckIn(draft.formSnapshot.checkIn); if (draft.formSnapshot.checkOut) setCheckOut(draft.formSnapshot.checkOut); }
    setDraftReady(true);
    authFetch("/api/auth", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((d) => { const user = (d as Me)?.user; if (!user) return; setMe(user); setName(user.fullName); setEmail(user.email); setPhone(user.phone || ""); }).catch(() => {});
  }, []);

  useEffect(() => { if (peopleMax > 0 && people > peopleMax) setPeople(peopleMax); }, [peopleMax, people]);
  useEffect(() => { if (!draftReady) return; const accommodationLines = cart.filter((line) => items.find((item) => item.id === line.property_id)?.category === "accommodation").map((line) => ({ ...line, id: line.lineId, type: "accommodation" as const })); const roomLines = cart.filter((line) => ["conference_room", "event_hall"].includes(items.find((item) => item.id === line.property_id)?.category || "")).map((line) => ({ ...line, id: line.lineId, type: "room" as const })); const serviceLines = cart.filter((line) => items.find((item) => item.id === line.property_id)?.category === "service").map((line) => ({ ...line, id: line.lineId, type: "service" as const })); const restaurantLines = cart.filter((line) => items.find((item) => item.id === line.property_id)?.category === "restaurant").map((line) => ({ ...line, id: line.lineId, type: "restaurant" as const, meal_types: line.meal_types || ["dinner"], order_dates: line.order_dates || [] })); setQuoteDraft({ accommodationLines, roomLines, serviceLines, restaurantLines: restaurantLines as QuoteDraftRestaurantLine[], formSnapshot: { name, email, phone, company, budget, message, people, checkIn, checkOut } }); }, [cart, name, email, phone, company, budget, message, people, checkIn, checkOut, items, draftReady]);
  useEffect(() => { if (!validDateRange(checkIn, checkOut) || category !== "restaurant") return; if (!orderDates.length) setOrderDates([checkIn]); }, [checkIn, checkOut, category, orderDates.length]);
  useEffect(() => { if (!validDateRange(checkIn, checkOut)) { setRemaining({}); return; } const controller = new AbortController(); fetch(`/api/availability?checkIn=${checkIn}&checkOut=${checkOut}`, { signal: controller.signal }).then((r) => r.json()).then((data) => { const next: Record<number, number> = {}; for (const a of data.availability || []) next[a.itemId] = a.remaining; setRemaining(next); }).catch(() => {}); return () => controller.abort(); }, [checkIn, checkOut]);

  function add(item: CatalogItem) {
    if (item.category === "restaurant") {
      const dates = orderDates.length ? orderDates : (checkIn ? [checkIn] : []);
      const mealsSelected = mealTypes.length ? mealTypes : ["dinner"];
      const same = cart.find((line) => line.property_id === item.id && JSON.stringify([...(line.meal_types || [])].sort()) === JSON.stringify([...mealsSelected].sort()) && JSON.stringify(line.order_dates || []) === JSON.stringify(dates) && (line.order_time || "") === orderTime && (line.parent_item_name || "") === parentItemName);
      if (same) setCart((old) => old.map((line) => line.lineId === same.lineId ? { ...line, quantity: line.quantity + 1 } : line));
      else { const next = { lineId: id(), property_id: item.id, quantity: 1, order_dates: dates, order_time: orderTime, meal_types: mealsSelected, parent_item_name: parentItemName }; setCart((old) => [...old, next]); setActiveRestaurantLine(next.lineId); }
      return;
    }
    setCart((old) => old.some((line) => line.property_id === item.id) ? old : [...old, { lineId: id(), property_id: item.id, quantity: 1 }]);
  }
  function changeQty(lineId: string, direction: number) { setCart((old) => old.map((line) => { if (line.lineId !== lineId) return line; const available = remaining[line.property_id]; const max = available !== undefined ? Math.max(1, available) : 50; return { ...line, quantity: Math.max(1, Math.min(max, line.quantity + direction)) }; })); }
  function toggleMeal(meal: string) { setMealTypes((old) => old.includes(meal) ? old.filter((m) => m !== meal) : [...old, meal]); }
  function toggleOrderDate(date: string) { setOrderDates((old) => old.includes(date) ? old.filter((value) => value !== date) : [...old, date].sort()); }
  function loadRestaurantLine(line: CartLine) { setActiveRestaurantLine(line.lineId); setMealTypes(line.meal_types || ["dinner"]); setOrderDates(line.order_dates || []); setOrderTime(line.order_time || ""); setParentItemName(line.parent_item_name || ""); }
  function clearRestaurantStaging() { setActiveRestaurantLine(null); setMealTypes(["dinner"]); setOrderDates(checkIn ? [checkIn] : []); setOrderTime(""); setParentItemName(""); }
  function removeLine(lineId: string) { setCart((old) => old.filter((line) => line.lineId !== lineId)); if (activeRestaurantLine === lineId) clearRestaurantStaging(); }
  function updateActiveRestaurantLine() { if (!activeRestaurantLine) return; setCart((old) => old.map((line) => line.lineId === activeRestaurantLine ? { ...line, meal_types: mealTypes.length ? mealTypes : ["dinner"], order_dates: orderDates, order_time: orderTime, parent_item_name: parentItemName } : line)); }
  function assistantLineKey(line: { property_id: number; meal_types?: string[]; order_dates?: string[]; order_time?: string; parent_item_name?: string }) { return `${line.property_id}::${[...(line.meal_types || [])].sort().join("|")}::${[...(line.order_dates || [])].sort().join("|")}::${line.order_time || ""}::${line.parent_item_name || ""}`; }
  async function analyzeProject() {
    if (message.trim().length < 10) { setError(tr(locale, "Décrivez votre projet en quelques mots avant de lancer l’analyse.", "Describe your plans before starting the analysis.")); return; }
    setAssistantBusy(true); setError(""); setAssistantApplied(false);
    try {
      const response = await fetch("/api/quote-assistant/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale, message, checkIn: checkIn || null, checkOut: checkOut || null, people }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || tr(locale, "Analyse indisponible.", "Analysis unavailable."));
      setAssistantResult(data as QuoteAssistantResult);
    } catch (err) { setAssistantResult(null); setError(err instanceof Error ? err.message : tr(locale, "Analyse indisponible.", "Analysis unavailable.")); }
    finally { setAssistantBusy(false); }
  }
  function applyAssistantResult() {
    if (!assistantResult) return;
    const incoming = assistantResult.lines.map((line) => {
      const item = items.find((entry) => entry.id === line.catalogItemId);
      if (!item) return null;
      return { lineId: id(), property_id: item.id, quantity: line.quantity, order_dates: line.dates, order_time: line.orderTime, meal_types: line.mealTypes, parent_item_name: line.parentItemName } satisfies CartLine;
    }).filter(Boolean) as CartLine[];
    setCart((old) => {
      const next = [...old];
      for (const line of incoming) {
        const existingIndex = next.findIndex((current) => assistantLineKey(current) === assistantLineKey(line) && (items.find((entry) => entry.id === current.property_id)?.category === "restaurant" || current.property_id === line.property_id));
        if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + line.quantity };
        else next.push(line);
      }
      return next;
    });
    if (incoming[0]) setCategory(items.find((item) => item.id === incoming[0].property_id)?.category || category);
    setAssistantApplied(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!validDateRange(checkIn, checkOut)) { setError(tr(locale, "Sélectionnez des dates valides.", "Select valid dates.")); return; }
    if (!consent) { setError(tr(locale, "Veuillez accepter la politique de confidentialité.", "Please accept the privacy policy.")); return; }
    for (const { item, line } of cartItems) if (remaining[item.id] !== undefined && remaining[item.id] < line.quantity) { setError(tr(locale, `${item.nameFr} n'est pas disponible à ces dates.`, `${item.nameEn} is unavailable on these dates.`)); return; }
    setLoading(true);
    try {
      const kinds = [...new Set(cartItems.map(({ item }) => item.category))];
      const requestKind = kinds.length > 1 ? "mixed" : kinds[0] || category;
      const selectedItems = cartItems.map(({ line, item }) => ({ property_id: line.property_id, quantity: line.quantity, check_in: checkIn, check_out: checkOut, ...(item.category === "restaurant" ? { dates: line.order_dates?.length ? line.order_dates : [checkIn], order_dates: line.order_dates?.length ? line.order_dates : [checkIn], order_time: line.order_time || undefined, meal_types: line.meal_types?.length ? line.meal_types : ["dinner"], parent_item_name: line.parent_item_name || undefined } : {}) }));
      const response = await authFetch("/api/v1/quote-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestName: name, guestEmail: email, guestPhone: phone, company, locale, requestKind, selectedItems, checkIn, checkOut, people, message, budget: budget ? Number(budget) : null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur d'envoi.");
      saveQuoteContact({ name, email, phone, company }); clearQuoteDraft(); setResult(data); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError(err instanceof Error ? err.message : "Une erreur est survenue."); }
    finally { setLoading(false); }
  }

  if (result) return <main><section className="page-content"><div className="container"><div className="success-box"><div className="success-icon"><Check size={33}/></div><h1>{tr(locale, "Demande bien reçue !", "Request received!")}</h1><p>{tr(locale, "Notre équipe étudie votre projet avec attention. Un devis personnalisé en XAF TTC vous sera envoyé prochainement par e-mail.", "Our team is carefully reviewing your plans. A personalized quote in XAF, tax included, will be sent by email shortly.")}</p><div className="success-reference">{result.reference}</div><div className="success-actions"><a href={result.pdfUrl} className="btn btn-primary" target="_blank" rel="noopener noreferrer"><Download size={17}/>{tr(locale, "Télécharger l’accusé PDF", "Download PDF acknowledgment")}</a><Link href={`/devis/suivi?token=${result.token}`} className="btn btn-outline">{tr(locale, "Suivre mon devis", "Track my quote")}<ArrowRight size={16}/></Link></div></div></div></section></main>;

  return <main><section className="page-content"><div className="container"><div className="page-intro"><div className="eyebrow"><span className="eyebrow-line"/>{tr(locale, "DEMANDE DE DEVIS PERSONNALISÉ", "PERSONALIZED QUOTE REQUEST")}</div><h2>{tr(locale, "À chaque projet, ", "For every vision, ")}<em>{tr(locale, "sa proposition.", "a unique proposal.")}</em></h2><p>{tr(locale, "Composez votre demande parmi nos hébergements, salles, services et expériences. C’est sans engagement.", "Build your request from our rooms, venues, services and experiences. There's no obligation.")}</p></div><div className="form-layout quote-form-layout"><form onSubmit={submit}><div className="form-card"><div className="form-step"><b>01</b><span>{tr(locale, "VOTRE PROJET", "YOUR PLANS")}</span></div><h2>{tr(locale, "Qu’avez-vous imaginé ?", "What do you have in mind?")}</h2><p className="form-card-subtitle">{tr(locale, "Ajoutez autant de prestations que vous le souhaitez à votre demande.", "Add as many items as you like to your request.")}</p><div className="quote-category-tabs">{categories.map((cat) => <button type="button" key={cat.key} onClick={() => setCategory(cat.key)} className={`quote-category ${category === cat.key ? "active" : ""}`}><cat.icon size={17}/><span>{tr(locale, cat.fr, cat.en)}</span></button>)}</div><div className="quote-options">{shown.map((item) => { const added = cart.some((entry) => entry.property_id === item.id); const available = remaining[item.id]; return <div key={item.id} className={`quote-option ${added ? "selected" : ""}`}><img onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/palacio-hero.jpg"; }} src={item.image} alt={item.nameFr}/><div><strong>{locale === "en" ? item.nameEn : item.nameFr}</strong><small>{formatXaf(item.price, locale)} / {tr(locale, item.pricingUnit === "night" ? "nuit" : item.pricingUnit === "day" ? "jour" : "pers.", item.pricingUnit === "night" ? "night" : item.pricingUnit === "day" ? "day" : "person")}</small>{validDateRange(checkIn, checkOut) && <span className={`option-availability ${available === 0 ? "no" : ""}`}>{available === 0 ? tr(locale, "Complet", "Unavailable") : available !== undefined ? tr(locale, "Disponible", "Available") : ""}</span>}</div><button type="button" disabled={available === 0} onClick={() => add(item)} aria-label="Ajouter">{added ? <Plus size={16}/> : <Plus size={17}/>}</button></div>; })}</div>{category === "restaurant" && <div className="meal-choices"><span>{tr(locale, "REPAS SOUHAITÉS", "PREFERRED MEALS")}</span>{meals.map(([key, fr, en]) => <label key={key}><input type="checkbox" checked={mealTypes.includes(key)} onChange={() => toggleMeal(key)}/>{tr(locale, fr, en)}</label>)}<label className="field quote-inline-time"><span>{tr(locale, "HEURE", "TIME")}</span><input type="time" value={orderTime} onChange={(e) => setOrderTime(e.target.value)}/></label><label className="field quote-inline-parent"><span>{tr(locale, "POUR / PARENT", "FOR / PARENT")}</span><input value={parentItemName} onChange={(e) => setParentItemName(e.target.value)} placeholder={tr(locale, "Ex. groupe de conférence", "E.g. conference group")}/></label>{reservationDays.length ? <div className="quote-date-choices"><span>{tr(locale, "JOUR(S) DE COMMANDE", "ORDER DAY(S)")}</span>{reservationDays.map((date) => <label key={date}><input type="checkbox" checked={orderDates.includes(date)} onChange={() => toggleOrderDate(date)}/>{date}</label>)}</div> : <label className="field quote-inline-time"><span>{tr(locale, "DATE DE COMMANDE", "ORDER DATE")}</span><input type="date" min={today} value={orderDates[0] || ""} onChange={(e) => setOrderDates(e.target.value ? [e.target.value] : [])}/></label>}{activeRestaurantLine && <><button type="button" className="btn btn-outline quote-config-action" onClick={updateActiveRestaurantLine}>{tr(locale, "Mettre à jour la configuration", "Update configuration")}</button><button type="button" className="btn btn-outline quote-config-action" onClick={clearRestaurantStaging}>{tr(locale, "Autre jour / heure", "Another day / time")}</button></>}</div>}</div><div className="form-card"><div className="form-step"><b>02</b><span>{tr(locale, "DATES & PRÉFÉRENCES", "DATES & PREFERENCES")}</span></div><h2>{tr(locale, "Parlons des détails", "Let's talk details")}</h2><div className="form-grid"><label className="field"><span>{tr(locale, "DATE DE DÉBUT / ARRIVÉE", "START / CHECK-IN DATE")} *</span><input type="date" required min={today} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut && checkOut <= e.target.value) setCheckOut(""); }}/></label><label className="field"><span>{tr(locale, "DATE DE FIN / DÉPART", "END / CHECK-OUT DATE")} *</span><input type="date" required min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)}/></label><label className="field"><span>{tr(locale, "NOMBRE DE PERSONNES", "NUMBER OF GUESTS")} *</span><input type="number" required min={1} max={peopleMax > 0 ? peopleMax : 1000} value={people} onChange={(e) => setPeople(Math.min(peopleMax > 0 ? peopleMax : 1000, Number(e.target.value)))}/>{peopleMax > 0 && <small className="field-hint">{tr(locale, `Maximum ${peopleMax} avec les espaces sélectionnés.`, `Up to ${peopleMax} with the selected spaces.`)}</small>}</label><label className="field"><span>{tr(locale, "BUDGET INDICATIF XAF (OPTIONNEL)", "APPROX. BUDGET XAF (OPTIONAL)")}</span><input type="number" min={0} placeholder="Ex : 500000" value={budget} onChange={(e) => setBudget(e.target.value)}/></label><label className="field full"><span>{tr(locale, "RACONTEZ-NOUS VOTRE PROJET", "TELL US ABOUT YOUR PLANS")} *</span><textarea required minLength={10} maxLength={4000} value={message} onChange={(e) => { setMessage(e.target.value); setAssistantResult(null); setAssistantApplied(false); }} placeholder={tr(locale, "Occasion, préférences, besoins techniques, demandes spéciales... Plus vous nous en dites, mieux nous pourrons vous accompagner.", "Occasion, preferences, technical requests, special needs... Tell us as much as you can.")}/><div className="quote-assistant-actions"><button type="button" className="btn btn-outline" onClick={analyzeProject} disabled={assistantBusy}>{assistantBusy ? <Loader2 size={15} className="spin"/> : <Sparkles size={15}/>} {assistantBusy ? tr(locale, "Compréhension en cours...", "Understanding...") : tr(locale, "Comprendre mon projet", "Understand my project")}</button>{assistantApplied && <span className="assistant-success"><Check size={14}/>{tr(locale, "Proposition ajoutée à votre sélection", "Proposal added to your selection")}</span>}</div>{assistantResult && <div className="quote-assistant-result"><strong>{tr(locale, "Voici ce que nous avons compris", "Here is what we understood")}</strong><ul>{assistantResult.lines.map((line, index) => <li key={`${line.requestedLabel}-${index}`}>{line.quantity} × {line.requestedLabel}{line.dates?.length ? ` · ${line.dates.join(", ")}` : ""}{line.mealTypes?.length ? ` · ${line.mealTypes.join(" · ")}` : ""}{line.orderTime ? ` · ${line.orderTime}` : ""}</li>)}</ul>{assistantResult.questions.length > 0 && <div className="assistant-questions"><strong>{tr(locale, "À préciser", "Needs clarification")}</strong>{assistantResult.questions.map((question) => <p key={question}>{question}</p>)}</div>}{assistantResult.warnings.map((warning) => <p className="assistant-warning" key={warning}>{warning}</p>)}{assistantResult.canApply && <button type="button" className="btn btn-primary" onClick={applyAssistantResult} disabled={assistantApplied}>{tr(locale, assistantApplied ? "Proposition utilisée" : "Utiliser cette proposition", assistantApplied ? "Proposal used" : "Use this proposal")}</button>}</div>}</label></div></div><div className="form-card"><div className="form-step"><b>03</b><span>{tr(locale, "COMMENT VOUS RECONTACTER", "HOW TO REACH YOU")}</span></div><h2>{tr(locale, "Restons en contact", "Let's stay in touch")}</h2>{signedIn && me ? <div className="form-grid"><div className="account-welcome signed-contact-card"><div><span className="eyebrow"><span className="eyebrow-line"/>{tr(locale, "DEVIS À VOTRE NOM", "QUOTE UNDER YOUR NAME")}</span><h3><UserRound size={18}/>{me.fullName}</h3><p>{me.email}{me.phone ? ` · ${me.phone}` : ""}</p></div><Link className="btn btn-outline" href="/compte"><ShieldCheck size={15}/>{tr(locale, "Mon compte", "My account")}</Link></div><label className="field full"><span>{tr(locale, "ENTREPRISE / ORGANISATION (OPTIONNEL)", "COMPANY / ORGANIZATION (OPTIONAL)")}</span><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={tr(locale, "Nom de votre entreprise", "Your company name")}/></label></div> : <div className="form-grid"><label className="field full"><span>{tr(locale, "NOM COMPLET", "FULL NAME")} *</span><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr(locale, "Votre nom et prénom", "Your first and last name")}/></label><label className="field"><span>E-MAIL *</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com"/></label><label className="field"><span>{tr(locale, "TÉLÉPHONE", "PHONE")} *</span><input type="tel" required minLength={6} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6..."/></label><label className="field full"><span>{tr(locale, "ENTREPRISE / ORGANISATION (OPTIONNEL)", "COMPANY / ORGANIZATION (OPTIONAL)")}</span><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={tr(locale, "Nom de votre entreprise", "Your company name")}/></label></div>}<label className="consent-line"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}/><span>{tr(locale, "J’accepte l’utilisation de mes données pour le traitement de ma demande conformément à la ", "I agree to the use of my data to process your request under the ")}<Link href="/pages/confidentialite" target="_blank">{tr(locale, "politique de confidentialité", "privacy policy")}</Link>.</span></label>{error && <div className="notice notice-error" role="alert">{error}</div>}<button className="btn btn-primary form-submit" type="submit" disabled={loading}>{loading ? <Loader2 size={17} className="spin"/> : <Heart size={17}/>} {loading ? tr(locale, "Envoi en cours...", "Sending...") : tr(locale, "Envoyer ma demande de devis", "Send my quote request")}<ArrowRight size={16}/></button><p className="form-note">{tr(locale, "Gratuit et sans engagement. Notre équipe vous répondra personnellement.", "Free and with no obligation. Our team will reply personally.")}</p></div></form><aside><div className="summary-card"><span className="eyebrow eyebrow-light"><span className="eyebrow-line"/>{tr(locale, "VOTRE PROJET", "YOUR PLANS")}</span><h3 className="quote-summary-title">{tr(locale, "Votre sélection", "Your selection")}</h3>{cartItems.length ? <div className="cart-list">{cartItems.map(({ item, line }) => <div key={line.lineId} className="cart-line"><div className="cart-line-name"><strong>{locale === "en" ? item.nameEn : item.nameFr}</strong><button type="button" onClick={() => removeLine(line.lineId)} aria-label="Supprimer"><Trash2 size={14}/></button></div><span>{formatXaf(item.price, locale)} / {item.pricingUnit === "night" ? tr(locale, "nuit", "night") : item.pricingUnit === "day" ? tr(locale, "jour", "day") : tr(locale, "pers.", "person")}</span>{item.category === "restaurant" && <button type="button" className="quote-config-chip" onClick={() => loadRestaurantLine(line)}>{line.meal_types?.join(" · ") || tr(locale, "Configurer", "Configure")} {line.order_dates?.length ? ` · ${line.order_dates.join(", ")}` : ""}{line.order_time ? ` · ${line.order_time}` : ""}</button>}<div className="cart-quantity"><button type="button" onClick={() => changeQty(line.lineId, -1)}><Minus size={12}/></button><b>{line.quantity}</b><button type="button" onClick={() => changeQty(line.lineId, 1)}><Plus size={12}/></button></div><small className="cart-line-total">{formatXaf(quoteLineTotal(lineFor(item, line)), locale)}</small></div>)}</div> : <div className="cart-empty"><Sparkles size={28}/><p>{tr(locale, "Sélectionnez des prestations à gauche, ou décrivez simplement votre projet.", "Add items on the left, or simply describe what you have in mind.")}</p></div>}<div className="summary-row"><span>{tr(locale, "Dates", "Dates")}</span><strong>{checkIn && checkOut ? `${checkIn} → ${checkOut}` : "—"}</strong></div><div className="summary-row"><span>{tr(locale, "Personnes", "Guests")}</span><strong>{people}</strong></div><div className="summary-total"><span>{tr(locale, "Estimation indicative", "Indicative estimate")}</span><strong>{cartItems.length ? formatXaf(estimate, locale) : "—"}</strong></div><p className="summary-caption">{tr(locale, "Ce calcul est indicatif. Le montant global final en XAF TTC sera défini par notre équipe et envoyé dans votre devis PDF. Aucun paiement à cette étape.", "This is only an estimate. Our team will set the final total in XAF incl. tax and email your PDF quote. No payment is due now.")}</p></div><div className="summary-help"><strong>{tr(locale, "Besoin d’un conseil ?", "Need a little help?")}</strong><p>{tr(locale, "Notre équipe est aussi disponible sur WhatsApp pour imaginer votre projet avec vous.", "Our team is also available on WhatsApp to help plan your project.")}</p><a href={whatsappUrl(settings.whatsapp, tr(locale, "Bonjour Palacio Hotel, j'aimerais demander un devis personnalisé.", "Hello Palacio Hotel, I'd like a tailored quote."))} target="_blank" rel="noopener noreferrer"><MessageCircle size={17}/>{tr(locale, "Échanger sur WhatsApp", "Chat on WhatsApp")}<ArrowUpRight size={16}/></a></div></aside></div></div></section></main>;
}
