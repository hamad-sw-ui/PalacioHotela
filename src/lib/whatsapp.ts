export function whatsappDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidWhatsAppNumber(value: string) {
  if (!/^\+?[\d\s().-]+$/.test(value.trim())) return false;
  return /^[1-9]\d{7,14}$/.test(whatsappDigits(value));
}

export function whatsappUrl(number: string, text: string) {
  return `https://wa.me/${whatsappDigits(number)}?text=${encodeURIComponent(text)}`;
}