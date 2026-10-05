const HERE_KEY = "palacio_here_path";
const PREV_KEY = "palacio_prev_path";

/** Only in-app public pages may be used as a back target. */
export function safeInternalPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "";
  const path = value.split("#")[0];
  if (!path || path.startsWith("/api") || path.startsWith("/admin")) return "";
  return path;
}

export function rememberSitePath(here: string) {
  if (typeof window === "undefined") return;
  const safe = safeInternalPath(here);
  if (!safe) return;
  const current = safeInternalPath(sessionStorage.getItem(HERE_KEY));
  if (current && current !== safe) sessionStorage.setItem(PREV_KEY, current);
  sessionStorage.setItem(HERE_KEY, safe);
}

export function previousSitePath(here: string) {
  if (typeof window === "undefined") return "";
  const prev = safeInternalPath(sessionStorage.getItem(PREV_KEY));
  const now = safeInternalPath(here) || here;
  return prev && prev !== now ? prev : "";
}

/** Hubs already have the main nav; a back button there would only add noise. */
export function needsPageBack(pathname: string) {
  return pathname !== "/" && pathname !== "/hebergements";
}

export function pageBackFallback(pathname: string, search = "", member = false) {
  if (!needsPageBack(pathname)) return "";
  if (pathname.startsWith("/hebergements/")) return "/hebergements";
  if (pathname === "/devis/suivi") return member ? "/compte" : "/devis";
  if (pathname === "/reservation/confirmation") return member ? "/compte" : "/";
  if (pathname === "/devis" || pathname === "/reservation") {
    return new URLSearchParams(search).get("itemId") ? "/hebergements" : "/";
  }
  return "/";
}

export function pageBackHref(pathname: string, search = "", member = false) {
  const here = search ? `${pathname}?${search}` : pathname;
  return previousSitePath(here) || pageBackFallback(pathname, search, member);
}

/** Prefer the last in-app page; otherwise the safe parent. Never leaves the site. */
export function pageBackTarget(pathname: string, search = "", member = false, previous = "") {
  const fallback = pageBackFallback(pathname, search, member);
  if (!fallback) return "";
  const here = search ? `${pathname}?${search}` : pathname;
  const prev = safeInternalPath(previous);
  return prev && prev !== safeInternalPath(here) ? prev : fallback;
}
