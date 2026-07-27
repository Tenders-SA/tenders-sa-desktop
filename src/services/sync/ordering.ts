import type { SyncOperationRow } from "../../db/schema/types";

export class DependencyCycleError extends Error {
  constructor(ids: string[]) {
    super(`sync operations form a dependency cycle: ${ids.join(" -> ")}`);
    this.name = "DependencyCycleError";
  }
}

/**
 * Orders pending operations so an operation never runs before the one
 * it depends on (REQ-7). Operations whose dependency is still
 * unresolved are held back entirely rather than run out of order.
 *
 * A dependency that is already `complete` is satisfied. A dependency
 * that `failed`/`cancelled` blocks its dependents indefinitely --
 * running them would apply a mutation whose precondition never
 * happened.
 */
export function orderPendingOperations(
  pending: SyncOperationRow[],
  allById: Map<string, SyncOperationRow>,
): SyncOperationRow[] {
  const pendingIds = new Set(pending.map((op) => op.id));
  const ready: SyncOperationRow[] = [];
  const visiting = new Set<string>();
  const placed = new Set<string>();

  const isSatisfied = (dependencyId: string): boolean =>
    allById.get(dependencyId)?.status === "complete";

  const visit = (op: SyncOperationRow, path: string[]): boolean => {
    if (placed.has(op.id)) {
      return true;
    }
    if (visiting.has(op.id)) {
      throw new DependencyCycleError([...path, op.id]);
    }

    const dependencyId = op.depends_on;
    if (dependencyId) {
      if (!isSatisfied(dependencyId)) {
        const dependency = allById.get(dependencyId);
        // Blocked: the dependency is missing, failed, cancelled, or
        // not itself runnable in this pass.
        if (!dependency || !pendingIds.has(dependencyId)) {
          return false;
        }
        visiting.add(op.id);
        const dependencyReady = visit(dependency, [...path, op.id]);
        visiting.delete(op.id);
        if (!dependencyReady) {
          return false;
        }
      }
    }

    placed.add(op.id);
    ready.push(op);
    return true;
  };

  for (const op of [...pending].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )) {
    visit(op, []);
  }

  return ready;
}
