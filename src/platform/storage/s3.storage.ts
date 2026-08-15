import type { GetObjectOutput, ObjectStorage, PutObjectInput } from "./object-storage";

export class S3ObjectStorage implements ObjectStorage {
  async put(input: PutObjectInput): Promise<void> {
    // S3 put object implementation
  }

  async get(key: string): Promise<GetObjectOutput | null> {
    return null;
  }

  async delete(key: string): Promise<void> {
    // S3 delete object implementation
  }

  async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    return `/api/storage/download?key=${encodeURIComponent(key)}`;
  }
}

export const s3Storage = new S3ObjectStorage();
