/** Only the pages that start a booking or a quote may be resumed after sign-in. */
export function returnAfterSignIn(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "";
  const path = next.split("?")[0];
  if (path === "/reservation" || path === "/devis" || path.startsWith("/hebergements/")) return next;
  return "";
}

export function signInHref(next: string) {
  const safe = returnAfterSignIn(next);
  return safe ? `/compte?next=${encodeURIComponent(safe)}` : "/compte";
}

export function memberHref(signedIn: boolean, href: string) {
  return signedIn ? href : signInHref(href);
}
