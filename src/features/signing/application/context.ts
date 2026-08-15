import type { SignatureRequestRepository } from "../server/signature-request.repository";
import type { DocumentRepository } from "../server/document.repository";
import type { ProviderEventRepository } from "../server/provider-event.repository";
import type { SignatureTemplateRepository } from "../server/signature-template.repository";
import type { SigningProvider } from "../providers/signing-provider";

export type ProviderEventMapper = (event: string) => any;

export interface SigningContext {
  requests: SignatureRequestRepository;
  documents: DocumentRepository;
  events: ProviderEventRepository;
  templates: SignatureTemplateRepository;
  provider: SigningProvider;
  mapEventToStatus: ProviderEventMapper;
  storage: any;
  artifactMirror: any;
  logger: any;
}

export function createSigningContext(..._args: any[]): SigningContext {
  return {} as any;
}
