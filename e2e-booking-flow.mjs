export default async function run(page, ui) {
  const result = {};

  // ÉTAPE 1 — Accueil : le hero n'a plus « Réserver mon séjour », le navbar a « Réserver »
  const home = await ui.snapshot();
  result.heroHasBookMyStay = home.includes('"Réserver mon séjour"');
  result.navbarHasReserve = /link "Réserver"/.test(home);
  result.navbarHasBookNow = home.includes('"Book now"') || /"Réserver .*Book/.test(home);

  // ÉTAPE 2 — Aller sur /reservation directement (navbar)
  await page.goto("http://localhost:3000/reservation", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const form = await ui.snapshot();
  result.guestFormVisible = form.includes("Votre nom et prénom") || form.includes("Envoyer ma demande");
  result.submitLabel = form.match(/button "(Envoyer ma demande[^"]*)"/)?.[1] || "";

  // ÉTAPE 3 — Remplir le formulaire invité puis soumettre → doit rediriger vers /compte
  // (membres uniquement à la soumission, jamais avant)
  const fill = async (placeholder, value) => {
    const ref = form.match(new RegExp(`@e\\d+ textbox "${placeholder}"`))?.[0]?.match(/@(e\d+)/)?.[1];
    return ref;
  };
  const nameRef = await fill("Votre nom et prénom");
  const emailRef = await fill("vous@exemple.com");
  const phoneRef = await fill("+237 6...");
  if (nameRef) await ui.fill(nameRef, "Test Invité");
  if (emailRef) await ui.fill(emailRef, "invite@test.com");
  if (phoneRef) await ui.fill(phoneRef, "+237 600 00 00 00");

  const submitRef = form.match(/@e\d+ button "Envoyer ma demande[^"]*"/)?.[0]?.match(/@(e\d+)/)?.[1];
  if (!submitRef) { result.error = "bouton Envoyer introuvable"; result.snapshot = form; return result; }

  await ui.click(submitRef);
  await page.waitForURL("**/compte**", { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(1000);
  result.finalUrlAfterSubmit = page.url();
  result.redirectedToAccount = page.url().includes("/compte");

  // ÉTAPE 4 — Le brouillon a-t-il été sauvegardé ?
  result.draftSaved = await page.evaluate(() => !!sessionStorage.getItem("palacio_booking_draft"));

  return result;
}
