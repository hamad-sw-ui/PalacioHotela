export const runtime = "nodejs";
// Same cached pipeline as ./icon — no per-request regeneration.
export const revalidate = 300;
export const contentType = "image/png";

export { default } from "./icon";
