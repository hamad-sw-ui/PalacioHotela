/**
 * Browser-side half of the session: keeps the signed token returned at sign-in and sends it
 * as `Authorization: Bearer`. This keeps accounts and the backoffice working even when the
 * browser refuses cookies, for instance when the site is shown inside another site's iframe.
 */
const STORAGE_KEY = "palacio_session_token";
let memoryToken = "";

export function getSessionToken() {
  if (memoryToken || typeof window === "undefined") return memoryToken;
  try { return window.localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
}

export function setSessionToken(token: string | null | undefined) {
  memoryToken = token || "";
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in sandboxed frames: the in-memory token still works for this visit.
  }
}

/** `fetch` that authenticates with the stored token and silently discards it once it expires. */
export async function authFetch(input: string, init: RequestInit = {}) {
  const token = getSessionToken();
  const send = (withToken: boolean) => {
    const headers = new Headers(init.headers);
    if (withToken && token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers, credentials: "same-origin" });
  };
  const response = await send(true);
  if (response.status === 401 && token) {
    setSessionToken(null);
    return send(false); // A still-valid session cookie may authenticate the request.
  }
  return response;
}
