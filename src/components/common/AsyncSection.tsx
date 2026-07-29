import type { ReactNode } from "react";
import type { AsyncState } from "../../hooks/use-async";
import { describeApiError } from "../../services/api/describe-error";

export interface AsyncSectionProps<T> {
  state: AsyncState<T>;
  /** What could not be loaded, lower case — "your deadlines", "documents". */
  subject: string;
  /** Rendered when the load succeeded. */
  children: (value: T) => ReactNode;
  /** Shown instead of `children` when the value is empty. */
  empty?: ReactNode;
  /** Decides emptiness. Defaults to "an empty array". */
  isEmpty?: (value: T) => boolean;
  onRetry?: () => void;
}

/**
 * Renders the four states of a parent read consistently.
 *
 * Refs: REQ-A8, A11Y-A1, REL-A1
 *
 * Loading carries `role="status"` and errors carry `role="alert"`, so a
 * screen reader is told what changed rather than being left to discover it.
 * `data-error-kind` is on the alert for tests and support, never the raw
 * error, which can carry request detail.
 *
 * A schema-validation failure lands here as an ordinary error rather than a
 * crash, which is the point: when the parent contract moves, the screen says
 * so instead of showing a white page.
 */
export function AsyncSection<T>({
  state,
  subject,
  children,
  empty,
  isEmpty,
  onRetry,
}: AsyncSectionProps<T>) {
  if (state.status === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading {subject}…
      </p>
    );
  }

  if (state.status === "error") {
    const described = describeApiError(state.error, subject);
    return (
      <div role="alert" data-error-kind={described.kind}>
        <p className="text-sm text-destructive">{described.message}</p>
        {onRetry && described.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded border border-border px-3 py-1.5 text-sm text-foreground"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const blank = isEmpty
    ? isEmpty(state.value)
    : Array.isArray(state.value) && state.value.length === 0;

  if (blank && empty !== undefined) {
    return <>{empty}</>;
  }

  return <>{children(state.value)}</>;
}

export interface PanelProps {
  title: string;
  /** Rendered to the right of the title — a count, a link, an action. */
  aside?: ReactNode;
  children: ReactNode;
}

/** A titled dashboard card. Kept dumb so panels differ only in content. */
export function Panel({ title, aside, children }: PanelProps) {
  return (
    <section className="rounded border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-card-foreground">{title}</h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
