import { invoke } from "@tauri-apps/api/core";
import type { SessionCredentialStore } from "./ports";

/**
 * Credential store backed by the OS keychain through TASK-0.4's
 * native commands. Tokens cross the IPC boundary but are never
 * persisted on the webview side -- no localStorage, no Zustand, no
 * SQLite column (SEC-2, PRIV-1).
 *
 * `SessionKey` here must stay in sync with the closed enum in
 * src-tauri/src/commands/session.rs; the native side rejects anything
 * outside it.
 */
type SessionKey = "access_token" | "refresh_token";

async function store(key: SessionKey, value: string): Promise<void> {
  await invoke("session_store", { key, value });
}

async function load(key: SessionKey): Promise<string | undefined> {
  return (await invoke<string | null>("session_load", { key })) ?? undefined;
}

async function clear(key: SessionKey): Promise<void> {
  await invoke("session_clear", { key });
}

export const nativeCredentialStore: SessionCredentialStore = {
  async save(accessToken, refreshToken) {
    await store("access_token", accessToken);
    if (refreshToken) {
      await store("refresh_token", refreshToken);
    }
  },

  loadAccessToken() {
    return load("access_token");
  },

  async clear() {
    // Both keys are cleared even if one is absent: the native command
    // treats deleting a missing entry as success, so logout is
    // idempotent and cannot leave a stale refresh token behind.
    await clear("access_token");
    await clear("refresh_token");
  },
};
