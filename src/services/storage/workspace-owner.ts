import type { SessionSummary } from "../auth/ports";

export type WorkspaceOwnerId = string & {
  readonly __workspaceOwner: unique symbol;
};

/**
 * Stable, path-safe pseudonymous workspace owner. Email and credentials never
 * participate; a version prefix permits a future derivation migration.
 */
export async function workspaceOwnerForSession(
  session: Pick<SessionSummary, "userId">,
): Promise<WorkspaceOwnerId> {
  const canonical = session.userId.trim();
  if (!canonical) throw new Error("A signed-in user ID is required");
  const bytes = new TextEncoder().encode(
    `tenders-sa-workspace:v1:${canonical}`,
  );
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `v1-${hex}` as WorkspaceOwnerId;
}

export function assertWorkspaceOwner(value: string): WorkspaceOwnerId {
  if (!/^v1-[a-f0-9]{64}$/.test(value)) {
    throw new Error("Invalid workspace owner identifier");
  }
  return value as WorkspaceOwnerId;
}
