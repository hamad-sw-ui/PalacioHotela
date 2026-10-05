import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alignCatalogGallery, extraPhotos, itemSlides } from "../src/lib/catalog-gallery";

describe("itemSlides", () => {
  it("met la couverture en premier puis les photos supplémentaires, sans doublon", () => {
    const slides = itemSlides({ image: "/cover.jpg", images: ["/extra-a.jpg", "/cover.jpg", "ftp://nope", "/extra-b.jpg"] });
    assert.deepEqual(slides, ["/cover.jpg", "/extra-a.jpg", "/extra-b.jpg"]);
  });

  it("ignore une couverture vide et s’arrête à huit photos", () => {
    const images = Array.from({ length: 10 }, (_, index) => `/photo-${index}.jpg`);
    assert.equal(itemSlides({ image: "", images }).length, 8);
    assert.deepEqual(itemSlides({ image: "pas-une-url", images: [] }), []);
  });
});

describe("alignCatalogGallery", () => {
  it("conserve la couverture et retire son doublon des photos supplémentaires", () => {
    const aligned = alignCatalogGallery("/cover.jpg", ["/extra.jpg", "/cover.jpg", "relative.jpg"]);
    assert.deepEqual(aligned, { image: "/cover.jpg", images: ["/extra.jpg"] });
  });

  it("prend la première photo valide comme couverture quand elle est vide", () => {
    const aligned = alignCatalogGallery("", ["note", "https://cdn.example/a.jpg", "/b.jpg"]);
    assert.deepEqual(aligned, { image: "https://cdn.example/a.jpg", images: ["/b.jpg"] });
  });

  it("limite les photos supplémentaires à sept", () => {
    const images = Array.from({ length: 9 }, (_, index) => `/photo-${index}.jpg`);
    assert.equal(alignCatalogGallery("/cover.jpg", images).images.length, 7);
  });
});

describe("extraPhotos", () => {
  it("garde la première photo supplémentaire sans en faire une couverture", () => {
    assert.deepEqual(extraPhotos(["/a.jpg", "/a.jpg", "/b.jpg"]), ["/a.jpg", "/b.jpg"]);
  });
});
