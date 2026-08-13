import { ApiError } from "../../../services/api/errors";
import { describeApiError } from "../../../services/api/describe-error";

/**
 * Single owner of the response-document authoring surfaces' status labels and
 * generate-error copy (Slice 8, RH-4). Both the full-screen editor and the
 * inline row import these so the two surfaces cannot drift again.
 *
 * Component-owned copy only: `ApiError.message`, the parent's `blockedReason`
 * and the stored generation `error` string are never shown verbatim
 * (describe-error docblock, REQ-8).
 */

/** The status fields the blueprint GET exposes per document key. */
export interface ResponseDocStatusSummary {
  state?: string;
  error?: string;
  isFallback?: boolean;
  unresolvedPlaceholders?: string[];
}

/** The single source of truth for what state a response document is in. */
export function classifyResponseDoc(
  status: ResponseDocStatusSummary | undefined,
  hasContent: boolean,
): "generating" | "failed" | "saved" | "template" | "not-started" {
  if (status?.state === "generating") return "generating";
  if (status?.state === "failed") return "failed";
  if (hasContent || status?.state === "ready") {
    return status?.isFallback ? "template" : "saved";
  }
  return "not-started";
}

/** Inline chip (row) for a document's state. */
export function docStatusChip(
  status: ResponseDocStatusSummary | undefined,
  hasContent: boolean,
): { label: string; className: string } | undefined {
  switch (classifyResponseDoc(status, hasContent)) {
    case "generating":
      return {
        label: "Generating…",
        className: "text-xs text-muted-foreground",
      };
    case "failed":
      return { label: "Failed", className: "text-xs text-destructive" };
    case "template":
      return { label: "Saved · template", className: "text-xs text-success" };
    case "saved":
      return { label: "Saved", className: "text-xs text-success" };
    default:
      return undefined;
  }
}

/** Single-word label (navigator) for a document's state. */
export function docStatusLabel(
  status: ResponseDocStatusSummary | undefined,
  hasContent: boolean,
): string {
  switch (classifyResponseDoc(status, hasContent)) {
    case "generating":
      return "Generating";
    case "failed":
      return "Failed";
    case "template":
      return "Saved · template";
    case "saved":
      return "Saved";
    default:
      return "Not started";
  }
}

/**
 * Generate/Regenerate failure copy. A 409 `PRECONDITIONS_NOT_MET` is the
 * parent's only hard generation blocker (unfilled required additional info) —
 * the parent's `blockedReason` is its own prose and is never shown verbatim.
 * Every other failure (a 402 `SUBSCRIPTION_REQUIRED` reads "…needs a paid
 * plan.") goes through `describeApiError`.
 */
export function describeGenerateError(error: unknown): string {
  if (error instanceof ApiError && error.code === "PRECONDITIONS_NOT_MET") {
    return "Complete the required additional information before generating.";
  }
  return describeApiError(error, "this document").message;
}
