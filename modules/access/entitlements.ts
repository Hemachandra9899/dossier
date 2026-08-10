export type DossierEntitlements = {
  documents: boolean;
  links: boolean;
  datarooms: boolean;
  analytics: boolean;
  advancedAnalytics: boolean;
  visitors: boolean;
  contacts: boolean;
  customBranding: boolean;
  customDomains: boolean;
  passwordProtection: boolean;
  emailVerification: boolean;
  watermarking: boolean;
  agreements: boolean;
  signing: boolean;
  folders: boolean;
  tags: boolean;
  teams: boolean;
};

export const DEFAULT_DOSSIER_ENTITLEMENTS: DossierEntitlements = {
  documents: true,
  links: true,
  datarooms: true,
  analytics: true,
  advancedAnalytics: true,
  visitors: true,
  contacts: true,
  customBranding: true,
  customDomains: true,
  passwordProtection: true,
  emailVerification: true,
  watermarking: true,
  agreements: true,
  signing: true,
  folders: true,
  tags: true,
  teams: true,
};
