export const buildSignedArtifactKey = ({
  teamId,
  requestId,
}: {
  teamId: string;
  requestId: string;
}) => `${teamId}/signatures/${requestId}.pdf`;

export const buildDocumentStorageKey = ({
  teamId,
  documentId,
  fileExtension,
}: {
  teamId: string;
  documentId: string;
  fileExtension: string;
}) => `${teamId}/documents/${documentId}.${fileExtension}`;
