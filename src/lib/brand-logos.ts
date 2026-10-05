export const logoVariants = ["primary", "secondary", "tertiary"] as const;
export type LogoVariant = (typeof logoVariants)[number];

export type BrandLogoSettings = {
  logoUrl?: string | null;
  secondaryLogoUrl?: string | null;
  tertiaryLogoUrl?: string | null;
  quoteLogoVariant?: string | null;
};

export function logoForVariant(settings: BrandLogoSettings, variant: LogoVariant) {
  if (variant === "secondary") return settings.secondaryLogoUrl || "";
  if (variant === "tertiary") return settings.tertiaryLogoUrl || "";
  return settings.logoUrl || "";
}

export function quoteLogoUrl(settings: BrandLogoSettings) {
  const variant = logoVariants.includes(settings.quoteLogoVariant as LogoVariant)
    ? settings.quoteLogoVariant as LogoVariant
    : "primary";
  return logoForVariant(settings, variant);
}

/** Browser tab icon uses the quote monogram, not the wide lockup. */
export function quoteTabIconUrl(settings: BrandLogoSettings) {
  return settings.tertiaryLogoUrl || quoteLogoUrl(settings);
}
