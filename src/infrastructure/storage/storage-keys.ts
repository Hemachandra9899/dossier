export const storageKeys = {
  /**
   * Generates object key for uploaded documents: `${teamId}/${docId}/${filename}`
   */
  document: (teamId: string, docId: string, filename: string) => {
    return `${teamId}/${docId}/${filename}`;
  },

  /**
   * Generates object key for signed artifacts: `signatures/${teamId}/${requestId}/signed.pdf`
   */
  signature: (teamId: string, requestId: string, filename: string = "signed.pdf") => {
    return `signatures/${teamId}/${requestId}/${filename}`;
  },

  /**
   * Generates object key for a recipient's drawn/uploaded signature image:
   * `signatures/${teamId}/${requestId}/sig-${recipientId}-${fieldId}.png`
   */
  signatureImage: (
    teamId: string,
    requestId: string,
    recipientId: string,
    fieldId: string,
  ) => {
    return `signatures/${teamId}/${requestId}/sig-${recipientId}-${fieldId}.png`;
  },

  /**
   * Generates object key for closing binder / completion runs: `completions/${teamId}/${fileId}/${runId}/${name}`
   */
  completion: (teamId: string, fileId: string, runId: string, name: string) => {
    return `completions/${teamId}/${fileId}/${runId}/${name}`;
  },

  /**
   * Generates object key for test artifacts: `_dossier_storage_test/${uuid}/${name}`
   */
  test: (uuid: string, name: string) => {
    return `_dossier_storage_test/${uuid}/${name}`;
  },
};
