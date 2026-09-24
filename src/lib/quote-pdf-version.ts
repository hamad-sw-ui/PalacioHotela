export function currentQuotePdfVersion() {
  return process.env.QUOTE_PDF_V3_ENABLED === "false" ? 2 : 3;
}
