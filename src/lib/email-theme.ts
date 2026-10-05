import { mergePalette } from "@/lib/quote-pdf-theme";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);

function isPublicHttp(src: string) {
  try {
    const url = new URL(src);
    if (!/^https?:$/i.test(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && !host.endsWith(".local");
  } catch { return false; }
}

export function emailPalette(theme: string, custom?: unknown) {
  const palette = mergePalette(theme, custom);
  return { deep: palette.primary, accent: palette.accent, page: palette.paper, soft: palette.soft, text: palette.ink, muted: palette.muted, footer: palette.footer, white: palette.white };
}

export function emailLogoAddress(logoUrl: string | null | undefined, origin?: string | null) {
  const value = String(logoUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") && origin) return `${origin.replace(/\/$/, "")}${value}`;
  return "";
}

export function emailLogoDelivery(logoUrl: string | null | undefined, origin?: string | null) {
  const absolute = emailLogoAddress(logoUrl, origin);
  return isPublicHttp(absolute) ? absolute : "";
}

function renderableLogo(logoUrl?: string | null) {
  return isPublicHttp(String(logoUrl || "").trim()) ? String(logoUrl).trim() : "";
}

export function themedEmailHtml(theme: string, parts: { eyebrow: string; title: string; greeting: string; body: string; detail: string; footer: string; hotelName: string; address: string; phone: string; email: string }, custom?: unknown, logoUrl?: string | null) {
  const palette = emailPalette(theme, custom);
  const logo = renderableLogo(logoUrl);
  const brand = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(parts.hotelName)}" height="48" style="display:block;height:48px;width:auto;max-width:180px;border:0"/>`
    : `<div style="font-family:Georgia,serif;font-size:28px;letter-spacing:3px">PALACIO</div><div style="font-size:10px;letter-spacing:5px;color:${palette.accent};margin-top:3px">H O T E L</div>`;
  return `<!doctype html><html><body style="margin:0;background:${palette.page};font-family:Arial,Helvetica,sans-serif;color:${palette.text}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${palette.white};border-radius:4px;overflow:hidden"><tr><td style="background:${palette.deep};padding:32px 44px;color:${palette.white}">${brand}</td></tr><tr><td style="padding:42px 44px"><div style="color:${palette.accent};font-size:11px;letter-spacing:2px;font-weight:bold;text-transform:uppercase">${escapeHtml(parts.eyebrow)}</div><h1 style="font-family:Georgia,serif;font-weight:normal;font-size:30px;line-height:1.2;margin:14px 0 22px;color:${palette.text}">${escapeHtml(parts.title)}</h1><p style="font-size:15px;line-height:1.8;margin:0 0 16px">${escapeHtml(parts.greeting)}</p><p style="font-size:15px;line-height:1.8;color:${palette.muted};margin:0 0 22px">${escapeHtml(parts.body)}</p><div style="background:${palette.soft};border-left:3px solid ${palette.accent};padding:18px 22px;font-size:14px;line-height:1.9;color:${palette.text}">${parts.detail}</div><p style="font-size:14px;line-height:1.8;color:${palette.muted};margin-top:24px">${escapeHtml(parts.footer)}</p></td></tr><tr><td style="background:${palette.footer};padding:23px 44px;color:${palette.muted};font-size:12px;line-height:1.7">${escapeHtml(parts.hotelName)} · ${escapeHtml(parts.address)}<br>${escapeHtml(parts.phone)} · ${escapeHtml(parts.email)}</td></tr></table></td></tr></table></body></html>`;
}
