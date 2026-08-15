export const productConfig = {
  name: "Dossier",
  description: "Secure Document Management, Verification, and E-Signatures",
  domain: "dossier.app",
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://dossier.app",
  metaImage: "/logos/dossier-og.png",
  logo: "/logos/dossier.svg",
  logoMark: "/logos/dossier-mark.svg",
  routes: {
    home: "/",
    login: "/login",
    register: "/register",
    verify: "/verify",
    dashboard: "/dashboard",
    files: "/files",
    documents: "/documents",
    settings: "/settings",
  },
  social: {
    twitter: "@dossierapp",
  },
  legal: {
    terms: "https://dossier.app/terms",
    privacy: "https://dossier.app/privacy",
  },
} as const;

export default productConfig;
