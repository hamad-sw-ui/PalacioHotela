export function coordinateValue(raw: unknown, min: number, max: number) {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function formatAxis(value: number, positive: string, negative: string) {
  const direction = value < 0 ? negative : positive;
  const absolute = Math.abs(value);
  let degrees = Math.floor(absolute + 1e-8);
  let minutes = Math.round((absolute - degrees) * 60);
  if (minutes === 60) { degrees += 1; minutes = 0; }
  return `${String(degrees).padStart(2, "0")}°${String(minutes).padStart(2, "0")}′ ${direction}`;
}

export function formatHotelPosition(latitude: number, longitude: number) {
  return `${formatAxis(latitude, "N", "S")}\u00a0\u00a0${formatAxis(longitude, "E", "W")}`;
}

export function geocodeAddress(addressFr: unknown, addressEn: unknown) {
  const french = String(addressFr ?? "").trim();
  if (french) return french.slice(0, 500);
  const english = String(addressEn ?? "").trim();
  return english ? english.slice(0, 500) : null;
}

export function nominatimPoint(payload: unknown) {
  if (!Array.isArray(payload) || !payload[0] || typeof payload[0] !== "object") return null;
  const row = payload[0] as { lat?: unknown; lon?: unknown };
  const latitude = coordinateValue(row.lat, -90, 90);
  const longitude = coordinateValue(row.lon, -180, 180);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

export function formatCoordinate(value: number) {
  return value.toFixed(6);
}
