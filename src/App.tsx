import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "./app/providers/AppProviders";
import { AppRoutes } from "./app/router/routes";
import { GatedAuthService } from "./services/auth/gated-auth-service";
import { nativeCredentialStore } from "./services/auth/native-credential-store";
import { markShellInteractive } from "./lib/performance";

// No audited adapter is supplied: production authentication stays
// gated until TASK-1.3 confirms the native contract (REQ-4).
const auth = new GatedAuthService({
  enabled: false,
  credentialStore: nativeCredentialStore,
});

function App() {
  useEffect(() => {
    markShellInteractive();
  }, []);

  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes auth={auth} isAuthenticated={false} />
      </BrowserRouter>
    </AppProviders>
  );
}

export default App;
