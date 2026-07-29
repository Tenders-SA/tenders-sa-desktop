import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "./app/providers/AppProviders";
import { AppRoutes } from "./app/router/routes";
import { createAuthWiring } from "./app/auth-wiring";
import { loadConfig } from "./app/config/load-config";
import { markShellInteractive } from "./lib/performance";

/**
 * Composition root (TASK-2.10).
 *
 * An audited adapter is now supplied, so `GatedAuthService.isEnabled()`
 * depends purely on the `desktopAuth` flag -- which makes that flag
 * load-bearing for the first time. Enabling it is gate G3; pointing the
 * client at a production origin is gate G5.
 */
// `import.meta.env` is Vite's build-time env. `loadConfig` reads only a
// VITE_-prefixed allowlist from it (TASK-0.3), so nothing secret-shaped in
// the same .env file can reach the client config.
const config = loadConfig(
  import.meta.env as Record<string, string | undefined>,
);
const wiring = createAuthWiring({
  desktopAuthEnabled: config.featureFlags.desktopAuth,
  apiBaseUrl: config.apiBaseUrl,
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    markShellInteractive();
  }, []);

  useEffect(() => {
    // Restores a session on start-up, which also renews the token: `/me`
    // re-mints on every call and is the only renewal path. A failure here
    // is not fatal -- the user simply starts unauthenticated.
    let active = true;
    wiring.auth
      .restoreSession()
      .then((session) => {
        if (active && session) setIsAuthenticated(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes
          auth={wiring.auth}
          isAuthenticated={isAuthenticated}
          subscription={isAuthenticated ? wiring.subscription : undefined}
          // Unconditional, and the prop is required so it cannot become
          // conditional again: navigation advertises Tender Radar, so the
          // route has to exist even with no session. The screen reports the
          // 401 as "sign in", which beats a link that quietly goes home.
          tenders={wiring.tenders}
          onSignedIn={() => setIsAuthenticated(true)}
        />
      </BrowserRouter>
    </AppProviders>
  );
}

export default App;
