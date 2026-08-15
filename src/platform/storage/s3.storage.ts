import type { GetObjectOutput, ObjectStorage, PutObjectInput } from "./object-storage";

export class S3ObjectStorage implements ObjectStorage {
  config = {
    region: () => Promise.resolve(process.env.AWS_REGION || "us-east-1"),
    requestHandler: {} as any,
    apiVersion: "2006-03-01",
  } as any;

  middlewareStack = { use: () => {}, remove: () => {} } as any;

  destroy(): void {}

  async send(_command?: any): Promise<any> {
    return { Body: null, ContentType: "application/octet-stream", ContentLength: 0 };
  }

  async put(_input: PutObjectInput): Promise<void> {}

  async get(_key: string): Promise<GetObjectOutput | null> {
    return null;
  }

  async delete(_key: string): Promise<void> {}

  async getSignedUrl(key: string, _expiresInSeconds: number = 3600): Promise<string> {
    return `/api/storage/download?key=${encodeURIComponent(key)}`;
  }
}

export const s3Storage = new S3ObjectStorage();
