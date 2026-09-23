import type { HotelSettings } from "@/db/schema";

export function hotelMapUrl(settings: Pick<HotelSettings, "latitude" | "longitude">) {
  return `https://www.google.com/maps/search/?api=1&query=${settings.latitude},${settings.longitude}`;
}

export function hotelPhoneUrl(settings: Pick<HotelSettings, "phone">) {
  return `tel:${settings.phone.replace(/[^+\d]/g, "")}`;
}

export function hotelEmailUrl(settings: Pick<HotelSettings, "email">) {
  return `mailto:${settings.email}`;
}

export function hotelMapEmbedUrl(settings: Pick<HotelSettings, "latitude" | "longitude">) {
  const { latitude, longitude } = settings;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.014}%2C${latitude - 0.01}%2C${longitude + 0.014}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}
