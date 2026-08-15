import type { ObjectStorage } from "./object-storage";
import { buildSignedArtifactStorageKey } from "./storage-keys";

export interface SignedArtifactStorage {
  upload(input: {
    teamId: string;
    requestId: string;
    fileName: string;
    body: Buffer;
  }): Promise<string | { storageKey: string }>;
}

export class ObjectStorageSignedArtifactAdapter implements SignedArtifactStorage {
  constructor(private readonly storage: ObjectStorage) {}

  async upload(input: {
    teamId: string;
    requestId: string;
    fileName: string;
    body: Buffer;
  }): Promise<string> {
    const key = buildSignedArtifactStorageKey(input.teamId, input.requestId, input.fileName);
    await this.storage.put({
      key,
      body: input.body,
      contentType: "application/pdf",
    });
    return key;
  }
}
