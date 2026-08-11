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

/** What the desktop app does, in the user's terms. No numbers (R-V4). */
const CAPABILITIES = [
  "Radar scores every open tender against your company profile",
  "Deep-analyse tender documents and draft your response offline",
  "Package and export a complete submission",
];

export function SignInBrandPanel() {
  return (
    <div className="flex flex-col justify-center gap-8 p-10">
      <div className="flex items-center gap-3">
        <TendersMark />
        <p className="text-lg font-semibold text-foreground">
          Tenders-SA{" "}
          <span className="font-normal text-muted-foreground">Desktop</span>
        </p>
      </div>

      <div>
        <p className="max-w-sm text-2xl font-semibold leading-snug text-foreground">
          Your bid desk for South African public procurement
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Government, municipal and state-owned enterprise tenders, from the
          first match to the submitted response.
        </p>
      </div>

      <BidPipelineDiagram />

      <ul className="flex max-w-sm flex-col gap-2">
        {CAPABILITIES.map((capability) => (
          <li
            key={capability}
            className="flex gap-2 text-sm text-muted-foreground"
          >
            <span aria-hidden="true" className="text-primary">
              ·
            </span>
            {capability}
          </li>
        ))}
      </ul>
    </div>
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
