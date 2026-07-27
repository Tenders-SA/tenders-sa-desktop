import { useState, type FormEvent } from "react";
import { AuthError, type AuthPort } from "../../services/auth/ports";

export interface LoginShellProps {
  auth: AuthPort;
}

/**
 * The authentication interface shell (REQ-4, REQ-13).
 *
 * When production auth is gated off -- which is the case today, and
 * stays so until TASK-1.3 confirms the native contract -- the form
 * renders in a visibly disabled state rather than pretending to work.
 * Presenting a functional-looking login that cannot log anyone in
 * would misrepresent a later phase as implemented.
 *
 * Styling uses design-system tokens only (TASK-0.8): no raw colours.
 */
export function LoginShell({ auth }: LoginShellProps) {
  const enabled = auth.isEnabled();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    try {
      await auth.login({ email, password });
    } catch (caught) {
      setError(
        caught instanceof AuthError
          ? caught.message
          : "Sign in failed. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded border border-border bg-card p-6">
        <h1 className="text-xl font-semibold text-card-foreground">
          Sign in to Tenders-SA
        </h1>

        {!enabled && (
          <p
            role="status"
            className="mt-3 rounded border border-border bg-muted p-3 text-sm text-muted-foreground"
          >
            Sign-in is not yet available in this build. It stays disabled until
            the native authentication contract is confirmed.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-card-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              disabled={!enabled || pending}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded border border-input bg-background px-3 py-2 text-foreground disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-card-foreground"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={!enabled || pending}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded border border-input bg-background px-3 py-2 text-foreground disabled:opacity-60"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!enabled || pending}
            className="rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
