// SignedArtifactStorage port — where mirrored signed files are persisted. The
// application layer depends on this interface only; the S3 implementation lives
// next to the other storage adapters.

export interface SignedArtifactStorage {
  upload(input: {
    teamId: string;
    requestId: string;
    fileName: string;
    body: Buffer;
  }): Promise<{ storageKey: string }>;
}
