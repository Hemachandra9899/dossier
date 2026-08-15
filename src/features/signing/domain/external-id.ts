// Deterministic Dossier-owned external ids. Provider records are always
// correlated back to Dossier rows via these strings (never raw numeric
// Documenso ids). Same pattern as the legacy papermark:team:{teamId} ids.

export function buildTemplateExternalId(input: {
  teamId: string;
  templateId: string;
}) {
  return `dossier:team:${input.teamId}:signature-template:${input.templateId}`;
}

export function buildRequestExternalId(input: {
  teamId: string;
  requestId: string;
}) {
  return `dossier:team:${input.teamId}:signature-request:${input.requestId}`;
}

const SIGNING_EXTERNAL_ID_PREFIX = "dossier:team:";

/** True for any external id this product mints (defense against foreign ids). */
export const isDossierSigningExternalId = (value: string) =>
  value.startsWith(SIGNING_EXTERNAL_ID_PREFIX);
