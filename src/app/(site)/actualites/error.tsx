"use client";

import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function NewsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="news-journal news-error">
    <section className="container">
      <AlertCircle size={28} aria-hidden="true"/>
      <p className="news-kicker">PALACIO HOTEL · ACTUALITÉS / NEWS</p>
      <h1>Ce journal est momentanément indisponible.</h1>
      <p>Impossible de charger les actualités pour le moment. Veuillez réessayer ou nous contacter. / News are temporarily unavailable. Please try again or contact us.</p>
      <div><button className="btn btn-primary" onClick={reset}><RefreshCw size={15}/>Réessayer / Try again</button><Link className="news-back-link" href="/contact">Contact</Link></div>
    </section>
  </main>;
}
