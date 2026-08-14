import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { ApiClients } from "../../app/auth-wiring";
import type { TenderDetail } from "../../services/api/endpoints/tenders";
import { describeTenderError } from "./tender-errors";
import { TenderDocumentViewer } from "./TenderDocumentViewer";

type State =
  | { status: "loading" }
  | { status: "ready"; tender: TenderDetail }
  | { status: "error"; message: string };

export function TenderDocumentViewerRoute({
  clients,
}: {
  clients: ApiClients;
}) {
  const { tenderId, documentId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!tenderId) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    clients.tenders
      .get(tenderId, controller.signal)
      .then((tender) => setState({ status: "ready", tender }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            message: describeTenderError(error, "this tender").message,
          });
        }
      });
    return () => controller.abort();
  }, [clients.tenders, tenderId]);

  if (!tenderId || !documentId) return <Navigate to="/tenders" replace />;
  if (state.status === "loading")
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading tender document…
      </div>
    );
  if (state.status === "error")
    return (
      <p role="alert" className="p-6 text-sm text-destructive">
        {state.message}
      </p>
    );
  return (
    <TenderDocumentViewer
      tender={state.tender}
      selectedDocumentId={documentId}
      endpoint={clients.documents}
      onBack={() => navigate(`/tenders/${encodeURIComponent(tenderId)}`)}
      onSelectDocument={(id) =>
        navigate(
          `/tenders/${encodeURIComponent(tenderId)}/documents/${encodeURIComponent(id)}`,
        )
      }
    />
  );
}
