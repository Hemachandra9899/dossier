export function buildDocumentStorageKey(teamId: string, documentId: string, filename: string): string {
  return `teams/${teamId}/documents/${documentId}/${filename}`;
}

export function buildSignedArtifactStorageKey(teamId: string, requestId: string, filename: string): string {
  return `teams/${teamId}/signing/${requestId}/${filename}`;
}
