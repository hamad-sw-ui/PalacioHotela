import assert from "node:assert/strict";
import test from "node:test";
import { featuresForNewItem, normalizeCatalogFeatures, suggestedFeatures } from "../src/lib/catalog-features";

test("normalizeCatalogFeatures keeps a complete line and drops blanks", () => {
  const rows = normalizeCatalogFeatures([
    { labelFr: " Chambre ", labelEn: "", value: " 1 " },
    { labelFr: "Salon", labelEn: "Lounge", value: "0" },
    { labelFr: "", labelEn: "Screen", value: "1" },
    { labelFr: "Surface", labelEn: "Area", value: "80 m²" },
  ]);
  assert.deepEqual(rows, [
    { labelFr: "Chambre", labelEn: "Chambre", value: "1" },
    { labelFr: "Surface", labelEn: "Area", value: "80 m²" },
  ]);
});

test("a new article keeps the administrator lines, or receives the category lines", () => {
  assert.equal(featuresForNewItem("conference_room", []).some((row) => row.labelFr === "Écran"), true);
  assert.deepEqual(featuresForNewItem("service", [{ labelFr: "Guide", labelEn: "Guide", value: "1" }]), [{ labelFr: "Guide", labelEn: "Guide", value: "1" }]);
});
  test("suggested features differ for a room, a hall and a restaurant", () => {
  assert.equal(suggestedFeatures("accommodation").some((row) => row.labelFr === "Salle de bain"), true);
  assert.equal(suggestedFeatures("conference_room").some((row) => row.labelFr === "Écran"), true);
  assert.equal(suggestedFeatures("event_hall").some((row) => row.labelFr === "Piste"), true);
  assert.equal(suggestedFeatures("restaurant").some((row) => row.labelFr === "Terrasse"), true);
  assert.equal(suggestedFeatures("service").some((row) => row.labelFr === "Salle de bain"), false);
});
