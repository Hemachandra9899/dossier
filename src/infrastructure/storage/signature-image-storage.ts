import type { ObjectStorage } from "./object-storage";
import { s3Storage } from "./s3.storage";
import { storageKeys } from "./storage-keys";

export interface SignatureImageStorage {
  putSignatureImage(
    teamId: string,
    requestId: string,
    recipientId: string,
    fieldId: string,
    bytes: Buffer | Uint8Array,
  ): Promise<string>;
  getSignatureImage(storageKey: string): Promise<Buffer | null>;
}

export class ObjectStorageSignatureImageAdapter implements SignatureImageStorage {
  constructor(private storage: ObjectStorage = s3Storage) {}

  async putSignatureImage(
    teamId: string,
    requestId: string,
    recipientId: string,
    fieldId: string,
    bytes: Buffer | Uint8Array,
  ): Promise<string> {
    const key = storageKeys.signatureImage(teamId, requestId, recipientId, fieldId);
    await this.storage.put({
      key,
      body: Buffer.from(bytes),
      contentType: "image/png",
    });
    return key;
  }

  async getSignatureImage(storageKey: string): Promise<Buffer | null> {
    return this.storage.getBuffer(storageKey);
  }
}

export const signatureImageStorage = new ObjectStorageSignatureImageAdapter(
  s3Storage,
);