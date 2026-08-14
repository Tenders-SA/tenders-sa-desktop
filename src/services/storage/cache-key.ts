function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function workspaceQueryKey(
  endpoint: string,
  query: Record<string, unknown>,
): string {
  return `${endpoint}:${JSON.stringify(stableValue(query))}`;
}

export function workspaceEntityKey(entity: string, id: string): string {
  return `${entity}:${encodeURIComponent(id)}`;
}
