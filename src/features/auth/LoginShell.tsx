import { useId, useState, type FormEvent } from "react";
import {
  AuthError,
  type AuthFailureKind,
  type AuthPort,
  type SessionSummary,
} from "../../services/auth/ports";
import { SignInBrandPanel } from "./SignInBrandPanel";
import { SignInStatusFooter } from "./SignInStatusFooter";

export interface LoginShellProps {
  auth: AuthPort;
  /** Called once a session is established, so the shell can route on. */
  onSignedIn?: (session: SessionSummary) => void;
}

/**
 * Presentation for a failed sign-in.
 *
 * Each audited failure gets its own message and, where one exists, its own
 * *action*. That distinction is the point of TASK-2.5's extended union:
 * before it, `account-inactive` and `rate-limited` both surfaced as
 * "invalid credentials", which sends an unverified-email user to try
 * passwords that cannot work and invites a rate-limited user to spend
 * another attempt from an IP-keyed budget.
 */
function describeFailure(error: AuthError): {
  message: string;
  hint?: string;
} {
  const kind: AuthFailureKind = error.kind;

  switch (kind) {
    case "invalid-credentials":
      return { message: "Incorrect email or password." };

    case "account-inactive":
      return {
        message: "This account is not active yet.",
        hint: "Check your inbox for a verification email, or contact support.",
      };

    case "rate-limited": {
      const seconds = error.retryAfterSeconds;
      const wait =
        seconds === undefined
          ? "Please wait a few minutes before trying again."
          : `Please wait about ${formatWait(seconds)} before trying again.`;
      return { message: "Too many sign-in attempts.", hint: wait };
    }

    case "network":
      return {
        message: "Could not reach Tenders-SA.",
        hint: "Check your connection and try again.",
      };

    case "server-error":
      return {
        message: "Something went wrong on our side.",
        hint: "This is not a problem with your details. Please try again shortly.",
      };

    case "disabled":
    case "contract-unconfirmed":
      return { message: "Sign-in is not available in this build." };
  }
}

/** Rounds a Retry-After into something a person can act on. */
function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

/**
 * The authentication form (REQ-4, REQ-13; activated by TASK-2.7).
 *
 * When production auth is gated off, the form renders visibly disabled
 * rather than pretending to work -- presenting a functional-looking login
 * that cannot sign anyone in would misrepresent the build. The gate is
 * `GatedAuthService.isEnabled()`, which requires both the `desktopAuth`
 * flag and an audited adapter.
 *
 * Styling uses design-system tokens only (TASK-0.8): no raw colours.
 */
export function LoginShell({ auth, onSignedIn }: LoginShellProps) {
  const enabled = auth.isEnabled();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<
    { message: string; hint?: string } | undefined
  >();
  const [pending, setPending] = useState(false);

  const errorId = useId();
  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);
    setPending(true);
    try {
      const session = await auth.login({ email, password });
      // Clear the password from component state as soon as it is no longer
      // needed. It is never logged, and it never leaves this component.
      setPassword("");
      onSignedIn?.(session);
    } catch (caught) {
      setFailure(
        caught instanceof AuthError
          ? describeFailure(caught)
          : {
              message: "Sign in failed.",
              hint: "Please try again shortly.",
            },
      );
    } finally {
      setPending(false);
    }
  }

  const controlsDisabled = !enabled || pending;

  return (
    // Two columns (Slice 8, R-V1): the form first in the DOM so the first
    // Tab lands on the email field, and the brand column second — hidden
    // rather than squashed below `lg`, where the form is the whole point.
    <main className="flex min-h-screen bg-background">
      <div className="flex w-full flex-col justify-center p-6 lg:w-[26rem] lg:shrink-0 lg:border-r lg:border-border">
        <div className="mx-auto w-full max-w-sm rounded border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-card-foreground">
            Sign in to Tenders-SA
          </h1>

          {!enabled && (
            <p
              role="status"
              className="mt-3 rounded border border-border bg-muted p-3 text-sm text-muted-foreground"
            >
              Sign-in is not yet available in this build.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={emailId}
                className="text-sm font-medium text-card-foreground"
              >
                Email
              </label>
              <input
                id={emailId}
                type="email"
                autoComplete="username"
                value={email}
                disabled={controlsDisabled}
                aria-invalid={failure ? true : undefined}
                aria-describedby={failure ? errorId : undefined}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded border border-input bg-background px-3 py-2 text-foreground disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={passwordId}
                className="text-sm font-medium text-card-foreground"
              >
                Password
              </label>
              <input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={controlsDisabled}
                aria-invalid={failure ? true : undefined}
                aria-describedby={failure ? errorId : undefined}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded border border-input bg-background px-3 py-2 text-foreground disabled:opacity-60"
              />
            </div>

            {failure && (
              // `alert` announces without stealing focus, so a keyboard user
              // is not thrown out of the field they were correcting.
              <div role="alert" id={errorId} className="flex flex-col gap-1">
                <p className="text-sm font-medium text-destructive">
                  {failure.message}
                </p>
                {failure.hint && (
                  <p className="text-sm text-muted-foreground">
                    {failure.hint}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={controlsDisabled}
              className="rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <SignInStatusFooter />
        </div>
      </div>

      <div className="hidden flex-1 items-center bg-card lg:flex">
        <SignInBrandPanel />
      </div>
    </main>
  );
}
