export type BrandLogoFields = {
  logo?: string | null;
  hideLogo?: boolean | null;
};

export type ResolvedBrandLogo =
  | { kind: "custom"; src: string }
  | { kind: "papermark" }
  | { kind: "none" };

export function resolveBrandLogo(
  fields: BrandLogoFields | null | undefined,
): ResolvedBrandLogo {
  if (!fields) {
    return { kind: "papermark" };
  }
  if (fields.hideLogo === true) {
    return { kind: "none" };
  }
  if (fields.logo) {
    return { kind: "custom", src: fields.logo };
  }
  return { kind: "papermark" };
}

export function mergeBrandLogoFields(
  brand: any,
  dataroomBrand?: any,
): BrandLogoFields {
  return {
    logo: dataroomBrand?.logo ?? brand?.logo ?? null,
    hideLogo: dataroomBrand?.hideLogo ?? brand?.hideLogo ?? false,
  };
}
