export function constructMetadata({
  title = "Dossier",
  description = "Collect, verify, sign, and close client files.",
  image = "/_static/meta-image.png",
  favicon = "/favicon.ico",
  noIndex = false,
}: {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  noIndex?: boolean;
} = {}) {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: image,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    favicon,
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}
