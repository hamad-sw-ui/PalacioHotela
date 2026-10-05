export function replyAccepted(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 4000;
}

export function statusAfterOpen(status: string) {
  return status === "new" ? "read" : status;
}
