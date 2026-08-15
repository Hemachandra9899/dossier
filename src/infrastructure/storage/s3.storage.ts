import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  GetObjectOutput,
  HeadObjectOutput,
  ObjectStorage,
  PutObjectInput,
} from "./object-storage";
import { createS3Client, getSharedS3Client } from "./s3-client";
import { getStorageConfig } from "./storage-config";

export class S3ObjectStorage implements ObjectStorage {
  private client: S3Client;
  private defaultBucket: string;

  constructor(client?: S3Client, defaultBucket?: string) {
    this.client = client || getSharedS3Client();
    this.defaultBucket = defaultBucket || getStorageConfig().bucket;
  }

  // S3Client delegate properties for compatibility
  get config() {
    return this.client.config;
  }

  get middlewareStack() {
    return this.client.middlewareStack;
  }

  destroy(): void {
    this.client.destroy();
  }

  async send(command: any, optionsOrCb?: any, cb?: any): Promise<any> {
    return (this.client as any).send(command, optionsOrCb, cb);
  }

  async put(input: PutObjectInput): Promise<void> {
    const bucket = input.bucket || this.defaultBucket;
    let bodyBuffer: Buffer | Uint8Array | string;

    if (Buffer.isBuffer(input.body) || typeof input.body === "string" || input.body instanceof Uint8Array) {
      bodyBuffer = input.body;
    } else if (input.body instanceof Blob) {
      bodyBuffer = Buffer.from(await input.body.arrayBuffer());
    } else {
      bodyBuffer = input.body as any;
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: bodyBuffer,
      ContentType: input.contentType,
      ContentDisposition: input.contentDisposition,
      Metadata: input.metadata,
    });

    await this.client.send(command);
  }

  async getBuffer(key: string, bucket?: string): Promise<Buffer | null> {
    const res = await this.get(key, bucket);
    return res ? res.body : null;
  }

  async get(key: string, bucket?: string): Promise<GetObjectOutput | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket || this.defaultBucket,
        Key: key,
      });

      const response = await this.client.send(command);
      if (!response.Body) return null;

      const bytes = await response.Body.transformToByteArray();
      const body = Buffer.from(bytes);

      return {
        body,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        etag: response.ETag,
        metadata: response.Metadata,
      };
    } catch (error: any) {
      if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async head(key: string, bucket?: string): Promise<HeadObjectOutput> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket || this.defaultBucket,
        Key: key,
      });
      const response = await this.client.send(command);
      return {
        exists: true,
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        etag: response.ETag,
      };
    } catch (error: any) {
      if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
        return { exists: false };
      }
      throw error;
    }
  }

  async getDownloadUrl(
    key: string,
    expiresInSeconds: number = 3600,
    bucket?: string,
    responseContentDisposition?: string,
  ): Promise<string> {
    return this.getSignedUrl(
      key,
      expiresInSeconds,
      bucket,
      responseContentDisposition,
    );
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds: number = 3600,
    bucket?: string,
    responseContentDisposition?: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket || this.defaultBucket,
      Key: key,
      ...(responseContentDisposition
        ? { ResponseContentDisposition: responseContentDisposition }
        : {}),
    });
    return getS3SignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number = 3600,
    contentDisposition?: string,
    bucket?: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket || this.defaultBucket,
      Key: key,
      ContentType: contentType,
      ContentDisposition: contentDisposition,
    });
    return getS3SignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async copy(
    sourceKey: string,
    destinationKey: string,
    sourceBucket?: string,
    destinationBucket?: string,
  ): Promise<void> {
    const srcBucket = sourceBucket || this.defaultBucket;
    const dstBucket = destinationBucket || this.defaultBucket;

    const command = new CopyObjectCommand({
      Bucket: dstBucket,
      Key: destinationKey,
      CopySource: `${srcBucket}/${encodeURIComponent(sourceKey)}`,
    });
    await this.client.send(command);
  }

  async delete(key: string, bucket?: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket || this.defaultBucket,
      Key: key,
    });
    await this.client.send(command);
  }
}

export const s3Storage = new S3ObjectStorage();
