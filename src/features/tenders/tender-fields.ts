/**
 * Defensive readers for the tender fields whose runtime type is unknown.
 *
 * Refs: INT-A2, REL-A1
 *
 * `requirements`, `eligibilityCriteria`, and `bbbeeRequirements` are typed
 * `unknown` in `endpoints/tenders.ts` for a reason recorded as audit gap
 * E-11: the list route returns them **raw** while the detail route passes
 * them through the parent's `parseJsonField`. So the same field arrives as a
 * JSON string on one route and as an array or object on the other, and there
 * is no schema that could narrow it honestly.
 *
 * Rather than guess, everything funnels through `describeJsonField`, which
 * returns display lines for the shapes actually observed and `null` for
 * anything it cannot read. `null` means the section is omitted entirely --
 * an empty heading would imply the tender has no requirements, which is a
 * different and much worse claim than saying nothing.
 */

/** Beyond this, a pathological payload is truncated rather than rendered. */
const MAX_ITEMS = 50;

/**
 * `minLevel` -> "Min level". Sentence case, matching every other label on
 * the screen, so a server-supplied key does not stand out as title case.
 *
 * An all-uppercase word is left alone, because "SARS" must not become
 * "Sars". A run-together acronym like `BBBEELevel` has no word boundary to
 * find and is not worth guessing at.
 */
function humaniseKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => (word === word.toUpperCase() ? word : word.toLowerCase()));

  if (words.length === 0) return key;
  const [first, ...rest] = words;
  const lead = first === first.toUpperCase() ? first : capitalise(first);
  return [lead, ...rest].join(" ");
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A single scalar, or null when there is nothing worth showing. */
function describeLeaf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

function describeEntries(value: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    // A nested array reads better flattened onto its key than as JSON.
    if (Array.isArray(entry)) {
      const inner = entry.map(describeLeaf).filter((l): l is string => !!l);
      if (inner.length > 0) {
        lines.push(`${humaniseKey(key)}: ${inner.join(", ")}`);
      }
      continue;
    }
    const leaf = describeLeaf(entry);
    if (leaf !== null) lines.push(`${humaniseKey(key)}: ${leaf}`);
  }
  return lines;
}

/**
 * Turns an unknown-typed tender field into display lines.
 *
 * Returns `null` when the value carries no readable content, so callers can
 * omit the section rather than render an empty one.
 */
export function describeJsonField(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;

  // A JSON string is what the LIST route hands back for these fields. It is
  // parsed here rather than assumed, because a plain prose string is also a
  // legitimate value and must not be mangled.
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return describeJsonField(JSON.parse(trimmed));
      } catch {
        // Not JSON after all. Fall through and show the raw text: a
        // malformed payload is still information the user can read.
      }
    }
    return truncate([trimmed]);
  }

  if (Array.isArray(value)) {
    const lines: string[] = [];
    for (const entry of value) {
      if (
        entry !== null &&
        typeof entry === "object" &&
        !Array.isArray(entry)
      ) {
        lines.push(...describeEntries(entry as Record<string, unknown>));
        continue;
      }
      const leaf = describeLeaf(entry);
      if (leaf !== null) lines.push(leaf);
    }
    return lines.length > 0 ? truncate(lines) : null;
  }

  if (typeof value === "object") {
    const lines = describeEntries(value as Record<string, unknown>);
    return lines.length > 0 ? truncate(lines) : null;
  }

  const leaf = describeLeaf(value);
  return leaf === null ? null : [leaf];
}

function truncate(lines: string[]): string[] {
  if (lines.length <= MAX_ITEMS) return lines;
  const hidden = lines.length - MAX_ITEMS;
  return [
    ...lines.slice(0, MAX_ITEMS),
    `…and ${hidden} more ${hidden === 1 ? "item" : "items"} not shown`,
  ];
}
