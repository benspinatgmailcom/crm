export interface StorageProvider {
  putObject(params: {
    key: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<{ key: string }>;

  getSignedUrl(params: {
    key: string;
    expiresSeconds: number;
  }): Promise<string | null>;

  deleteObject(params: { key: string }): Promise<void>;

  /** If this provider stores files on local disk, return the file path for streaming; otherwise null. */
  getLocalFilePath?(key: string): string | null;
}
