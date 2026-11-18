import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type {
  PutObjectInput,
  StorageAdapter,
} from "@/lib/storage/types";

type S3Config = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

function readConfig(): S3Config {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || "auto";

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Object storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    );
  }

  return {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

export function isS3Configured() {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

export class S3StorageAdapter implements StorageAdapter {
  readonly provider = "s3" as const;
  private readonly config = readConfig();
  private readonly client = new S3Client({
    region: this.config.region,
    endpoint: this.config.endpoint,
    forcePathStyle: this.config.forcePathStyle,
    credentials: {
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
    },
  });

  async putObject({ key, body, contentType }: PutObjectInput) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error("Stored object has no body.");
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  async deleteObject(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );
  }
}
