import type { Readable } from "node:stream";

export interface UploadParams {
  key: string;
  body: Buffer | Readable;
  contentType: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>; // Para R2 lifecycle policies
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  etag: string;
}

export interface StorageProvider {
  /**
   * Upload a file to storage
   */
  upload(params: UploadParams): Promise<UploadResult>;

  /**
   * Download a file from storage
   */
  download(key: string): Promise<Buffer>;

  /**
   * Delete a file from storage
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists in storage
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get public URL for a file
   */
  getPublicUrl(key: string): string;

  /**
   * Get signed upload URL (presigned URL for client-side upload)
   */
  getSignedUploadUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Get signed download URL (presigned URL for secure download)
   */
  getSignedDownloadUrl(key: string, expiresIn?: number): Promise<string>;
}
