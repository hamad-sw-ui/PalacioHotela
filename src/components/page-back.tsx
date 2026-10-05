"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { pageBackFallback, pageBackHref } from "@/lib/site-navigation";
import { useSite } from "@/components/site-shell";

export function PageBack({ tone = "light" }: { tone?: "light" | "ink" }) {
  const { locale, member } = useSite();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const signedIn = member === true;
  const fallback = pageBackFallback(pathname, search, signedIn);
  const [href, setHref] = useState(fallback);

  useEffect(() => {
    setHref(pageBackHref(pathname, search, signedIn) || fallback);
  }, [pathname, search, signedIn, fallback]);

  if (!fallback) return null;

  return (
    <Link href={href || fallback} className={`page-back page-back-${tone}`} aria-label={locale === "en" ? "Go back" : "Retour"}>
      <span className="page-back-icon" aria-hidden="true"><ArrowLeft size={15} strokeWidth={2.2} /></span>
      <span>{locale === "en" ? "Back" : "Retour"}</span>
    </Link>
  );
}
