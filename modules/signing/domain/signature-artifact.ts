// Contract for the final signed artifact mirrored into Dossier-owned storage.
// Artifacts are IMMUTABLE: once written, a SignatureArtifact row is never
// updated. Corrections spawn a new SignatureRequest with its own artifact.

export interface SignedArtifactMetadata {
  fileName: string;
  mimeType: string;
  sha256: string;
  sizeBytes: number;
}
