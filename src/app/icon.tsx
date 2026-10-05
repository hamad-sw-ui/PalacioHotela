import { quoteTabIconResponse } from "@/lib/quote-tab-icon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const contentType = "image/png";

export default function Icon() {
  return quoteTabIconResponse();
}
