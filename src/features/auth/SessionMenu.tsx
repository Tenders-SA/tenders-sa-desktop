import { useState } from "react";
import type { SessionSummary } from "../../services/auth/ports";

export interface SessionMenuProps {
  session: SessionSummary;
  /**
   * Performs the sign-out. Resolves once the local credential has been
   * cleared; see the note below on why it is not allowed to reject in a way
   * that leaves the user signed in.
   */
  onSignOut: () => Promise<void>;
}

/**
 * Who is signed in, and the way out.
 *
 * **Signing out matters more here than in the web app.** The parent does not
 * revoke tokens -- there is no denylist, no `tokenVersion`, and no
 * revocation endpoint -- so a keychain-held token stays valid for up to
 * seven days (`docs/architecture/auth.md` §4). Deleting the keychain entry
 * *is* the logout. Without this control a session on a shared machine
 * outlives the person who started it, which is why this ships with the first
 * authenticated screens rather than as later polish.
 *
 * `GatedAuthService.logout()` clears locally even when the remote call
 * fails, so this component never leaves the user signed in on an error. It
 * therefore reports no failure state: there is nothing actionable to say,
 * and "sign-out failed" would be untrue.
 */
export function SessionMenu({ session, onSignOut }: SessionMenuProps) {
  const [signingOut, setSigningOut] = useState(false);

  // The email is the identity the parent authenticated; `displayName` is
  // cosmetic and may be absent.
  const name = session.displayName?.trim() || session.email;

  return (
    <div className="flex items-center gap-3" aria-label="Signed-in account">
      <span className="max-w-[16rem] truncate text-sm text-foreground">
        {name}
      </span>
      {/* Shown only when it adds information the name does not. */}
      {name !== session.email && (
        <span className="sr-only">{session.email}</span>
      )}
      <button
        type="button"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true);
          // Deliberately not reset on success: the component unmounts as
          // the shell drops to unauthenticated. Resetting would flash the
          // enabled button during teardown.
          onSignOut().catch(() => setSigningOut(false));
        }}
        className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
