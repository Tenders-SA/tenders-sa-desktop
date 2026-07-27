import { invoke } from "@tauri-apps/api/core";

/**
 * Bridge to the native encrypt_value/decrypt_value commands (TASK-0.4).
 * Kept as an injectable interface, like SqlExecutor, so storage-layer
 * logic is testable without a live Tauri IPC runtime.
 */
export interface NativeCrypto {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

export const tauriNativeCrypto: NativeCrypto = {
  encrypt: (value: string) => invoke<string>("encrypt_value", { value }),
  decrypt: (value: string) => invoke<string>("decrypt_value", { value }),
};
