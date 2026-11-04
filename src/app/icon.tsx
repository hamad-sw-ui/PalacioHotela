import { quoteTabIconResponse } from "@/lib/quote-tab-icon";

export const runtime = "nodejs";
// Settings are tag-cached and the response carries Cache-Control: max-age=300,
// so the icon renders from cache instead of on every request.
export const revalidate = 300;
export const contentType = "image/png";

export default function Icon() {
  return quoteTabIconResponse();
}
