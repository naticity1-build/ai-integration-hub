import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load monorepo root .env (single source of truth)
loadEnvConfig(path.join(__dirname, "../.."));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hub packages are server-only (API routes + RSC); externalize to avoid webpack bundling node:crypto/jose
  serverExternalPackages: ["@hub/auth", "@hub/db", "@hub/core", "@hub/api", "@hub/connectors"],
};

export default nextConfig;
