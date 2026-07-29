import { z } from "zod";

/**
 * Hostnames treated as local development.
 *
 * Exported so `load-config.ts` infers the environment from the same set that
 * validates the URL. Two copies would eventually disagree, and the failure
 * would be a config that validates but is labelled the wrong environment.
 */
export const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function isHttpsOrLocalHttp(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") {
    return true;
  }
  return parsed.protocol === "http:" && LOCAL_HOSTNAMES.has(parsed.hostname);
}

export const appConfigSchema = z
  .object({
    environment: z.enum(["development", "staging", "production"]),
    apiBaseUrl: z.string().url(),
    allowedOrigins: z.array(z.string().url()).min(1),
    featureFlags: z.object({
      // Production native authentication stays disabled until the Phase 1
      // auth/subscription contract (TASK-1.3) is accepted. See design.md
      // "Authentication Design Gate".
      desktopAuth: z.boolean(),
    }),
    telemetry: z.object({
      enabled: z.boolean(),
      redactionMode: z.enum(["strict", "standard"]),
    }),
    // Updater configuration placeholder (REQ-3, SEC-4): the public key
    // verifies signed update metadata. Signing secrets are CI-only and
    // never enter this (or any client-readable) configuration.
    update: z.object({
      channel: z.enum(["stable", "beta"]),
      publicKey: z.string().min(1),
    }),
    request: z.object({
      timeoutMs: z.number().int().positive(),
      maxSafeRetries: z.number().int().nonnegative(),
    }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.environment === "production" &&
      !value.apiBaseUrl.startsWith("https://")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiBaseUrl"],
        message: "apiBaseUrl must use https:// in the production environment",
      });
    }
    if (!isHttpsOrLocalHttp(value.apiBaseUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiBaseUrl"],
        message:
          "apiBaseUrl must be https://, or http:// on localhost/127.0.0.1 for local development",
      });
    }
  });

export type AppConfig = z.infer<typeof appConfigSchema>;
