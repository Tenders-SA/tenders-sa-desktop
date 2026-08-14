import type { ZodType, ZodTypeDef } from "zod";
import type { WorkspaceCacheEntity } from "./cache-policy";
import type { WorkspaceCache, WorkspaceCacheHit } from "./workspace-cache";

export type LocalFirstSnapshot<T> =
  | { status: "loading" }
  | {
      status: "ready";
      value: T;
      source: "local" | "remote";
      stale: boolean;
      refreshing: boolean;
      refreshError?: unknown;
    }
  | { status: "error"; error: unknown };

export class LocalFirstQueryClient {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly cache: WorkspaceCache) {}

  async cached<T>(
    key: string,
    schema: ZodType<T, ZodTypeDef, unknown>,
    entity: WorkspaceCacheEntity,
  ) {
    return this.cache.read(key, schema, entity);
  }

  refresh<T>(
    key: string,
    schema: ZodType<T, ZodTypeDef, unknown>,
    entity: WorkspaceCacheEntity,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const request = fetcher()
      .then(async (value) => {
        const validated = schema.parse(value);
        await this.cache.write(key, validated, entity);
        return validated;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  async load<T>(options: {
    key: string;
    schema: ZodType<T, ZodTypeDef, unknown>;
    entity: WorkspaceCacheEntity;
    fetcher: () => Promise<T>;
    force?: boolean;
    onUpdate?: (value: T) => void;
    onRefreshError?: (error: unknown) => void;
  }): Promise<{
    cached?: WorkspaceCacheHit<T>;
    value: T;
    refreshing: boolean;
    refreshError?: unknown;
  }> {
    const cached = await this.cached(
      options.key,
      options.schema,
      options.entity,
    );
    if (cached && !options.force && !cached.stale) {
      return { cached, value: cached.value, refreshing: false };
    }
    if (cached && !options.force) {
      void this.refresh(
        options.key,
        options.schema,
        options.entity,
        options.fetcher,
      )
        .then((value) => options.onUpdate?.(value))
        .catch((error: unknown) => options.onRefreshError?.(error));
      return { cached, value: cached.value, refreshing: true };
    }
    try {
      const value = await this.refresh(
        options.key,
        options.schema,
        options.entity,
        options.fetcher,
      );
      return { cached, value, refreshing: false };
    } catch (error) {
      if (cached) {
        return {
          cached,
          value: cached.value,
          refreshing: false,
          refreshError: error,
        };
      }
      throw error;
    }
  }
}
