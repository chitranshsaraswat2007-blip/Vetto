import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  PutObjectInput,
  StorageAdapter,
} from "@/lib/storage/types";

const root = path.resolve(
  process.env.LOCAL_STORAGE_ROOT ?? path.join(process.cwd(), ".uploads"),
);

function resolveKey(key: string) {
  const resolved = path.resolve(root, key);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage key.");
  }

  return resolved;
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = "local" as const;

  async putObject({ key, body }: PutObjectInput) {
    const target = resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async getObject(key: string) {
    return readFile(resolveKey(key));
  }

  async deleteObject(key: string) {
    await rm(resolveKey(key), { force: true });
  }
}
