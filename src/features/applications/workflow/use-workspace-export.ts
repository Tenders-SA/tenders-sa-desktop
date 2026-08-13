import { useState } from "react";
import { ApiError } from "../../../services/api/errors";
import { describeApiError } from "../../../services/api/describe-error";
import type {
  ExportPackageFormat,
  ApplicationsEndpoint,
} from "../../../services/api/endpoints/applications";
import {
  createTauriSavePort,
  saveDownload,
  type SaveDownloadPort,
} from "../../../services/storage/save-download";

export function useWorkspaceExport(
  endpoint: Pick<ApplicationsEndpoint, "exportWorkspacePackage">,
  applicationId: string,
  savePort: SaveDownloadPort = createTauriSavePort(),
) {
  const [state, setState] = useState<"idle" | "exporting" | "error">("idle");
  const [error, setError] = useState<string>();

  async function exportPackage(format: ExportPackageFormat): Promise<void> {
    setState("exporting");
    setError(undefined);
    try {
      const result = await endpoint.exportWorkspacePackage(
        applicationId,
        format,
      );
      await saveDownload(savePort, result);
      setState("idle");
    } catch (cause) {
      setState("error");
      setError(describeWorkspaceExportError(cause));
      throw cause;
    }
  }

  return { state, error, exportPackage };
}

function describeWorkspaceExportError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409)
    return "Generate your proposal documents before exporting.";
  if (
    !(error instanceof ApiError) ||
    error.kind === "server" ||
    error.kind === "offline" ||
    error.kind === "timeout"
  )
    return "Could not export right now.";
  return describeApiError(error, "the export").message;
}
