"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Download, FileText, Loader2, X } from "lucide-react";
import { SignaturePad } from "@/components/signature-pad";
import { formatXaf } from "@/lib/format";

type QuoteLine = { name_fr: string; name_en: string; quantity: number };
type Quote = {
  reference: string;
  guestName: string;
  requestKind: string;
  status: string;
  amountTtc: number | null;
  validUntil: string | null;
  createdAt: string;
  selectedItems: QuoteLine[];
  pdfTemplateVersion?: number;
  clientSignatureUrl?: string | null;
  clientSignerName?: string | null;
};

const statusLabels: Record<string, [string, string]> = {
  new: ["Demande reçue", "Request received"],
  in_review: ["En cours d’étude", "Under review"],
  quote_sent: ["Devis envoyé", "Quote sent"],
  negotiating: ["En discussion", "In discussion"],
  accepted: ["Devis accepté", "Quote accepted"],
  rejected: ["Devis refusé", "Quote declined"],
  expired: ["Devis expiré", "Quote expired"],
  cancelled: ["Demande annulée", "Request cancelled"],
};

export function AdminQuoteWindow({ token, reference, locale, onClose }: { token: string; reference: string; locale: "fr" | "en"; onClose: () => void }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const L = (fr: string, en: string) => locale === "en" ? en : fr;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/quotes/${token}`).then((response) => response.json()).then((data) => {
      if (cancelled) return;
      if (data.quote) { setQuote(data.quote); setSignerName(data.quote.clientSignerName || data.quote.guestName || ""); }
      else setError(data.error || L("Devis introuvable.", "Quote not found."));
    }).catch(() => { if (!cancelled) setError(L("Impossible de charger ce devis.", "Unable to load this quote.")); });
    return () => { cancelled = true; };
  }, [token, locale]);

  const ready = Boolean(quote && ["quote_sent", "negotiating", "accepted", "rejected", "expired"].includes(quote.status) && quote.amountTtc != null);
  const canSign = Boolean(quote && ["quote_sent", "negotiating"].includes(quote.status) && !quote.clientSignatureUrl);
  async function saveSignature() {
    if (!signature || signerName.trim().length < 2) { setError(L("Dessinez votre signature et indiquez votre nom.", "Draw your signature and enter your name.")); return; }
    setSigning(true); setError("");
    try {
      const response = await fetch(`/api/quotes/${token}/signature`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature, signerName }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || L("Signature impossible.", "Unable to save the signature."));
      setQuote((current) => current ? { ...current, clientSignatureUrl: data.signatureUrl, clientSignerName: data.signerName } : current);
      setSignature(null);
    } catch (err) { setError(err instanceof Error ? err.message : L("Signature impossible.", "Unable to save the signature.")); }
    finally { setSigning(false); }
  }
  const label = quote ? L(...(statusLabels[quote.status] || [quote.status, quote.status])) : "";

  return (
    <div className="admin-modal-backdrop admin-client-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="admin-modal admin-client-window" role="dialog" aria-modal="true" aria-label={L("Page client", "Client page")}>
        <div className="admin-modal-header">
          <div>
            <span>{L("PAGE CLIENT", "CLIENT PAGE")}</span>
            <h2>{quote?.reference || reference || L("Suivi du devis", "Quote tracking")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={L("Fermer", "Close")}><X size={20}/></button>
        </div>
        <div className="admin-client-copy">
          {!quote && !error && <div className="loading-center"><Loader2 className="spin" size={28}/></div>}
          {error && <p className="notice notice-error">{error}</p>}
          {quote && (
            <>
              <p>{L(`Bonjour ${quote.guestName}`, `Hello ${quote.guestName}`)}</p>
              <div className="tracking-status">
                <span className={`status-pill ${quote.status}`}>{label}</span>
                <span><Clock3 size={15}/>{new Date(quote.createdAt).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR")}</span>
              </div>
              <div className="track-steps">
                <div className="track-step done"><span><Check size={16}/></span><div><strong>{L("Demande reçue", "Request received")}</strong></div></div>
                <div className={`track-step ${quote.status !== "new" ? "done" : ""}`}><span>{quote.status !== "new" ? <Check size={16}/> : "2"}</span><div><strong>{L("Étude personnalisée", "Personalized review")}</strong></div></div>
                <div className={`track-step ${ready ? "done" : ""}`}><span>{ready ? <Check size={16}/> : "3"}</span><div><strong>{L("Votre devis est prêt", "Your quote is ready")}</strong></div></div>
              </div>
              <div className="summary-card">
                <h3>{L("Votre demande", "Your request")}</h3>
                <div className="summary-row"><span>{L("Type", "Type")}</span><strong>{quote.requestKind.replaceAll("_", " ")}</strong></div>
                {quote.selectedItems.map((item, index) => <div className="summary-row" key={index}><span>{L("Élément", "Item")}</span><strong>{locale === "en" ? item.name_en : item.name_fr} × {item.quantity}</strong></div>)}
                {ready && <div className="summary-row"><span>{L("Montant", "Amount")}</span><strong>{formatXaf(quote.amountTtc || 0, locale)} TTC</strong></div>}
                {quote.validUntil && <div className="summary-row"><span>{L("Validité", "Valid until")}</span><strong>{quote.validUntil}</strong></div>}
              </div>
              {quote.clientSignatureUrl && <p className="signature-status"><Check size={15}/> {L(`Signature numérique de ${quote.clientSignerName || quote.guestName} enregistrée.`, `Digital signature from ${quote.clientSignerName || quote.guestName} saved.`)}</p>}
              {canSign && <div className="signature-pad-block"><h3>{L("Signature numérique", "Digital signature")}</h3><label className="field"><span>{L("NOM DU SIGNATAIRE", "SIGNATORY NAME")}</span><input value={signerName} onChange={(event) => setSignerName(event.target.value)} maxLength={180}/></label><SignaturePad onChange={setSignature} clearLabel={L("Effacer", "Clear")}/><button type="button" className="btn btn-primary" disabled={signing} onClick={saveSignature}>{signing ? <Loader2 className="spin" size={16}/> : <Check size={16}/>} {L("Enregistrer la signature", "Save signature")}</button></div>}
              <div className="admin-client-files">
                <a href={`/api/quotes/${token}/pdf?kind=receipt`} target="_blank" rel="noopener noreferrer"><Download size={15}/>{L("Accusé de réception", "Acknowledgment")}</a>
                {ready && <a href={`/api/quotes/${token}/pdf?kind=quote`} target="_blank" rel="noopener noreferrer"><FileText size={15}/>{L("Devis PDF", "PDF quote")}</a>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
