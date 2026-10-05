export function bookingAdminHref(id: number) {
  return `/admin?section=reservations&booking=${id}`;
}

export function notificationMatchesRead(read: boolean, filter: string) {
  if (filter === "unread") return !read;
  if (filter === "read") return read;
  return true;
}
