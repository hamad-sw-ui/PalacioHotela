export default async function run(page, ui) {
  const before = await ui.snapshot();
  const book = before.match(/@(e\d+) link "Réserver mon séjour"/)?.[1];
  if (!book) return { error: "bouton introuvable", snapshot: before };
  await ui.click(book);
  await page.waitForURL("**/reservation", { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(800);
  const url = page.url();
  const snapshot = await ui.snapshot();
  const hasGuestForm = snapshot.includes("Votre nom et prénom");
  const sentToAccount = url.includes("/compte");
  return { clicked: book, finalUrl: url, hasGuestForm, sentToAccount };
}
