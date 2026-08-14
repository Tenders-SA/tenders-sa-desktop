import { AsyncSection } from "../../../components/common/AsyncSection";
import { WorkspaceDataStatus } from "../../../components/common/WorkspaceDataStatus";
import { useWorkspaceAsync } from "../../../hooks/use-workspace-async";
import {
  tenderDetailSchema,
  type TenderDetail,
  type TendersEndpoint,
} from "../../../services/api/endpoints/tenders";
import type { ApplicationDetail } from "../../../services/api/endpoints/applications";
import { workspaceEntityKey } from "../../../services/storage/cache-key";
import type { DocumentActionPort } from "../../../services/storage/document-actions";
import type { SaveDownloadPort } from "../../../services/storage/save-download";
import { TenderAnalysisWorkbench } from "../../tenders/detail/TenderAnalysisWorkbench";
import {
  TenderDocumentsSection,
  type TenderDocumentsSectionProps,
} from "../../tenders/detail/TenderDocumentsSection";
import { TenderIntelligenceOverview } from "../../tenders/detail/TenderIntelligenceOverview";

export interface UnderstandStageProps {
  tenderId: string;
  savedTender?: ApplicationDetail["tender"];
  tenders: Pick<TendersEndpoint, "get">;
  documents?: TenderDocumentsSectionProps["documents"];
  savePort?: SaveDownloadPort;
  documentActionPort?: DocumentActionPort;
}

/** Reads and presents the tender intelligence that already exists upstream. */
export function UnderstandStage({
  tenderId,
  savedTender,
  tenders,
  documents,
  savePort,
  documentActionPort,
}: UnderstandStageProps) {
  const state = useWorkspaceAsync({
    key: workspaceEntityKey("tender-detail", tenderId),
    schema: tenderDetailSchema,
    entity: "tender-detail",
    load: (signal) => tenders.get(tenderId, signal),
    deps: [tenders, tenderId],
  });
  const savedTenderDetail = toTenderDetail(savedTender);
  const visibleState =
    state.status === "ready" || !savedTenderDetail
      ? state
      : ({ status: "ready", value: savedTenderDetail } as const);

  return (
    <>
      {savedTenderDetail && (
        <WorkspaceDataStatus
          stale={state.stale || state.status !== "ready"}
          refreshing={state.refreshing}
          refreshFailed={state.refreshFailed || state.status === "error"}
          subject="saved tender analysis"
        />
      )}
      <AsyncSection
        state={visibleState}
        subject="this tender's analysis"
        onRetry={state.reload}
      >
        {(tender) => (
          <div className="min-w-0">
            <TenderIntelligenceOverview tender={tender} />
            <TenderAnalysisWorkbench tender={tender} />
            <TenderDocumentsSection
              tender={tender}
              documents={documents}
              savePort={savePort}
              documentActionPort={documentActionPort}
            />
          </div>
        )}
      </AsyncSection>
    </>
  );
}

function toTenderDetail(
  tender: ApplicationDetail["tender"] | undefined,
): TenderDetail | undefined {
  if (!tender) return undefined;
  const parsed = tenderDetailSchema.safeParse({
    ...tender,
    referenceNumber: tender.referenceNumber ?? "",
    sourceOrganization: tender.sourceOrganization ?? "",
    closingDate: tender.closingDate ?? "",
  });
  return parsed.success ? parsed.data : undefined;
}
