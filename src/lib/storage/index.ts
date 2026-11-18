import "server-only";

import { LocalStorageAdapter } from "@/lib/storage/local";
import { isS3Configured, S3StorageAdapter } from "@/lib/storage/s3";
import type { StorageAdapter, StorageProvider } from "@/lib/storage/types";

let cachedAdapter: StorageAdapter | null = null;

function configuredDriver(): StorageProvider {
  const requested = process.env.STORAGE_DRIVER?.toLowerCase();

  if (requested === "local") {
    return "local";
  }

  if (requested === "s3") {
    return "s3";
  }

  if (process.env.NODE_ENV !== "production" || isS3Configured()) {
    return isS3Configured() ? "s3" : "local";
  }

  throw new Error(
    "Object storage is not configured. Set STORAGE_DRIVER and the S3_* variables.",
  );
}

export function getStorageAdapter(): StorageAdapter {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  const driver = configuredDriver();
  cachedAdapter =
    driver === "s3" ? new S3StorageAdapter() : new LocalStorageAdapter();

  return cachedAdapter;
}

export function getStorageStatus():
  | { configured: true; provider: StorageProvider; detail: string }
  | { configured: false; provider: null; detail: string } {
  try {
    const provider = configuredDriver();

    if (provider === "s3" && !isS3Configured()) {
      return {
        configured: false,
        provider: null,
        detail: "S3/Bucket credentials are incomplete.",
      };
    }

    return {
      configured: true,
      provider,
      detail:
        provider === "s3"
          ? "S3-compatible object storage"
          : "Local development disk",
    };
  } catch {
    return {
      configured: false,
      provider: null,
      detail: "Object storage is not configured.",
    };
  }
}

export function buildStorageKey(
  prefix: string,
  ownerId: string,
  filename: string,
) {
  const safeName =
    filename
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(-120) || "file";

  return `${prefix}/${ownerId}/${Date.now()}-${safeName}`;
}
