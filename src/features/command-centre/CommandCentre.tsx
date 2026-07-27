/**
 * Command Centre placeholder (REQ-2).
 *
 * The brief describes this as the post-login default screen with
 * deadline, readiness, and pipeline widgets. None of that data exists
 * in Phase 0, so this deliberately shows an empty state that says so,
 * rather than mock widgets that would read as working features.
 */
export function CommandCentre() {
  return (
    <section aria-labelledby="command-centre-heading" className="max-w-2xl">
      <h1
        id="command-centre-heading"
        className="text-xl font-semibold text-foreground"
      >
        Command Centre
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This is the Phase 0 application shell. Dashboard widgets, tender data,
        and workspace features arrive in later, separately approved phases.
      </p>

      <div className="mt-6 rounded border border-border bg-card p-6">
        <h2 className="text-sm font-medium text-card-foreground">
          Nothing to show yet
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No tenders, deadlines, or applications are loaded, because no data
          source is connected in this build.
        </p>
      </div>
    </section>
  );
}
