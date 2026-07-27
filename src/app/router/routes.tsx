import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { CommandCentre } from "../../features/command-centre/CommandCentre";
import { LoginShell } from "../../features/auth/LoginShell";
import type { AuthPort } from "../../services/auth/ports";

export interface AppRoutesProps {
  auth: AuthPort;
  isAuthenticated: boolean;
}

export function AppRoutes({ auth, isAuthenticated }: AppRoutesProps) {
  // While production auth is gated off (TASK-0.9) no session can be
  // established, so the shell would otherwise be unreachable. This
  // flips to `false` the moment an audited auth contract ships.
  const allowUnauthenticated = !auth.isEnabled();

  return (
    <Routes>
      <Route path="/login" element={<LoginShell auth={auth} />} />

      <Route
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            allowUnauthenticated={allowUnauthenticated}
          />
        }
      >
        <Route element={<AppLayout />}>
          <Route index element={<CommandCentre />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
