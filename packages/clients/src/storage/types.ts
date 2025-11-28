import type { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

export type { S3Client, S3ClientConfig };

export interface CreateStorageClientOptions {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  config?: S3ClientConfig;
  logger?: {
    info: (message: string) => void;
  };
}
