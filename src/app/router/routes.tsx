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
import type { SubscriptionEndpoint } from "../../services/api/endpoints/subscription";
import type { TendersEndpoint } from "../../services/api/endpoints/tenders";
import { TenderList } from "../../features/tenders/TenderList";
import { TenderDetail } from "../../features/tenders/TenderDetail";

export interface AppRoutesProps {
  auth: AuthPort;
  isAuthenticated: boolean;
  /**
   * Supplied only once a session exists. Absent while gated, so the
   * Command Centre renders no plan panel rather than an empty one.
   */
  subscription?: SubscriptionEndpoint;
  /**
   * **Required**, unlike `subscription`, and that is the whole point.
   *
   * Navigation advertises Tender Radar as available, so its route must
   * exist in every build. It first shipped as optional and supplied only
   * when a session existed, which meant that in a gated build the link fell
   * through to the catch-all and silently redirected home -- the dishonest
   * affordance REQ-16 exists to prevent. Making it required moves that from
   * something a test has to notice to something that will not compile.
   *
   * Constructing the endpoint costs nothing without a session: with no
   * token the read fails 401 and the screen says to sign in, which is true
   * and actionable.
   */
  tenders: TendersEndpoint;
  onSignedIn?: (session: SessionSummary) => void;
  /**
   * The signed-in account, for the header's sign-out control. Absent in a
   * gated build, where no session can exist.
   */
  session?: SessionSummary;
  onSignOut?: () => Promise<void>;
}

/** Reads `:id` from the URL so the screen itself stays router-agnostic. */
function TenderDetailRoute({ endpoint }: { endpoint: TendersEndpoint }) {
  const { tenderId } = useParams();
  const navigate = useNavigate();

  // Cannot happen through the route table, but a missing param must not
  // reach the endpoint as "undefined".
  if (!tenderId) return <Navigate to="/tenders" replace />;

  return (
    <TenderDetail
      endpoint={endpoint}
      tenderId={tenderId}
      onBack={() => navigate("/tenders")}
    />
  );
}

function TenderListRoute({ endpoint }: { endpoint: TendersEndpoint }) {
  const navigate = useNavigate();
  return (
    <TenderList
      endpoint={endpoint}
      onOpenTender={(id) => navigate(`/tenders/${encodeURIComponent(id)}`)}
    />
  );
}

export function AppRoutes({
  auth,
  isAuthenticated,
  subscription,
  tenders,
  onSignedIn,
  session,
  onSignOut,
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
        <Route element={<AppLayout session={session} onSignOut={onSignOut} />}>
          <Route
            index
            element={<CommandCentre subscriptionEndpoint={subscription} />}
          />
          <Route
            path="tenders"
            element={<TenderListRoute endpoint={tenders} />}
          />
          <Route
            path="tenders/:tenderId"
            element={<TenderDetailRoute endpoint={tenders} />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
