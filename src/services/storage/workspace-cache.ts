import type { ZodType, ZodTypeDef } from "zod";
import type { SqlExecutor } from "../../db/executor";
import { deleteCacheEntry } from "../../db/repositories/cache-entries";
import { getCached, setCached } from "./cache";
import type { CachePolicy, WorkspaceCacheEntity } from "./cache-policy";
import { WORKSPACE_CACHE_POLICIES } from "./cache-policy";
import type { NativeCrypto } from "./native-crypto";
import type { WorkspaceOwnerId } from "./workspace-owner";

interface CacheEnvelope<T> {
  cachedAt: string;
  value: T;
}

export interface WorkspaceCacheHit<T> {
  value: T;
  cachedAt: string;
  stale: boolean;
}

export class WorkspaceCache {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly crypto: NativeCrypto,
    readonly ownerId: WorkspaceOwnerId,
    private readonly now: () => number = Date.now,
  ) {}

  async read<T>(
    key: string,
    schema: ZodType<T, ZodTypeDef, unknown>,
    entity: WorkspaceCacheEntity,
  ): Promise<WorkspaceCacheHit<T> | undefined> {
    try {
      const payload = await getCached(this.sql, this.crypto, this.ownerId, key);
      if (!payload) return undefined;
      const parsed = JSON.parse(payload) as Partial<CacheEnvelope<unknown>>;
      if (typeof parsed.cachedAt !== "string")
        throw new Error("Invalid cache timestamp");
      const cachedAtMs = Date.parse(parsed.cachedAt);
      if (!Number.isFinite(cachedAtMs))
        throw new Error("Invalid cache timestamp");
      const value = schema.parse(parsed.value);
      const policy = WORKSPACE_CACHE_POLICIES[entity];
      if (this.now() - cachedAtMs > policy.retainForMs) {
        await this.remove(key);
        return undefined;
      }
      return {
        value,
        cachedAt: parsed.cachedAt,
        stale: this.now() - cachedAtMs > policy.staleAfterMs,
      };
    } catch {
      await this.remove(key);
      return undefined;
    }
  }

  async write<T>(
    key: string,
    value: T,
    entity: WorkspaceCacheEntity,
    policy: CachePolicy = WORKSPACE_CACHE_POLICIES[entity],
  ): Promise<void> {
    const cachedAt = new Date(this.now()).toISOString();
    await setCached(
      this.sql,
      this.crypto,
      this.ownerId,
      key,
      JSON.stringify({ cachedAt, value } satisfies CacheEnvelope<T>),
      {
        entityType: entity,
        entityId: key,
        sensitive: true,
        expiresAt: new Date(this.now() + policy.retainForMs).toISOString(),
      },
    );
  }

  remove(key: string): Promise<void> {
    return deleteCacheEntry(this.sql, this.ownerId, key);
  }
}
