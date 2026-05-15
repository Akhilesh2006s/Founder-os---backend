import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("5000"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET is required"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("30d"),
  /** Primary + extra allowed browser origins for CORS (comma-separated URLs, no trailing slash). */
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  /**
   * Extra CORS hosts: comma-separated suffixes without scheme, e.g. `akhilesh2006s-projects.vercel.app`
   * matches `https://any-preview--xxx.akhilesh2006s-projects.vercel.app` so you don't list every preview URL.
   */
  CLIENT_ORIGIN_SUFFIXES: z.string().optional().default(""),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  PORT: Number(parsed.data.PORT)
};

/** Parsed from CLIENT_ORIGIN for CORS; supports `https://a.com,http://localhost:3000`. */
export const clientOrigins = parsed.data.CLIENT_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Hostname suffix match for Vercel team previews (`*.YOUR-team.vercel.app`). */
export const clientOriginSuffixes = (parsed.data.CLIENT_ORIGIN_SUFFIXES ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** For CORS: exact allowlist plus optional suffix allowlist */
export function isOriginAllowed(origin) {
  if (!origin) return true;
  if (clientOrigins.includes(origin)) return true;
  try {
    const { protocol, hostname } = new URL(origin);
    const host = hostname.toLowerCase();
    if (protocol !== "https:" && protocol !== "http:") return false;
    for (const suffix of clientOriginSuffixes) {
      const s = suffix.toLowerCase();
      if (!s) continue;
      if (host === s || host.endsWith(`.${s}`)) return true;
    }

    /**
     * Vercel production aliases use `https://<project>-<slug>.vercel.app` — they do NOT share the same
     * hostname suffix as preview URLs (`*.team-hash.vercel.app`). Allow any `*.vercel.app` over HTTPS
     * unless CLIENT_ORIGIN_STRICT=true (e.g. private API locked to CLIENT_ORIGIN / suffix list only).
     */
    const strictOnly = /^true$/i.test(process.env.CLIENT_ORIGIN_STRICT ?? "");
    if (!strictOnly && protocol === "https:" && host.endsWith(".vercel.app")) {
      return true;
    }
  } catch {
    /* invalid URL */
  }
  return false;
}
