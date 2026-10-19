"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, Download, Loader2, Users, X } from "lucide-react";
import { formatXaf } from "@/lib/format";

type BookingView = {
  reference: string;
  itemName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  quantity: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  locale?: string;
};

const statusLabels: Record<string, [string, string]> = {
  pending: ["En attente de confirmation", "Awaiting confirmation"],
  confirmed: ["Réservation confirmée", "Booking confirmed"],
  cancelled: ["Annulée", "Cancelled"],
  checked_in: ["Séjour en cours", "Stay in progress"],
  checked_out: ["Séjour terminé", "Stay completed"],
};

const paymentLabels: Record<string, [string, string]> = {
  unpaid: ["Non payé", "Unpaid"],
  awaiting_payment: ["En attente de paiement", "Awaiting payment"],
  pay_on_site: ["Payable sur place", "Pay at hotel"],
  paid: ["Payé", "Paid"],
  refunded: ["Remboursé", "Refunded"],
};

export function AdminBookingWindow({ token, reference, locale, onClose }: { token: string; reference: string; locale: "fr" | "en"; onClose: () => void }) {
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [error, setError] = useState("");
  const localeIsEn = locale === "en";
  const L = (fr: string, en: string) => locale === "en" ? en : fr;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings/${token}`).then((response) => response.json()).then((data) => {
      if (cancelled) return;
      if (data.booking) setBooking(data.booking);
      else setError(data.error || (localeIsEn ? "Booking not found." : "Réservation introuvable."));
    }).catch(() => { if (!cancelled) setError(localeIsEn ? "Unable to load this booking." : "Impossible de charger cette réservation."); });
    return () => { cancelled = true; };
  }, [token, localeIsEn]);

  const confirmed = Boolean(booking && ["confirmed", "checked_in", "checked_out"].includes(booking.status));

  return (
    <div className="admin-modal-backdrop admin-client-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="admin-modal admin-client-window" role="dialog" aria-modal="true" aria-label={L("Page client", "Client page")}>
        <div className="admin-modal-header">
          <div>
            <span>{L("PAGE CLIENT", "CLIENT PAGE")}</span>
            <h2>{booking?.reference || reference || L("Suivi de la réservation", "Booking tracking")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={L("Fermer", "Close")}><X size={20}/></button>
        </div>
        <div className="admin-client-copy">
          {!booking && !error && <div className="loading-center"><Loader2 className="spin" size={28}/></div>}
          {error && <p className="notice notice-error">{error}</p>}
          {booking && (
            <>
              <p>{L(`Bonjour ${booking.guestName}`, `Hello ${booking.guestName}`)}</p>
              <div className="tracking-status">
                <span className={`status-pill ${booking.status}`}>{L(...(statusLabels[booking.status] || [booking.status, booking.status]))}</span>
              </div>
              <div className="track-steps">
                <div className="track-step done"><span><Check size={16}/></span><div><strong>{L("Demande enregistrée", "Request received")}</strong></div></div>
                <div className={`track-step ${confirmed ? "done" : ""}`}><span>{confirmed ? <Check size={16}/> : "2"}</span><div><strong>{L("Confirmation de l'hôtel", "Hotel confirmation")}</strong></div></div>
                <div className={`track-step ${booking.status === "checked_out" ? "done" : ""}`}><span>{booking.status === "checked_out" ? <Check size={16}/> : "3"}</span><div><strong>{L("Séjour", "Stay")}</strong></div></div>
              </div>
              <div className="summary-card">
                <h3>{L("Votre réservation", "Your booking")}</h3>
                <div className="summary-row"><span>{L("Prestation", "Item")}</span><strong>{booking.itemName}</strong></div>
                <div className="summary-row"><span><CalendarDays size={13}/></span><strong>{booking.checkIn} → {booking.checkOut}</strong></div>
                <div className="summary-row"><span><Users size={13}/></span><strong>{booking.guests} {L("personne(s)", "guest(s)")}{booking.quantity > 1 ? ` · ×${booking.quantity}` : ""}</strong></div>
                <div className="summary-row"><span>{L("Montant", "Amount")}</span><strong>{formatXaf(booking.total, locale)} TTC</strong></div>
                <div className="summary-row"><span>{L("Paiement", "Payment")}</span><strong>{L(...(paymentLabels[booking.paymentStatus] || [booking.paymentStatus, booking.paymentStatus]))}</strong></div>
              </div>
              <div className="admin-client-files">
                <a href={`/api/bookings/${token}/pdf`} target="_blank" rel="noopener noreferrer"><Download size={15}/>{L("Confirmation PDF", "PDF confirmation")}</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
