export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array | string | ReadableStream | Blob;
  contentType?: string;
  contentDisposition?: string;
  metadata?: Record<string, string>;
  bucket?: string;
}

export interface GetObjectOutput {
  body: Buffer;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  metadata?: Record<string, string>;
}

export interface HeadObjectOutput {
  exists: boolean;
  contentLength?: number;
  contentType?: string;
  etag?: string;
}

export interface ObjectStorage {
  put(input: PutObjectInput): Promise<void>;
  getBuffer(key: string, bucket?: string): Promise<Buffer | null>;
  get(key: string, bucket?: string): Promise<GetObjectOutput | null>;
  head(key: string, bucket?: string): Promise<HeadObjectOutput>;
  getDownloadUrl(
    key: string,
    expiresInSeconds?: number,
    bucket?: string,
    responseContentDisposition?: string,
  ): Promise<string>;
  getSignedUrl(
    key: string,
    expiresInSeconds?: number,
    bucket?: string,
    responseContentDisposition?: string,
  ): Promise<string>;
  getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresInSeconds?: number,
    contentDisposition?: string,
    bucket?: string,
  ): Promise<string>;
  copy(sourceKey: string, destinationKey: string, sourceBucket?: string, destinationBucket?: string): Promise<void>;
  delete(key: string, bucket?: string): Promise<void>;
}
