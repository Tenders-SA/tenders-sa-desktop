import { describe, expect, it } from "vitest";
import { FakeSqlExecutor } from "./fakes/sql-executor";
import { getCached, setCached } from "../services/storage/cache";
import type { NativeCrypto } from "../services/storage/native-crypto";
import type { CacheEntryRow } from "../db/schema/types";

function fakeCrypto(): NativeCrypto {
  return {
    encrypt: (value) => Promise.resolve(`enc:${value}`),
    decrypt: (value) => Promise.resolve(value.replace(/^enc:/, "")),
  };
}

describe("storage/cache", () => {
  it("stores non-sensitive values as plain payload", async () => {
    const db = new FakeSqlExecutor();
    const crypto = fakeCrypto();
    await setCached(db, crypto, "tender:1", '{"title":"Road works"}', {
      entityType: "tender",
      entityId: "1",
    });
    const { params } = db.calls[0];
    expect(params).toContain('{"title":"Road works"}');
    expect(params).toContain(0); // encrypted = 0
  });

  it("never lets a sensitive plaintext value reach the SQL params", async () => {
    const db = new FakeSqlExecutor();
    const crypto = fakeCrypto();
    const secret = "session-secret-do-not-persist-in-plaintext";

    await setCached(db, crypto, "session-cache", secret, {
      entityType: "session",
      entityId: "device",
      sensitive: true,
    });

    const { params } = db.calls[0];
    expect(params).not.toContain(secret);
    expect(params).toContain(`enc:${secret}`);
    expect(params).toContain(1); // encrypted = 1
  });

  it("decrypts a sensitive value on read", async () => {
    const db = new FakeSqlExecutor();
    const crypto = fakeCrypto();
    const row: CacheEntryRow = {
      key: "session-cache",
      entity_type: "session",
      entity_id: "device",
      etag: null,
      payload: "enc:top-secret",
      encrypted: 1,
      expires_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    db.selectResults = [[row]];

    const value = await getCached(db, crypto, "session-cache");
    expect(value).toBe("top-secret");
  });

  it("returns a non-sensitive value unchanged on read", async () => {
    const db = new FakeSqlExecutor();
    const crypto = fakeCrypto();
    const row: CacheEntryRow = {
      key: "tender:1",
      entity_type: "tender",
      entity_id: "1",
      etag: null,
      payload: "plain-value",
      encrypted: 0,
      expires_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    db.selectResults = [[row]];

    expect(await getCached(db, crypto, "tender:1")).toBe("plain-value");
  });

  it("returns undefined for a cache miss", async () => {
    const db = new FakeSqlExecutor();
    const crypto = fakeCrypto();
    db.selectResults = [[]];
    expect(await getCached(db, crypto, "missing")).toBeUndefined();
  });
});
