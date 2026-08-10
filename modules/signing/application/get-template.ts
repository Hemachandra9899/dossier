// GetTemplate: reads a signature template scoped to a team. Never returns
// rows the actor's team does not own.

import type { SignatureTemplate } from "@prisma/client";

import type { SigningContext } from "./context";
import { SigningNotFoundError } from "../domain/signing-errors";

export interface GetTemplateInput {
  teamId: string;
  templateId: string;
}

export interface TemplateDTO {
  id: string;
  name: string;
  status: string;
  provider: string;
  providerExternalId: string;
  providerTemplateId: string | null;
  providerEnvelopeId: string | null;
  documentId: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getTemplate(
  ctx: SigningContext,
  input: GetTemplateInput,
): Promise<TemplateDTO> {
  const template = await ctx.templates.findByTeamAndId(
    input.teamId,
    input.templateId,
  );

  if (!template) {
    throw new SigningNotFoundError("Signature template was not found.");
  }

  return toTemplateDTO(template);
}

export function toTemplateDTO(template: SignatureTemplate): TemplateDTO {
  return {
    id: template.id,
    name: template.name,
    status: template.status,
    provider: template.provider,
    providerExternalId: template.providerExternalId,
    providerTemplateId: template.providerTemplateId,
    providerEnvelopeId: template.providerEnvelopeId,
    documentId: template.documentId,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}
