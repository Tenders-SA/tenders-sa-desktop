import { AsyncSection } from "../../../components/common/AsyncSection";
import { WorkspaceDataStatus } from "../../../components/common/WorkspaceDataStatus";
import { useWorkspaceAsync } from "../../../hooks/use-workspace-async";
import {
  tenderDetailSchema,
  type TendersEndpoint,
} from "../../../services/api/endpoints/tenders";
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
  tenders: Pick<TendersEndpoint, "get">;
  documents?: TenderDocumentsSectionProps["documents"];
  savePort?: SaveDownloadPort;
  documentActionPort?: DocumentActionPort;
}

/** Reads and presents the tender intelligence that already exists upstream. */
export function UnderstandStage({
  tenderId,
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

  return (
    <>
      <WorkspaceDataStatus
        stale={state.stale}
        refreshing={state.refreshing}
        refreshFailed={state.refreshFailed}
        subject="saved tender analysis"
      />
      <AsyncSection
        state={state}
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
