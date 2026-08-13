import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AsyncSection } from "../../../components/common/AsyncSection";
import { useAsync } from "../../../hooks/use-async";
import type { ApiClients } from "../../../app/auth-wiring";
import { decodeDraftDocumentKey } from "./document-route";
import { DraftStage } from "./DraftStage";

export function ResponseDocumentWorkbench({
  clients,
}: {
  clients: ApiClients;
}) {
  const { applicationId, documentKey } = useParams();
  const navigate = useNavigate();
  const state = useAsync(
    (signal) =>
      applicationId
        ? clients.applications.get(applicationId, signal)
        : Promise.reject(new Error("Missing application id")),
    [clients.applications, applicationId],
  );

  if (!applicationId) return <Navigate to="/applications" replace />;

  return (
    <main
      id="main-content"
      className="h-screen min-h-0 bg-background text-foreground"
    >
      <AsyncSection
        state={state}
        subject="this application"
        onRetry={state.reload}
      >
        {(application) => (
          <DraftStage
            applicationId={applicationId}
            documentKey={decodeDraftDocumentKey(documentKey)}
            endpoint={clients.applications}
            tenderDocuments={application.tender.documents}
            documentsEndpoint={clients.documents}
            onNavigate={(url) => navigate(url)}
          />
        )}
      </AsyncSection>
    </main>
  );
}
