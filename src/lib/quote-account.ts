export function quoteVisibleToAccount(
  quote: { userId: number | null; guestEmail: string },
  user: { id: number; email: string },
) {
  if (quote.userId === user.id) return true;
  return quote.userId == null && quote.guestEmail.trim().toLowerCase() === user.email.trim().toLowerCase();
}
