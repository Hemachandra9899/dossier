import type { Metadata } from "next";

import { productConfig } from "./product";

export type BuildMetadataOptions = {
  title?: string;
  description?: string;
  url?: string;
};

export function buildMetadata(options: BuildMetadataOptions = {}): Metadata {
  const title = options.title
    ? `${options.title} | ${productConfig.name}`
    : productConfig.name;
  const description = options.description ?? productConfig.description;
  const url = options.url ?? productConfig.routes.home;
  const image = productConfig.metaImage;

  return {
    metadataBase: new URL(productConfig.baseUrl),
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: productConfig.name,
      images: [
        {
          url: image,
          width: 800,
          height: 600,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: productConfig.social.twitter,
      images: [image],
    },
  };
}
