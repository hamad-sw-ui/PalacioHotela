import type { HotelSettings, QuoteRequest } from "@/db/schema";
import { formatQuoteLineDates, formatQuoteLineMeals } from "@/lib/quote-line-display";
import { lineMealUnits, lineUnits, quoteLineTotal, quoteTotal } from "@/lib/quote-pricing";
import { getQuotePdfPalette } from "@/lib/quote-pdf-theme";

export function buildQuoteDocumentModel(
  quote: QuoteRequest,
  settings: HotelSettings,
  kind: "receipt" | "quote",
) {
  const locale = quote.locale === "en" ? "en" : "fr";
  const isEn = locale === "en";
  const lines = (quote.selectedItems || []).map((item) => ({
    item,
    name: isEn ? item.name_en : item.name_fr,
    description: isEn ? item.description_en : item.description_fr,
    dates: formatQuoteLineDates(item, locale),
    meals: item.type === "restaurant" ? formatQuoteLineMeals(item.meal_types, locale) : "",
    parent: item.parent_item_name ? `${isEn ? "For" : "Pour"} ${item.parent_item_name}` : "",
    quantity: item.quantity,
    units: lineUnits(item),
    mealUnits: lineMealUnits(item),
    total: quoteLineTotal(item),
  }));
  const calculatedTotal = quoteTotal(quote.selectedItems || []);

  return {
    kind,
    locale,
    isEn,
    palette: getQuotePdfPalette(settings.theme),
    hotel: {
      name: settings.hotelName,
      logo: settings.logoUrl,
      address: isEn ? settings.addressEn : settings.addressFr,
      phone: settings.phone,
      email: settings.email,
    },
    reference: quote.reference || `DEV-${quote.id}`,
    createdAt: quote.createdAt,
    client: {
      name: quote.guestName,
      company: quote.company || "",
      email: quote.guestEmail,
      phone: quote.guestPhone,
    },
    project: {
      kind: quote.requestKind,
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      people: quote.people,
      message: quote.message,
      budget: quote.budget,
    },
    lines,
    calculatedTotal,
    total: quote.amountTtc && quote.amountTtc > 0 ? quote.amountTtc : quote.estimatedTotal ?? calculatedTotal,
    amountTtc: quote.amountTtc,
    validUntil: quote.validUntil,
    terms: isEn ? quote.termsSnapshotEn || settings.quoteTermsEn : quote.termsSnapshotFr || settings.quoteTermsFr,
    adminNotes: quote.adminNotes,
    signatures: {
      clientName: quote.clientSignerName,
      clientSignedAt: quote.clientSignedAt,
      adminName: quote.adminSignerName || settings.quoteSignerName || settings.hotelName,
      adminRole: quote.adminSignerRole || settings.quoteSignerRole,
      adminSignedAt: quote.adminSignedAt,
    },
  };
}
