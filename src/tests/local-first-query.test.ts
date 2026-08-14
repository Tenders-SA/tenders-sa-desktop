import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LocalFirstQueryClient } from "../services/storage/local-first-query";
import { WorkspaceCache } from "../services/storage/workspace-cache";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import { assertWorkspaceOwner } from "../services/storage/workspace-owner";

describe("LocalFirstQueryClient", () => {
  it("returns a fresh cached value without waiting for the network", async () => {
    const cache = {
      read: vi.fn(async () => ({
        value: { title: "Saved tender" },
        cachedAt: "2026-08-14T00:00:00.000Z",
        stale: false,
      })),
      write: vi.fn(),
    } as unknown as WorkspaceCache;
    const fetcher = vi.fn();
    const result = await new LocalFirstQueryClient(cache).load({
      key: "tender:1",
      schema: z.object({ title: z.string() }),
      entity: "tender-detail",
      fetcher,
    });
    expect(result.value.title).toBe("Saved tender");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns stale data immediately and deduplicates its background refresh", async () => {
    let resolveRemote: ((value: { title: string }) => void) | undefined;
    const cache = {
      read: vi.fn(async () => ({
        value: { title: "Saved tender" },
        cachedAt: "2026-08-14T00:00:00.000Z",
        stale: true,
      })),
      write: vi.fn(async () => undefined),
    } as unknown as WorkspaceCache;
    const fetcher = vi.fn(
      () =>
        new Promise<{ title: string }>((resolve) => {
          resolveRemote = resolve;
        }),
    );
    const client = new LocalFirstQueryClient(cache);
    const updates: string[] = [];
    const options = {
      key: "tender:1",
      schema: z.object({ title: z.string() }),
      entity: "tender-detail" as const,
      fetcher,
      onUpdate: (value: { title: string }) => updates.push(value.title),
    };
    const [first, second] = await Promise.all([
      client.load(options),
      client.load(options),
    ]);
    expect(first.value.title).toBe("Saved tender");
    expect(second.value.title).toBe("Saved tender");
    expect(fetcher).toHaveBeenCalledOnce();
    resolveRemote?.({ title: "Fresh tender" });
    await vi.waitFor(() =>
      expect(updates).toEqual(["Fresh tender", "Fresh tender"]),
    );
    expect(cache.write).toHaveBeenCalledOnce();
  });

  it("falls back to a stale value when a forced refresh fails", async () => {
    const cache = {
      read: vi.fn(async () => ({
        value: "saved",
        cachedAt: "now",
        stale: true,
      })),
      write: vi.fn(),
    } as unknown as WorkspaceCache;
    const result = await new LocalFirstQueryClient(cache).load({
      key: "list",
      schema: z.string(),
      entity: "tender-list",
      force: true,
      fetcher: () => Promise.reject(new Error("offline")),
    });
    expect(result.value).toBe("saved");
    expect(result.refreshError).toBeInstanceOf(Error);
    expect(result.refreshing).toBe(false);
  });

  it("prefixes persisted keys so two owners cannot replace one primary-key row", async () => {
    const db = new FakeSqlExecutor();
    const crypto = {
      encrypt: async (value: string) => `enc:${value}`,
      decrypt: async (value: string) => value.replace(/^enc:/, ""),
    };
    const ownerA = assertWorkspaceOwner(`v1-${"a".repeat(64)}`);
    const ownerB = assertWorkspaceOwner(`v1-${"b".repeat(64)}`);

    await new WorkspaceCache(db, crypto, ownerA).write(
      "tender:1",
      { title: "A" },
      "tender-detail",
    );
    await new WorkspaceCache(db, crypto, ownerB).write(
      "tender:1",
      { title: "B" },
      "tender-detail",
    );

    expect(db.calls[0].params[0]).toBe(`${ownerA}:tender:1`);
    expect(db.calls[1].params[0]).toBe(`${ownerB}:tender:1`);
  });
});
