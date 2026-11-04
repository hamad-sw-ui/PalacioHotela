import type { HotelSettings } from "@/db/schema";

/**
 * Display fallbacks for the editable location copy. They mirror the shipped
 * defaults so an empty or legacy settings row renders exactly as before.
 */
export const LOCATION_FALLBACKS = {
  cityFr: "Douala",
  cityEn: "Douala",
  countryFr: "Cameroun",
  countryEn: "Cameroon",
  taglineFr: "Votre parenthèse d'exception à Douala",
  taglineEn: "Your exceptional escape in Douala",
  footerBaselineFr: "Une adresse singulière, des instants inoubliables. Bienvenue chez vous, à Douala.",
  footerBaselineEn: "An extraordinary address, unforgettable moments. Welcome home in Douala.",
} as const;

export const DEFAULT_ADDRESS_FR = "Bonanjo, Douala, Cameroun";
export const DEFAULT_ADDRESS_EN = "Bonanjo, Douala, Cameroon";
export const DEFAULT_TIME_ZONE = "Africa/Douala";
export const DEFAULT_HERO_SUBTITLE_FR = "Au cœur de Douala, découvrez une adresse où l’élégance rencontre la chaleur de l’hospitalité.";
export const DEFAULT_HERO_SUBTITLE_EN = "In the heart of Douala, discover a place where elegance meets the warmth of hospitality.";

const trimmed = (value: string | null | undefined) => {
  const text = String(value ?? "").trim();
  return text ? text : "";
};

export function hotelCity(settings: HotelSettings, locale: "fr" | "en") {
  return trimmed(locale === "en" ? settings.cityEn : settings.cityFr) || (locale === "en" ? LOCATION_FALLBACKS.cityEn : LOCATION_FALLBACKS.cityFr);
}

export function hotelCountry(settings: HotelSettings, locale: "fr" | "en") {
  return trimmed(locale === "en" ? settings.countryEn : settings.countryFr) || (locale === "en" ? LOCATION_FALLBACKS.countryEn : LOCATION_FALLBACKS.countryFr);
}

export function hotelTagline(settings: HotelSettings, locale: "fr" | "en") {
  return trimmed(locale === "en" ? settings.taglineEn : settings.taglineFr) || (locale === "en" ? LOCATION_FALLBACKS.taglineEn : LOCATION_FALLBACKS.taglineFr);
}

export function hotelFooterBaseline(settings: HotelSettings, locale: "fr" | "en") {
  return trimmed(locale === "en" ? settings.footerBaselineEn : settings.footerBaselineFr) || (locale === "en" ? LOCATION_FALLBACKS.footerBaselineEn : LOCATION_FALLBACKS.footerBaselineFr);
}
