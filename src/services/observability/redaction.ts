/**
 * Redaction for structured logs (REQ-8, PRIV-1, OPS-1).
 *
 * The rule this implements is "redact by default": a field is kept
 * only when its key is on a small allowlist of known-safe operational
 * keys, OR its value survives value-level scrubbing. That direction
 * matters -- a denylist of "sensitive" key names silently leaks every
 * field nobody thought of, and this app handles tender pricing,
 * document content, and personal data where the cost of a miss is
 * real.
 */

export const REDACTED = "[redacted]";

export type RedactionMode = "strict" | "standard";

/**
 * Keys safe to log verbatim. Deliberately short and operational: IDs,
 * status, timing, and error classification -- never payload content.
 */
const SAFE_KEYS = new Set([
  "appVersion",
  "environment",
  "attempt",
  "attemptCount",
  "code",
  "correlationId",
  "durationMs",
  "entityType",
  "event",
  "kind",
  "level",
  "message",
  "operationId",
  "operationType",
  "requestId",
  "route",
  "status",
  "statusCode",
  "timestamp",
]);

/**
 * Keys whose values are always dropped regardless of mode, because
 * nothing about them is safe at any verbosity.
 */
const ALWAYS_REDACT =
  /token|password|secret|credential|authorization|api[-_]?key|passphrase|private[-_]?key/i;

/** Value-level patterns that indicate sensitive content. */
const VALUE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bBearer\s+\S+/i, // bearer tokens
  /\beyJ[\w-]*\.[\w-]*\.[\w-]*/, // JWT
  /\btsa_(?:prod|test)_\w+/i, // Tenders-SA API keys
  /[\w.+-]+@[\w-]+\.[\w.]+/, // email addresses
  /\b\d{13}\b/, // SA ID numbers
  /\b(?:R|ZAR)\s?\d[\d\s,.]*/i, // rand amounts
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // card-like numbers
];

export function redactString(value: string): string {
  return VALUE_PATTERNS.reduce(
    (acc, pattern) => acc.replace(new RegExp(pattern, "gi"), REDACTED),
    value,
  );
}

function isSafeKey(key: string): boolean {
  return SAFE_KEYS.has(key) && !ALWAYS_REDACT.test(key);
}

/**
 * Redacts an arbitrary value for logging.
 *
 * - `strict` (the default, and what production uses): every key not on
 *   the safe list is dropped to `[redacted]`, whatever its value.
 * - `standard`: unknown keys keep scrubbed primitive values, which is
 *   more useful while debugging locally but must not be the production
 *   default.
 */
export function redact(
  value: unknown,
  mode: RedactionMode = "strict",
  depth = 0,
): unknown {
  if (depth > 6) {
    return REDACTED;
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return redactString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, mode, depth + 1));
  }
  if (value instanceof Error) {
    // Only the class name survives: an error message can quote a
    // response body, a pricing figure, or a filesystem path.
    return { name: value.name, message: REDACTED };
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as object)) {
      if (ALWAYS_REDACT.test(key)) {
        output[key] = REDACTED;
      } else if (isSafeKey(key)) {
        output[key] =
          typeof item === "string"
            ? redactString(item)
            : redact(item, mode, depth + 1);
      } else if (mode === "standard") {
        output[key] = redact(item, mode, depth + 1);
      } else {
        output[key] = REDACTED;
      }
    }
    return output;
  }
  return REDACTED;
}
