import { describe, expect, it } from "vitest";
import {
  assertWorkspaceOwner,
  workspaceOwnerForSession,
} from "../services/storage/workspace-owner";

describe("workspace owner identity", () => {
  it("is stable and path-safe without exposing the raw user ID", async () => {
    const first = await workspaceOwnerForSession({
      userId: "user/a@example.test",
    });
    const again = await workspaceOwnerForSession({
      userId: "user/a@example.test",
    });
    expect(first).toBe(again);
    expect(first).toMatch(/^v1-[a-f0-9]{64}$/);
    expect(first).not.toContain("user");
    expect(first).not.toContain("@");
    expect(first).not.toContain("/");
  });

  it("isolates different user IDs", async () => {
    await expect(workspaceOwnerForSession({ userId: "a" })).resolves.not.toBe(
      await workspaceOwnerForSession({ userId: "b" }),
    );
  });

  it("rejects unsafe caller-created owner identifiers", () => {
    expect(() => assertWorkspaceOwner("../another-user")).toThrow();
  });
});
