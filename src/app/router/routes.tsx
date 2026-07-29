import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { CommandCentre } from "../../features/command-centre/CommandCentre";
import { LoginShell } from "../../features/auth/LoginShell";
import type { AuthPort, SessionSummary } from "../../services/auth/ports";
import type { ApiClients } from "../auth-wiring";
import { TenderList } from "../../features/tenders/TenderList";
import { TenderDetail } from "../../features/tenders/TenderDetail";
import { TenderActions } from "../../features/tenders/TenderActions";
import { TenderRadar } from "../../features/radar/TenderRadar";
import { Opportunities } from "../../features/opportunities/Opportunities";
import { ApplicationList } from "../../features/applications/ApplicationList";
import { ApplicationWorkspace } from "../../features/applications/ApplicationWorkspace";
import { CompanyProfileScreen } from "../../features/company/CompanyProfile";
import { DocumentVault } from "../../features/documents/DocumentVault";
import { NotificationsScreen } from "../../features/notifications/Notifications";
import { Calendar } from "../../features/calendar/Calendar";

export interface AppRoutesProps {
  auth: AuthPort;
  isAuthenticated: boolean;
  /**
   * **Required.** Every route the navigation advertises must exist in every
   * build, or the link falls through to the catch-all and silently redirects
   * home -- the dishonest affordance REQ-16 exists to prevent. Making this
   * required means a conditional cannot come back without a type error.
   *
   * Constructing the clients costs nothing without a session: with no token
   * each read fails 401, the screen says to sign in, and that is both true
   * and actionable.
   */
  clients: ApiClients;
  onSignedIn?: (session: SessionSummary) => void;
  /** The signed-in account, for the header's sign-out control. */
  session?: SessionSummary;
  onSignOut?: () => Promise<void>;
}

/** Reads `:tenderId` so the screen itself stays router-agnostic. */
function TenderDetailRoute({ clients }: { clients: ApiClients }) {
  const { tenderId } = useParams();
  const navigate = useNavigate();
  if (!tenderId) return <Navigate to="/tenders" replace />;
  return (
    <TenderDetail
      endpoint={clients.tenders}
      tenderId={tenderId}
      onBack={() => navigate("/tenders")}
      actions={
        <TenderActions
          tenderId={tenderId}
          eligibility={clients.eligibility}
          savedTenders={clients.savedTenders}
          applications={clients.applications}
        />
      }
    />
  );
}

function TenderListRoute({ clients }: { clients: ApiClients }) {
  const navigate = useNavigate();
  return (
    <TenderList
      endpoint={clients.tenders}
      onOpenTender={(id) => navigate(`/tenders/${encodeURIComponent(id)}`)}
    />
  );
}

function ApplicationWorkspaceRoute({ clients }: { clients: ApiClients }) {
  const { applicationId } = useParams();
  if (!applicationId) return <Navigate to="/applications" replace />;
  return (
    <ApplicationWorkspace
      endpoint={clients.applications}
      applicationId={applicationId}
    />
  );
}

export function AppRoutes({
  auth,
  isAuthenticated,
  clients,
  onSignedIn,
  session,
  onSignOut,
}: AppRoutesProps) {
  // While production auth is gated off no session can be established, so the
  // shell would otherwise be unreachable. Derived from the gate rather than
  // hard-coded, so it turns itself OFF the moment auth goes live.
  const allowUnauthenticated = !auth.isEnabled();

  return (
    <Routes>
      {/*
        A signed-in user is sent into the app rather than shown the form.
        `/login` sits outside the protected route, so without this a
        successful login left the user looking at the same form they had just
        submitted. Expressed as a redirect rather than an imperative
        `navigate()` so it also covers a session restored from the keychain at
        start-up.
      */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <LoginShell auth={auth} onSignedIn={onSignedIn} />
          )
        }
      />

      <Route
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            allowUnauthenticated={allowUnauthenticated}
          />
        }
      >
        <Route element={<AppLayout session={session} onSignOut={onSignOut} />}>
          <Route
            index
            element={
              <CommandCentre clients={isAuthenticated ? clients : undefined} />
            }
          />

          <Route
            path="radar"
            element={<TenderRadar endpoint={clients.recommendations} />}
          />
          <Route
            path="tenders"
            element={<TenderListRoute clients={clients} />}
          />
          <Route
            path="tenders/:tenderId"
            element={<TenderDetailRoute clients={clients} />}
          />
          <Route
            path="opportunities"
            element={<Opportunities endpoint={clients.savedTenders} />}
          />
          <Route
            path="applications"
            element={<ApplicationList endpoint={clients.applications} />}
          />
          <Route
            path="applications/:applicationId"
            element={<ApplicationWorkspaceRoute clients={clients} />}
          />
          <Route
            path="calendar"
            element={<Calendar endpoint={clients.planner} />}
          />
          <Route
            path="company"
            element={<CompanyProfileScreen endpoint={clients.company} />}
          />
          <Route
            path="documents"
            element={<DocumentVault endpoint={clients.documents} />}
          />
          <Route
            path="notifications"
            element={<NotificationsScreen endpoint={clients.notifications} />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
