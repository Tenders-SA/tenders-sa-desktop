import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "./app/providers/AppProviders";
import { AppRoutes } from "./app/router/routes";
import { createAuthWiring } from "./app/auth-wiring";
import { loadConfig } from "./app/config/load-config";
import { markShellInteractive } from "./lib/performance";
import type { SessionSummary } from "./services/auth/ports";
import type { AuthWiring } from "./app/auth-wiring";
import {
  workspaceOwnerForSession,
  type WorkspaceOwnerId,
} from "./services/storage/workspace-owner";
import { WorkspaceRuntimeProvider } from "./services/storage/workspace-runtime";
import { WorkspaceSyncCoordinator } from "./services/sync/WorkspaceSyncCoordinator";

/**
 * Composition root.
 *
 * Authentication is on by default; `config.featureFlags.desktopAuth` remains a
 * kill switch for local work against a backend that is down.
 *
 * **Start-up cannot be allowed to fail silently.** `loadConfig` runs here at
 * module scope, before React mounts, so a throw produced a window that opened
 * and rendered nothing at all — no message, no error, just an empty frame. That
 * is what "the application is not running" looked like. `loadConfig` now
 * defaults every field so the normal path cannot throw, and the failure is
 * additionally *caught* below and rendered, so any future configuration
 * mistake reports itself instead of presenting a blank window.
 */
// `import.meta.env` is Vite's build-time env. `loadConfig` reads only a
// VITE_-prefixed allowlist from it (TASK-0.3), so nothing secret-shaped in
// the same .env file can reach the client config.
let config: ReturnType<typeof loadConfig> | undefined;
let configError: unknown;
try {
  config = loadConfig(import.meta.env as Record<string, string | undefined>);
} catch (error) {
  configError = error;
}

const wiring = config
  ? createAuthWiring({
      desktopAuthEnabled: config.featureFlags.desktopAuth,
      apiBaseUrl: config.apiBaseUrl,
    })
  : undefined;

/**
 * Shown when configuration could not be read.
 *
 * Deliberately plain: no Tailwind classes and no imports beyond React, because
 * whatever broke the config may also be a build problem, and this screen has to
 * render even then. It states the fault and where to fix it rather than
 * apologising — the person seeing this is the person who can act on it.
 */
function ConfigFailure({ error }: { error: unknown }) {
  const detail =
    error instanceof Error ? error.message : "Unknown configuration error.";
  return (
    <main
      role="alert"
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
        Tenders-SA Desktop could not start
      </h1>
      <p style={{ margin: "0 0 1rem" }}>
        Its configuration could not be read. Correct the values in the
        application&apos;s <code>.env</code> file and start it again.
      </p>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#f4f4f5",
          color: "#18181b",
          padding: "1rem",
          borderRadius: "0.25rem",
          overflowX: "auto",
        }}
      >
        {detail}
      </pre>
    </main>
  );
}

function App() {
  // Bail out before touching the wiring: without config there is nothing to
  // talk to, and a readable message beats an empty window.
  if (!wiring) return <ConfigFailure error={configError} />;

  return <AuthenticatedApp wiring={wiring} />;
}

function AuthenticatedApp({ wiring }: { wiring: AuthWiring }) {
  // The session itself, not a boolean: the header needs to name the account
  // it is offering to sign out of.
  const [session, setSession] = useState<SessionSummary | undefined>();
  const [workspaceOwner, setWorkspaceOwner] = useState<WorkspaceOwnerId>();
  const isAuthenticated = session !== undefined;

  useEffect(() => {
    markShellInteractive();
  }, []);

  useEffect(() => {
    // Any 401 on an authenticated route means the token is dead. Without
    // this the shell keeps believing it is signed in and the user reads
    // "sign in to Tenders-SA" on a screen that offers no way to do so.
    // The wiring has already cleared the keychain by the time this runs.
    return wiring.onSessionExpired(() => setSession(undefined));
    // `wiring` is a module-scope singleton, so this never re-subscribes; it is
    // listed to satisfy the exhaustive-deps rule honestly rather than by
    // suppressing it.
  }, [wiring]);

  useEffect(() => {
    let active = true;
    setWorkspaceOwner(undefined);
    if (session) {
      void workspaceOwnerForSession(session).then((owner) => {
        if (active) setWorkspaceOwner(owner);
      });
    }
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    // Restores a session on start-up, which also renews the token: `/me`
    // re-mints on every call and is the only renewal path. A failure here
    // is not fatal -- the user simply starts unauthenticated.
    let active = true;
    wiring.auth
      .restoreSession()
      .then((restored) => {
        if (active && restored) setSession(restored);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [wiring]);

  return (
    <AppProviders>
      <WorkspaceRuntimeProvider ownerId={workspaceOwner}>
        <WorkspaceSyncCoordinator
          ownerId={workspaceOwner}
          applications={wiring.applications}
        />
        <BrowserRouter>
          <AppRoutes
            auth={wiring.auth}
            isAuthenticated={isAuthenticated}
            // Unconditional, and the prop is required so it cannot become
            // conditional again: navigation advertises these screens, so their
            // routes have to exist even with no session. Each screen reports
            // the 401 as "sign in", which beats a link that quietly goes home.
            clients={wiring}
            onSignedIn={setSession}
            session={session}
            workspaceOwner={workspaceOwner}
            onSignOut={async () => {
              // `logout()` clears the keychain even if the remote call fails,
              // and deleting that entry IS the logout -- the parent does not
              // revoke. So the local session is dropped unconditionally: any
              // path that left it set would keep a signed-out user signed in.
              try {
                await wiring.auth.logout();
              } finally {
                setSession(undefined);
              }
            }}
          />
        </BrowserRouter>
      </WorkspaceRuntimeProvider>
    </AppProviders>
  );
}

export default App;
