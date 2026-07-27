import { loadConfig } from "./load-config";

export { ConfigError } from "./load-config";
export type { RawEnv } from "./load-config";
export type { AppConfig } from "./schema";

export const config = loadConfig(import.meta.env);
