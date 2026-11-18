import "server-only";

import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  STORAGE_DRIVER: z.preprocess(
    emptyToUndefined,
    z.enum(["local", "s3"]).optional(),
  ),
  S3_ENDPOINT: z.preprocess(emptyToUndefined, z.url().optional()),
  S3_REGION: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_BUCKET: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_ACCESS_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_SECRET_ACCESS_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_FORCE_PATH_STYLE: z.preprocess(
    emptyToUndefined,
    z.enum(["true", "false"]).optional(),
  ),
  AI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AI_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  AI_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid server environment configuration. ${details}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getAppUrl(): string {
  return getServerEnv().NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
