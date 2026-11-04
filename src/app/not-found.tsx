import Link from "next/link";

// Rendu dynamique obligatoire : le layout racine lit les réglages en base
// (getSettings), ce qui n'est pas possible au moment du build sans connexion.
// Sans cette directive, le prérendu de /_not-found échoue pendant next build.
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="nf-main">
      <div className="nf-card">
        <p className="nf-code">404</p>
        <h1 className="nf-title">Page introuvable</h1>
        <p className="nf-sub">Page not found</p>
        <Link href="/" className="nf-link">Retour à l&apos;accueil</Link>
      </div>
    </main>
  );
}
