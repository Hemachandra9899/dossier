import type { ObjectStorage } from "./object-storage";
import { s3Storage } from "./s3.storage";
import { storageKeys } from "./storage-keys";

export interface SignedArtifactStorage {
  putSignedPdf(teamId: string, requestId: string, bytes: Buffer | Uint8Array): Promise<string>;
  getSignedPdf(teamId: string, requestId: string): Promise<Buffer | null>;
  getSignedPdfDownloadUrl(teamId: string, requestId: string, expiresInSeconds?: number): Promise<string>;
}

export class ObjectStorageSignedArtifactAdapter implements SignedArtifactStorage {
  constructor(private storage: ObjectStorage = s3Storage) {}

  async putSignedPdf(teamId: string, requestId: string, bytes: Buffer | Uint8Array): Promise<string> {
    const key = storageKeys.signature(teamId, requestId);
    await this.storage.put({
      key,
      body: Buffer.from(bytes),
      contentType: "application/pdf",
    });
    return key;
  }

  async getSignedPdf(teamId: string, requestId: string): Promise<Buffer | null> {
    const key = storageKeys.signature(teamId, requestId);
    return this.storage.getBuffer(key);
  }

  async getSignedPdfDownloadUrl(
    teamId: string,
    requestId: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const key = storageKeys.signature(teamId, requestId);
    return this.storage.getDownloadUrl(key, expiresInSeconds);
  }
}

export const signedArtifactStorage = new ObjectStorageSignedArtifactAdapter(s3Storage);
