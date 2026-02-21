export interface UploadResult {
  key: string;
  bucket: string | null;
}

export interface StorageService {
  /**
   * Upload buffer to storage. Returns key and bucket (null for local).
   */
  upload(
    buffer: Buffer,
    key: string,
    options: { contentType?: string; metadata?: Record<string, string> },
  ): Promise<UploadResult>;

  /**
   * Delete object by key and optional bucket (null = default/local).
   */
  delete(key: string, bucket: string | null): Promise<void>;

  /**
   * Return a signed download URL, or null if the backend should proxy the file (e.g. local).
   */
  getSignedDownloadUrl(
    key: string,
    bucket: string | null,
    options?: { expiresInSeconds?: number; responseContentDisposition?: string },
  ): Promise<string | null>;

  /**
   * Return a read stream for local proxy. Only used when getSignedDownloadUrl returns null.
   */
  getLocalFilePath?(key: string): string | null;
}
