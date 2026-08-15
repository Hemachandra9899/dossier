import prisma from "@/platform/db";

export type TFileSizeLimits = {
  video?: number | null;
  document?: number | null;
  image?: number | null;
  excel?: number | null;
  maxFiles?: number | null;
  maxPages?: number | null;
};

export type TOperationalLimits = {
  datarooms: number | null;
  links: number | null;
  documents: number | null;
  users: number | null;
  domains: number | null;
  customDomainOnPro: boolean;
  customDomainInDataroom: boolean;
  advancedLinkControlsOnPro: boolean | null;
  watermarkOnBusiness?: boolean | null;
  agreementOnBusiness?: boolean | null;
  linkCustomFields?: number | null;
  conversationsInDataroom?: boolean;
  dataroomUpload: boolean;
  fileSizeLimits?: TFileSizeLimits;
};

export const DOSSIER_OPERATIONAL_LIMITS: TOperationalLimits = {
  documents: Infinity,
  links: Infinity,
  users: Infinity,
  datarooms: Infinity,
  domains: Infinity,

  fileSizeLimits: {
    document: 100, // MB
    image: 25,
    video: 500,
    excel: 100,
    maxFiles: 100,
    maxPages: 1000,
  },

  advancedLinkControlsOnPro: true,
  watermarkOnBusiness: true,
  agreementOnBusiness: true,
  conversationsInDataroom: true,
  customDomainOnPro: true,
  customDomainInDataroom: true,
  dataroomUpload: true,

  linkCustomFields: 20,
};

export type LimitUsage = {
  documents: number;
  links: number;
  users: number;
};

export type DossierLimits = TOperationalLimits & {
  usage: LimitUsage;
};

export async function getLimits({
  teamId,
  userId,
}: {
  teamId: string;
  userId: string;
}): Promise<DossierLimits> {
  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
      users: {
        some: {
          userId: userId,
        },
      },
    },
    select: {
      _count: {
        select: {
          documents: true,
          links: true,
          users: true,
          invitations: true,
        },
      },
    },
  });

  if (!team) {
    throw new Error("Team not found");
  }

  return {
    ...DOSSIER_OPERATIONAL_LIMITS,
    usage: {
      documents: team._count.documents,
      links: team._count.links,
      users: team._count.users + team._count.invitations,
    },
  };
}

export function checkLimit() {
  return { allowed: true };
}
export function getLimit() {
  return 100;
}
