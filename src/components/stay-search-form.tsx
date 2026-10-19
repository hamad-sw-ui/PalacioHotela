"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Minus, Plus } from "lucide-react";
import { tr, useSite } from "@/components/site-shell";
import { availabilityHref } from "@/lib/availability-search";
import { validDateRange } from "@/lib/format";

export function StaySearchForm({ initial }: { initial?: { checkIn?: string; checkOut?: string; guests?: number } }) {
  const { locale } = useSite();
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(initial?.checkIn || "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut || "");
  const [guests, setGuests] = useState(Math.min(500, Math.max(1, initial?.guests || 2)));
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    setCheckIn(initial?.checkIn || "");
    setCheckOut(initial?.checkOut || "");
    setGuests(Math.min(500, Math.max(1, initial?.guests || 2)));
  }, [initial?.checkIn, initial?.checkOut, initial?.guests]);

  function search(event: FormEvent) {
    event.preventDefault();
    if (!checkIn || !checkOut) {
      setError(tr(locale, "Indiquez une date d’arrivée et une date de départ.", "Enter a check-in and a check-out date."));
      return;
    }
    if (!validDateRange(checkIn, checkOut)) {
      setError(tr(locale, "Le départ doit suivre l’arrivée, dans les 365 prochains jours.", "Check-out must follow check-in, within the next 365 days."));
      return;
    }
    setError("");
    router.push(availabilityHref({ checkIn, checkOut, guests }));
  }

  return <>
    <form className="search-panel" onSubmit={search}>
      <div className="search-heading"><span className="search-heading-icon"><CalendarDays size={21}/></span><div><span className="search-heading-small">{tr(locale, "ORGANISEZ VOTRE ESCAPADE", "PLAN YOUR GETAWAY")}</span><strong>{tr(locale, "Votre séjour commence ici", "Your stay starts here")}</strong></div></div>
      <label className="search-field"><span>{tr(locale, "ARRIVÉE", "CHECK IN")}</span><input type="date" required min={today} value={checkIn} onChange={(e) => { setError(""); setCheckIn(e.target.value); if (checkOut && checkOut <= e.target.value) setCheckOut(""); }}/></label>
      <label className="search-field"><span>{tr(locale, "DÉPART", "CHECK OUT")}</span><input type="date" required min={checkIn || today} value={checkOut} onChange={(e) => { setError(""); setCheckOut(e.target.value); }}/></label>
      <div className="search-guests"><span>{tr(locale, "CLIENTS", "GUESTS")}</span><div><button type="button" onClick={() => setGuests(Math.max(1, guests - 1))} aria-label="Moins"><Minus size={13}/></button><strong>{guests} {tr(locale, "pers.", "guests")}</strong><button type="button" onClick={() => setGuests(Math.min(500, guests + 1))} aria-label="Plus"><Plus size={13}/></button></div></div>
      <button className="btn btn-primary search-submit" type="submit">{tr(locale, "Voir les disponibilités", "Check availability")}<ArrowRight size={17}/></button>
    </form>
    {error && <p className="search-error" role="alert">{error}</p>}
  </>;
}
