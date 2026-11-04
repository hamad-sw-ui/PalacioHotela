import { ContactClient } from "@/components/contact-client";

// Static marketing page: no request-time data, cached long and revalidated with the site.
export const revalidate = 300;

export default function ContactPage() { return <ContactClient />; }
