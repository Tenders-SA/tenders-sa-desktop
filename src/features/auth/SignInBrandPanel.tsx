/**
 * The sign-in screen's brand column (R-V1, R-V3, R-V4).
 *
 * States what this application is and what it does, and nothing else. In
 * particular it states **no quantity**: there is no session on this screen,
 * so there is no data, and a tender count or a customer count here would be
 * a number nobody measured. `login-shell.test.tsx` asserts the absence.
 *
 * It also contains no focusable element. That is deliberate rather than
 * incidental: the sign-in screen's first Tab must land on the email field,
 * and a decorative link ahead of it would put a marketing detour between
 * the user and the thing they came to do.
 */

import { BidPipelineDiagram } from "./BidPipelineDiagram";

/** The focused jobs this workspace supports. No numbers (R-V4). */
const WORKSPACE_JOBS = [
  {
    label: "Qualify the opportunity",
    description:
      "Prioritise tenders that fit your company profile and capacity.",
  },
  {
    label: "Build a compliant response",
    description:
      "Review requirements, close readiness gaps and prepare bid documents.",
  },
  {
    label: "Stay submission-ready",
    description:
      "Keep deadlines, working files and the final response package together.",
  },
];

export function SignInBrandPanel() {
  return (
    <section className="relative flex h-full w-full items-center overflow-hidden px-10 py-12 xl:px-16">
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-info/10 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-4xl">
        <header className="flex items-center justify-between gap-6 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded border border-primary/30 bg-primary/10">
              <TendersMark />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight text-foreground">
                Tenders-SA
              </p>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Desktop bid workspace
              </p>
            </div>
          </div>

          <p className="rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Focused tender preparation
          </p>
        </header>

        <div className="py-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            From opportunity to submission
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-foreground xl:text-4xl">
            Prepare stronger tender responses in one focused workspace.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Built for South African businesses that need to evaluate an
            opportunity, understand the requirements and assemble a professional
            response—without the distractions of the wider platform.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-5 shadow-2xl shadow-background/40">
          <div className="mb-2 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-foreground">
              Your tender response workflow
            </p>
            <p className="text-xs text-muted-foreground">
              Clear progress. Controlled preparation.
            </p>
          </div>
          <BidPipelineDiagram />
        </div>

        <ul className="mt-5 grid gap-3 xl:grid-cols-3">
          {WORKSPACE_JOBS.map((job) => (
            <li
              key={job.label}
              className="rounded-lg border border-border bg-card/70 p-4"
            >
              <span
                aria-hidden="true"
                className="mb-3 block h-1 w-8 rounded-full bg-primary"
              />
              <p className="text-sm font-semibold text-foreground">
                {job.label}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {job.description}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-6 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          A dedicated working environment connected to your Tenders-SA account.
          Your final submission remains under your team&apos;s control.
        </p>
      </div>
    </section>
  );
}

/**
 * The product mark: a document outline with an upward stroke through it.
 *
 * Inline SVG because the CSP forbids remote images, and drawn from tokens
 * because everything visual in this application is.
 */
function TendersMark() {
  return (
    <svg
      aria-hidden="true"
      width={28}
      height={28}
      viewBox="0 0 28 28"
      fill="none"
    >
      <rect
        x={4.5}
        y={2.5}
        width={19}
        height={23}
        rx={3}
        stroke="hsl(var(--primary))"
        strokeWidth={2}
      />
      <path
        d="M9 18.5 L13 13 L16.5 16 L21 8.5"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
