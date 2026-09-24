export type ImageBox = { x: number; y: number; width: number; height: number };

/** Fit an image inside a fixed box, centered, without cropping or stretching. Pixel size never changes the box. */
export function containInBox(image: { width: number; height: number }, box: ImageBox): ImageBox {
  const scale = Math.min(box.width / Math.max(image.width, 1), box.height / Math.max(image.height, 1));
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}
