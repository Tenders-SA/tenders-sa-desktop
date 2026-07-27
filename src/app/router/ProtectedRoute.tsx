import { Navigate, Outlet } from "react-router-dom";

export interface ProtectedRouteProps {
  /**
   * Whether a session exists. While TASK-0.9's auth gate is closed no
   * session can be established, so the shell would be unreachable --
   * hence `allowUnauthenticated` below.
   */
  isAuthenticated: boolean;
  /**
   * Development escape hatch, on only while production auth is gated
   * off (REQ-4). It keeps the Phase 0 shell reviewable and testable
   * without weakening anything: authorization is server-enforced
   * (SEC-3), and no real data is reachable until an audited auth
   * contract exists. It MUST become false the moment auth ships.
   */
  allowUnauthenticated: boolean;
  redirectTo?: string;
}

export function ProtectedRoute({
  isAuthenticated,
  allowUnauthenticated,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  if (!isAuthenticated && !allowUnauthenticated) {
    return <Navigate to={redirectTo} replace />;
  }
  return <Outlet />;
}
