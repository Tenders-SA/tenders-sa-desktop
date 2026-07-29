/**
 * User-facing copy for a failed parent read.
 *
 * Refs: REQ-A8, A11Y-A1
 *
 * The component layer owns all user-facing wording — settled in Phase 2 after
 * the adapter and the login shell both tried to produce it. This is that one
 * place, so two screens cannot describe the same failure differently.
 *
 * `ApiError.message` is deliberately **not** shown. It is safe to log, but it
 * is drawn from the server's own `error` string, which is written for
 * developers ("Company profile required", "Invalid token") and reads as
 * gibberish to a bidder. Each kind gets copy that says what to do instead.
 */

import { ApiError } from "./errors";

export interface DescribedError {
  message: string;
  kind: string;
  /** Whether offering "Try again" is honest. It is not, for a 401 or a 403. */
  retryable: boolean;
}

/**
 * @param subject What could not be loaded, lower case and usually plural —
 *   "tenders", "your deadlines", "this application".
 */
export function describeApiError(
  error: unknown,
  subject: string,
): DescribedError {
  if (!(error instanceof ApiError)) {
    return {
      message: `Could not load ${subject}.`,
      kind: "unknown",
      retryable: true,
    };
  }

  switch (error.kind) {
    case "unauthorized":
      // Covers "never signed in" and "session expired" alike: signing in is
      // the action either way, so this stays true without the caller needing
      // to know which happened.
      return {
        message: `Sign in to Tenders-SA to see ${subject}.`,
        kind: error.kind,
        retryable: false,
      };

    case "forbidden":
      return {
        message: `Your plan does not include ${subject}.`,
        kind: error.kind,
        retryable: false,
      };

    case "not-found":
      return {
        message: `${capitalise(subject)} could not be found.`,
        kind: error.kind,
        retryable: false,
      };

    case "validation":
      // The parent returns 400 "Company profile required" on several
      // company-scoped routes. That is the single most likely 400 a real user
      // hits, and it has a specific fix, so it is worth naming.
      return {
        message: `Add your company profile to see ${subject}.`,
        kind: error.kind,
        retryable: false,
      };

    case "rate-limited": {
      const wait = describeWait(error.retryAfterSeconds);
      return {
        message: wait
          ? `Too many requests. Try again in ${wait}.`
          : "Too many requests. Wait a moment and try again.",
        kind: error.kind,
        retryable: false,
      };
    }

    case "offline":
    case "timeout":
      return {
        message: "Could not reach Tenders-SA.",
        kind: error.kind,
        retryable: true,
      };

    case "malformed":
      // The parent contract moved. Saying so beats an empty screen, and it is
      // the signal a maintainer needs.
      return {
        message: `${capitalise(subject)} could not be read in a format this version understands.`,
        kind: error.kind,
        retryable: false,
      };

    default:
      return {
        message: `Could not load ${subject} right now.`,
        kind: error.kind,
        retryable: true,
      };
  }
}

/**
 * A wait a person can act on: "13 minutes", not "742 seconds".
 *
 * The parent's limiter is IP-keyed at 10 attempts per 15 minutes and is not
 * reset on success, so the real wait can be long and must be stated honestly
 * rather than inviting an immediate retry that spends another attempt.
 */
export function describeWait(seconds: number | undefined): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }
  if (seconds < 60) {
    const whole = Math.ceil(seconds);
    return `${whole} ${whole === 1 ? "second" : "seconds"}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
