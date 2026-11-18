#!/usr/bin/env node
/** Ensure the known-password demo accounts cannot be seeded in production by accident. */
import { spawnSync } from "node:child_process";

const safeEnvironment = { ...process.env };
delete safeEnvironment.NODE_ENV;
delete safeEnvironment.VETTO_ALLOW_DEMO_SEED_IN_PRODUCTION;
delete safeEnvironment.SEED_PASSWORD;

const result = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
  {
    cwd: process.cwd(),
    env: { ...safeEnvironment, NODE_ENV: "production" },
    encoding: "utf8",
  },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

if (
  result.status === 0 ||
  !output.includes("Demo seed is disabled in production")
) {
  process.stderr.write(output);
  throw new Error("The production demo seed guard did not reject the default seed.");
}

console.log("PASS  production demo seed is blocked by default");
