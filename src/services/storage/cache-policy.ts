export type WorkspaceCacheEntity =
  | "tender-list"
  | "radar-list"
  | "tender-detail"
  | "application-list"
  | "application-detail"
  | "application-workspace"
  | "response-blueprint";

export interface CachePolicy {
  staleAfterMs: number;
  retainForMs: number;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

export const WORKSPACE_CACHE_POLICIES: Readonly<
  Record<WorkspaceCacheEntity, CachePolicy>
> = {
  "tender-list": { staleAfterMs: 20 * MINUTE, retainForMs: 7 * DAY },
  "radar-list": { staleAfterMs: 20 * MINUTE, retainForMs: 7 * DAY },
  "tender-detail": { staleAfterMs: 30 * MINUTE, retainForMs: 30 * DAY },
  "application-list": { staleAfterMs: 10 * MINUTE, retainForMs: 30 * DAY },
  "application-detail": { staleAfterMs: 10 * MINUTE, retainForMs: 90 * DAY },
  "application-workspace": { staleAfterMs: 10 * MINUTE, retainForMs: 90 * DAY },
  "response-blueprint": { staleAfterMs: 10 * MINUTE, retainForMs: 90 * DAY },
};
