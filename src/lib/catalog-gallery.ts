export const GALLERY_LIMIT = 8;

export function isGalleryUrl(value: string) {
  return value.startsWith("/") || value.startsWith("https://");
}

/** Cover first, then extra photos, without duplicates. */
export function itemSlides(item: { image?: string | null; images?: string[] | null }) {
  const cover = (item.image || "").trim();
  const extras = Array.isArray(item.images) ? item.images : [];
  const slides: string[] = [];
  for (const raw of [cover, ...extras]) {
    const url = String(raw || "").trim();
    if (!isGalleryUrl(url) || slides.includes(url)) continue;
    slides.push(url);
    if (slides.length >= GALLERY_LIMIT) break;
  }
  return slides;
}

export function extraPhotos(images: string[]) {
  return [...new Set(images.map((url) => url.trim()).filter(isGalleryUrl))].slice(0, GALLERY_LIMIT - 1);
}

/** The cover stays the card and mail photo. Extras never replace it unless it is empty. */
export function alignCatalogGallery(image: string, images: string[]) {
  const unique = [...new Set(images.map((url) => url.trim()).filter(isGalleryUrl))];
  let cover = image.trim();
  if (!isGalleryUrl(cover)) cover = unique.shift() || "";
  return { image: cover, images: unique.filter((url) => url !== cover).slice(0, GALLERY_LIMIT - 1) };
}
