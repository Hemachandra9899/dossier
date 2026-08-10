// S3-backed SignedArtifactStorage. Mirrors the proven Agreement signed-file
// storage path (team S3 bucket + private object keys, downloads served via
// presigned URLs). Uses S3_PATH storage regardless of how the source document
// is stored.

import { PutObjectCommand } from "@aws-sdk/client-s3";

import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import { assertS3Transport } from "@/lib/files/transport";
import { buildContentDisposition, safeSlugify } from "@/lib/utils";

import type { SignedArtifactStorage } from "./signed-artifact-storage";

export const buildSignedArtifactKey = ({
  teamId,
  requestId,
}: {
  teamId: string;
  requestId: string;
}) => `${teamId}/signatures/${requestId}.pdf`;

export class S3SignedArtifactStorage implements SignedArtifactStorage {
  async upload(input: {
    teamId: string;
    requestId: string;
    fileName: string;
    body: Buffer;
  }): Promise<{ storageKey: string }> {
    assertS3Transport();

    const storageKey = buildSignedArtifactKey({
      teamId: input.teamId,
      requestId: input.requestId,
    });
    const safeName = safeSlugify(input.fileName).slice(0, 60) || "signed";

    const { client, config } = await getTeamS3ClientAndConfig(input.teamId);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        Body: input.body,
        ContentType: "application/pdf",
        ContentDisposition: buildContentDisposition(safeName, safeName),
      }),
    );

    return { storageKey };
  }
}

export const s3SignedArtifactStorage: SignedArtifactStorage =
  new S3SignedArtifactStorage();
