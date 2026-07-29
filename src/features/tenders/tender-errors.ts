/**
 * User-facing copy for tender read failures.
 *
 * Refs: REQ-A8, A11Y-A1
 *
 * The component owns all user-facing wording, never the adapter — settled in
 * Phase 2 after the adapter and the login shell both tried to produce it.
 * Kept in one module so the list and the detail screen cannot drift into
 * describing the same failure two different ways.
 */

import { ApiError } from "../../services/api/errors";

export interface DescribedError {
  message: string;
  kind: string;
}

/**
 * @param subject What could not be loaded, lower case — "tenders", "this
 *   tender". Interpolated into the generic messages.
 */
export function describeTenderError(
  error: unknown,
  subject: string,
): DescribedError {
  if (!(error instanceof ApiError)) {
    return { message: `Could not load ${subject}.`, kind: "unknown" };
  }
  switch (error.kind) {
    case "unauthorized":
      // Covers both "never signed in" and "session expired". Signing in is
      // the action in either case, so this stays accurate without the
      // component needing to know which one happened.
      return {
        message: `Sign in to Tenders-SA to view ${subject}.`,
        kind: error.kind,
      };
    case "forbidden":
      return {
        message: `Your plan does not include access to ${subject}.`,
        kind: error.kind,
      };
    case "not-found":
      return { message: "This tender no longer exists.", kind: error.kind };
    case "offline":
    case "timeout":
      return { message: "Could not reach Tenders-SA.", kind: error.kind };
    case "rate-limited":
      return {
        message: "Too many requests. Wait a moment and try again.",
        kind: error.kind,
      };
    case "malformed":
      // A shape this build cannot parse. Saying so beats an empty screen,
      // and it is the signal that the parent contract moved.
      return {
        message: `${capitalise(subject)} could not be read in a format this version understands.`,
        kind: error.kind,
      };
    default:
      // Deliberately phrased so it reads correctly for both a plural
      // subject ("tenders") and a singular one ("this tender").
      return {
        message: `Could not load ${subject} right now.`,
        kind: error.kind,
      };
  }
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
