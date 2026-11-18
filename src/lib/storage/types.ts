export type StorageProvider = "local" | "s3";

export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export interface StorageAdapter {
  provider: StorageProvider;
  putObject(input: PutObjectInput): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
}
