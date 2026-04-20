import { z } from "zod";

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST !== undefined;

const envSchema = z.object({
  VITE_APP_ID: z.string().default("judge-ai"),
  JWT_SECRET: isTest
    ? z.string().min(32).default("test-secret-min-32-chars-long!!!!!!!!")
    : z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  // Optional: separate secret for encrypting stored provider API keys.
  // If not set, falls back to JWT_SECRET for backwards compatibility
  // (so existing encrypted keys keep decrypting). New deployments should
  // set this to a distinct 32+ char value so rotating the session secret
  // does not require re-entering every provider API key.
  PROVIDER_ENCRYPTION_SECRET: z.string().min(32).optional().or(z.literal("")),
  DATABASE_URL: isTest
    ? z.string().min(1).default("mysql://localhost:3306/test")
    : z.string().min(1, "DATABASE_URL is required"),
  OAUTH_SERVER_URL: z.string().url().optional().or(z.literal("")),
  OWNER_OPEN_ID: isTest
    ? z.string().min(1).default("test-user")
    : z.string().min(1, "OWNER_OPEN_ID is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BUILT_IN_FORGE_API_URL: z.string().url().optional().or(z.literal("")),
  BUILT_IN_FORGE_API_KEY: z.string().min(1).optional().or(z.literal("")),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  if (!isTest) {
    process.exit(1);
  }
}

const data = parsed.success ? parsed.data : (parsed.data ?? {} as any);

export const ENV = {
  appId: data.VITE_APP_ID,
  cookieSecret: data.JWT_SECRET,
  providerEncryptionSecret: data.PROVIDER_ENCRYPTION_SECRET || data.JWT_SECRET,
  databaseUrl: data.DATABASE_URL,
  oAuthServerUrl: data.OAUTH_SERVER_URL,
  ownerOpenId: data.OWNER_OPEN_ID,
  isProduction: data.NODE_ENV === "production",
  forgeApiUrl: data.BUILT_IN_FORGE_API_URL,
  forgeApiKey: data.BUILT_IN_FORGE_API_KEY,
};
