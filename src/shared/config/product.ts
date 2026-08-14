export const productConfig = {
  name: "Dossier",
  description:
    "Dossier is a document workflow and signing product for modern teams. Share files, track requirements, verify completion, and sign in one workspace.",
  baseUrl:
    process.env.NEXT_PUBLIC_BASE_URL || "https://dossier.com",
  logo: "/logos/dossier.svg",
  metaImage: "/_static/meta-image.png",
  social: {
    twitter: "@dossier",
  },
  legal: {
    terms: "https://dossier.com/terms",
    privacy: "https://dossier.com/privacy",
  },
  routes: {
    home: "/",
    login: "/login",
    register: "/register",
    dashboard: "/dashboard",
  },
} as const;
