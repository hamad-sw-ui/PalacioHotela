export function countryAccepted(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 || (trimmed.length >= 2 && trimmed.length <= 120);
}
