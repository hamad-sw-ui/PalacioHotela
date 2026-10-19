/**
 * Central resolution of site-wide imagery.
 * Every image on the platform can be replaced from the back-office (upload or URL).
 * When a setting is empty, the original built-in artwork is used unchanged,
 * so a fresh install looks exactly like before (zero regression by design).
 */
export function siteImage(value: string | null | undefined, fallback: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed || fallback;
}
