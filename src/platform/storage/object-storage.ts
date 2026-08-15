export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array | Blob | string;
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}

export interface GetObjectOutput {
  body: ReadableStream | Buffer | Uint8Array;
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
}

export interface ObjectStorage {
  put(input: PutObjectInput): Promise<void>;
  get(key: string): Promise<GetObjectOutput | null>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
