import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import { assertS3Transport } from "@/lib/files/transport";
import { buildContentDisposition, safeSlugify } from "@/lib/utils";

import type {
  CopyOptions,
  DeleteOptions,
  GetBufferOptions,
  GetDownloadUrlOptions,
  ObjectStorage,
  PutOptions,
} from "./object-storage";

export class S3ObjectStorage implements ObjectStorage {
  async put(options: PutOptions): Promise<{ storageKey: string }> {
    assertS3Transport();
    const { client, config } = await getTeamS3ClientAndConfig(options.teamId);

    const safeName = options.contentDisposition
      ? options.contentDisposition
      : safeSlugify(options.storageKey.split("/").pop() || "file");

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: options.storageKey,
        Body: options.body,
        ContentType: options.contentType || "application/octet-stream",
        ContentDisposition: options.contentDisposition || buildContentDisposition(safeName, safeName),
      }),
    );

    return { storageKey: options.storageKey };
  }

  async getBuffer(options: GetBufferOptions): Promise<Buffer> {
    assertS3Transport();
    const { client, config } = await getTeamS3ClientAndConfig(options.teamId);

    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: options.storageKey,
      }),
    );

    if (!response.Body) {
      throw new Error(`Object not found at key: ${options.storageKey}`);
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async getDownloadUrl(options: GetDownloadUrlOptions): Promise<string> {
    assertS3Transport();
    const { client, config } = await getTeamS3ClientAndConfig(options.teamId);

    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: options.storageKey,
      ResponseContentDisposition: options.fileName
        ? buildContentDisposition(options.fileName, options.fileName)
        : undefined,
    });

    return getSignedUrl(client, command, {
      expiresIn: options.expiresInSeconds || 3600,
    });
  }

  async copy(options: CopyOptions): Promise<void> {
    assertS3Transport();
    const { client, config } = await getTeamS3ClientAndConfig(options.teamId);

    await client.send(
      new CopyObjectCommand({
        Bucket: config.bucket,
        CopySource: `${config.bucket}/${options.sourceKey}`,
        Key: options.destinationKey,
      }),
    );
  }

  async delete(options: DeleteOptions): Promise<void> {
    assertS3Transport();
    const { client, config } = await getTeamS3ClientAndConfig(options.teamId);

    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: options.storageKey,
      }),
    );
  }
}

export const s3Storage = new S3ObjectStorage();
