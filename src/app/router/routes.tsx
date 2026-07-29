import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { CommandCentre } from "../../features/command-centre/CommandCentre";
import { LoginShell } from "../../features/auth/LoginShell";
import type { AuthPort } from "../../services/auth/ports";
import type { SubscriptionEndpoint } from "../../services/api/endpoints/subscription";
import type { TendersEndpoint } from "../../services/api/endpoints/tenders";
import { TenderList } from "../../features/tenders/TenderList";

export interface AppRoutesProps {
  auth: AuthPort;
  isAuthenticated: boolean;
  /**
   * Supplied only once a session exists. Absent while gated, so the
   * Command Centre renders no plan panel rather than an empty one.
   */
  subscription?: SubscriptionEndpoint;
  tenders?: TendersEndpoint;
  onSignedIn?: () => void;
}

export function AppRoutes({
  auth,
  isAuthenticated,
  subscription,
  tenders,
  onSignedIn,
}: AppRoutesProps) {
  // While production auth is gated off no session can be established, so
  // the shell would otherwise be unreachable. Derived from the gate rather
  // than hard-coded, so it turns itself OFF the moment auth goes live --
  // TASK-2.10 supplies an audited adapter, so this now depends purely on
  // the `desktopAuth` flag. A test pins that it is false when auth is
  // enabled, because leaving it open would be an unauthenticated bypass of
  // every protected route.
  const allowUnauthenticated = !auth.isEnabled();

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginShell auth={auth} onSignedIn={onSignedIn} />}
      />

      <Route
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            allowUnauthenticated={allowUnauthenticated}
          />
        }
      >
        <Route element={<AppLayout />}>
          <Route
            index
            element={<CommandCentre subscriptionEndpoint={subscription} />}
          />
          {tenders && (
            <Route path="tenders" element={<TenderList endpoint={tenders} />} />
          )}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
