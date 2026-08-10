export type ResolvedPublicLinkMeta = {
  enableCustomMetatag: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImage: string | null;
  metaFavicon: string | null;
};

export function resolvePublicLinkMeta({
  link,
  teamBrand,
  dataroomBrand,
  defaultTitle,
}: {
  link: {
    enableCustomMetatag: boolean;
    metaTitle: string | null;
    metaDescription: string | null;
    metaImage: string | null;
    metaFavicon: string | null;
  };
  teamBrand: any;
  dataroomBrand: any;
  defaultTitle: string | null;
}): ResolvedPublicLinkMeta {
  if (link.enableCustomMetatag) {
    return {
      enableCustomMetatag: true,
      metaTitle: link.metaTitle ?? defaultTitle,
      metaDescription: link.metaDescription,
      metaImage: link.metaImage,
      metaFavicon: link.metaFavicon,
    };
  }
  const brand = dataroomBrand ?? teamBrand;
  return {
    enableCustomMetatag: !!brand?.customLinkPreviewEnabled,
    metaTitle: brand?.linkPreviewTitle ?? defaultTitle,
    metaDescription: brand?.linkPreviewDescription ?? null,
    metaImage: brand?.linkPreviewImage ?? null,
    metaFavicon: brand?.linkPreviewFavicon ?? null,
  };
}
