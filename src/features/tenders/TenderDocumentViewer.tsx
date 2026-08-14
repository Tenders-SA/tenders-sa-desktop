import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { TenderDetail } from "../../services/api/endpoints/tenders";
import type { DownloadResult } from "../../services/api/transport";
import { describeApiError } from "../../services/api/describe-error";
import { DocumentDownloadButton } from "./DocumentDownloadButton";
import { describeJsonField } from "./tender-fields";
import { readableTenderDocumentName } from "./document-label";
import { useWorkspaceRuntime } from "../../services/storage/workspace-runtime-context";
import { ApiError } from "../../services/api/errors";
import { logger } from "../../services/observability";

type Document = NonNullable<TenderDetail["documents"]>[number];

export interface TenderDocumentViewerProps {
  tender: TenderDetail;
  selectedDocumentId: string;
  endpoint: {
    downloadTenderDocument(
      id: string,
      signal?: AbortSignal,
    ): Promise<DownloadResult>;
  };
  onSelectDocument(id: string): void;
  onBack(): void;
}

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; result: DownloadResult }
  | { status: "error"; message: string };

export function TenderDocumentViewer({
  tender,
  selectedDocumentId,
  endpoint,
  onSelectDocument,
  onBack,
}: TenderDocumentViewerProps) {
  const documents = tender.documents ?? [];
  const selected = documents.find((item) => item.id === selectedDocumentId);
  const [documentsVisible, setDocumentsVisible] = useState(true);
  const [analysisVisible, setAnalysisVisible] = useState(true);
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const workspace = useWorkspaceRuntime();

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setPreview({ status: "loading" });
    const download = () =>
      endpoint.downloadTenderDocument(selected.id, controller.signal);
    const request = workspace
      ? workspace.documents.open(tender.id, selected, download)
      : download();
    request
      .then((result) => setPreview({ status: "ready", result }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          logger.error("tender.document.open.failed", {
            tenderId: tender.id,
            documentId: selected.id,
            errorKind: error instanceof ApiError ? error.kind : "unknown",
            errorName: error instanceof Error ? error.name : typeof error,
            errorMessage:
              error instanceof Error ? error.message : "non-error rejection",
          });
          setPreview({
            status: "error",
            message: describeApiError(error, "this tender document").message,
          });
        }
      });
    return () => controller.abort();
  }, [endpoint, selected, tender.id, workspace]);

  if (!selected) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-8 text-center">
        <div>
          <AlertCircle
            className="mx-auto size-8 text-destructive"
            aria-hidden="true"
          />
          <h1 className="mt-3 text-lg font-semibold">Document not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This document is not attached to the selected tender.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 rounded-md border border-border px-3 py-2 text-sm"
          >
            Back to tender
          </button>
        </div>
      </div>
    );
  }

  const name = readableTenderDocumentName(selected.fileName);
  return (
    <section
      className="flex h-[calc(100vh-4rem)] min-h-0 flex-col bg-background"
      aria-label="Tender document viewer"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to tender"
          title="Back to tender"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {tender.title}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDocumentsVisible((value) => !value)}
          className="rounded-md p-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${documentsVisible ? "Hide" : "Show"} documents`}
          title={`${documentsVisible ? "Hide" : "Show"} documents`}
        >
          {documentsVisible ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeftOpen className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setAnalysisVisible((value) => !value)}
          className="rounded-md p-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${analysisVisible ? "Hide" : "Show"} analysis`}
          title={`${analysisVisible ? "Hide" : "Show"} analysis`}
        >
          {analysisVisible ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </button>
        <DocumentDownloadButton
          endpoint={endpoint}
          documentId={selected.id}
          showOpen={false}
          compact
        />
      </header>

      <div
        className={`grid min-h-0 flex-1 ${documentsVisible && analysisVisible ? "lg:grid-cols-[15rem_minmax(0,1fr)_20rem]" : documentsVisible ? "lg:grid-cols-[15rem_minmax(0,1fr)]" : analysisVisible ? "lg:grid-cols-[minmax(0,1fr)_20rem]" : "grid-cols-1"}`}
      >
        {documentsVisible && (
          <DocumentRail
            documents={documents}
            selectedId={selected.id}
            onSelect={onSelectDocument}
          />
        )}
        <main
          className="min-h-0 overflow-hidden bg-muted/20"
          aria-label="Original document"
        >
          {preview.status === "loading" && (
            <div className="grid h-full place-items-center">
              <LoaderCircle
                className="size-7 animate-spin text-primary"
                aria-label="Loading document"
              />
            </div>
          )}
          {preview.status === "error" && (
            <div className="grid h-full place-items-center p-8">
              <p
                role="alert"
                className="max-w-md text-center text-sm text-destructive"
              >
                {preview.message}
              </p>
            </div>
          )}
          {preview.status === "ready" &&
            (isPdf(preview.result, selected) ? (
              <PdfPreview bytes={preview.result.bytes} />
            ) : (
              <UnsupportedPreview
                name={name}
                contentType={preview.result.contentType ?? selected.mimeType}
                endpoint={endpoint}
                documentId={selected.id}
              />
            ))}
        </main>
        {analysisVisible && <AnalysisPanel document={selected} />}
      </div>
    </section>
  );
}

function DocumentRail({
  documents,
  selectedId,
  onSelect,
}: {
  documents: Document[];
  selectedId: string;
  onSelect(id: string): void;
}) {
  return (
    <aside
      className="min-h-0 overflow-y-auto border-r border-border bg-card/60 p-3"
      aria-label="Tender documents"
    >
      <h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Documents
      </h2>
      <div className="space-y-1">
        {documents.map((document) => (
          <button
            key={document.id}
            type="button"
            onClick={() => onSelect(document.id)}
            aria-current={document.id === selectedId ? "page" : undefined}
            title={document.fileName ?? undefined}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${document.id === selectedId ? "bg-muted text-foreground" : "text-muted-foreground"}`}
          >
            <FileText className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {readableTenderDocumentName(document.fileName)}
            </span>
            <StatusIcon status={document.processingStatus} />
          </button>
        ))}
      </div>
    </aside>
  );
}

function StatusIcon({ status }: { status?: string }) {
  const normalized = status?.toLowerCase();
  if (normalized === "failed" || normalized === "error")
    return (
      <AlertCircle
        className="size-4 shrink-0 text-destructive"
        aria-label="Analysis failed"
      />
    );
  if (["processing", "pending", "queued"].includes(normalized ?? ""))
    return (
      <LoaderCircle
        className="size-4 shrink-0 animate-spin text-primary"
        aria-label="Analysis processing"
      />
    );
  if (
    ["complete", "completed", "processed", "success"].includes(normalized ?? "")
  )
    return (
      <CheckCircle2
        className="size-4 shrink-0 text-success"
        aria-label="Analysis complete"
      />
    );
  return (
    <Circle className="size-4 shrink-0" aria-label="Analysis not started" />
  );
}

function AnalysisPanel({ document }: { document: Document }) {
  const analyses = document.analyses ?? [];
  const fields: Array<[string, Array<string | null | undefined>]> = [
    ["Summary", [document.summary]],
    ["Key points", describeJsonField(document.keyPoints) ?? []],
    [
      "Submission guidelines",
      analyses.map((item) => item.submissionGuidelines),
    ],
    ["Evaluation criteria", analyses.map((item) => item.evaluationCriteria)],
    ["Important dates", analyses.map((item) => item.importantDates)],
    ["Contacts", analyses.map((item) => item.contactInformation)],
    [
      "Technical specifications",
      analyses.map((item) => item.technicalSpecifications),
    ],
    [
      "Financial requirements",
      analyses.map((item) => item.financialRequirements),
    ],
    [
      "Compliance requirements",
      analyses.map((item) => item.complianceRequirements),
    ],
  ];
  const confidence = analyses.find(
    (item) => item.confidenceScore != null,
  )?.confidenceScore;
  return (
    <aside
      className="min-h-0 overflow-y-auto border-l border-border bg-card/60 p-4"
      aria-label="Extracted analysis"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Extracted analysis
      </h2>
      {fields.map(([label, values]) => {
        const content = values.filter((value): value is string =>
          Boolean(value?.trim()),
        );
        if (!content.length) return null;
        return (
          <section key={label} className="mt-4">
            <h3 className="text-sm font-semibold">{label}</h3>
            {content.map((value, index) => (
              <p
                key={index}
                className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
              >
                {value}
              </p>
            ))}
          </section>
        );
      })}
      {confidence != null && (
        <section className="mt-4">
          <h3 className="text-sm font-semibold">Confidence</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {confidence <= 1
              ? Math.round(confidence * 100)
              : Math.round(confidence)}
            %
          </p>
        </section>
      )}
      {fields.every(([, values]) => values.every((value) => !value)) && (
        <p className="mt-4 text-sm text-muted-foreground">
          No extracted analysis is available for this document yet.
        </p>
      )}
    </aside>
  );
}

function isPdf(result: DownloadResult, document: Document) {
  return (
    result.contentType?.toLowerCase().includes("pdf") ||
    document.mimeType?.toLowerCase().includes("pdf") ||
    result.filename.toLowerCase().endsWith(".pdf")
  );
}

function UnsupportedPreview({
  name,
  contentType,
  endpoint,
  documentId,
}: {
  name: string;
  contentType?: string | null;
  endpoint: TenderDocumentViewerProps["endpoint"];
  documentId: string;
}) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <FileText
          className="mx-auto size-10 text-muted-foreground"
          aria-hidden="true"
        />
        <h2 className="mt-3 font-semibold">Preview unavailable</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {name} cannot be previewed in the desktop viewer
          {contentType ? ` (${contentType})` : ""}. Download the original file
          to inspect it.
        </p>
        <div className="mt-4 flex justify-center">
          <DocumentDownloadButton
            endpoint={endpoint}
            documentId={documentId}
            showOpen={false}
          />
        </div>
      </div>
    </div>
  );
}

function PdfPreview({ bytes }: { bytes: Uint8Array }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] =
    useState<import("pdfjs-dist").PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    let loadingTask: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    void import("pdfjs-dist")
      .then(async (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        loadingTask = pdfjs.getDocument({ data: bytes.slice() });
        const loaded = await loadingTask.promise;
        if (active) setDocument(loaded);
      })
      .catch(() => active && setError("The PDF preview could not be loaded."));
    return () => {
      active = false;
      void loadingTask?.destroy();
    };
  }, [bytes]);
  useEffect(() => {
    if (!document || !canvasRef.current) return;
    let cancelled = false;
    let task: import("pdfjs-dist").RenderTask | undefined;
    void document
      .getPage(page)
      .then((pdfPage) => {
        if (cancelled || !canvasRef.current) return;
        const viewport = pdfPage.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        task = pdfPage.render({ canvas, canvasContext: context, viewport });
        return task.promise;
      })
      .catch((reason: unknown) => {
        if (
          !cancelled &&
          (reason as { name?: string }).name !== "RenderingCancelledException"
        )
          setError("This PDF page could not be rendered.");
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [document, page, zoom]);
  if (error)
    return (
      <div className="grid h-full place-items-center">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-center gap-2 border-b border-border bg-background/80 p-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
          aria-label="Previous page"
          title="Previous page"
          className="rounded p-1.5 hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-24 text-center text-xs">
          Page {page} of {document?.numPages ?? "…"}
        </span>
        <button
          type="button"
          disabled={!document || page >= document.numPages}
          onClick={() => setPage((value) => value + 1)}
          aria-label="Next page"
          title="Next page"
          className="rounded p-1.5 hover:bg-muted disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          disabled={zoom <= 0.6}
          onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}
          aria-label="Zoom out"
          title="Zoom out"
          className="rounded p-1.5 hover:bg-muted disabled:opacity-40"
        >
          <ZoomOut className="size-4" />
        </button>
        <span className="text-xs">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          disabled={zoom >= 2}
          onClick={() => setZoom((value) => Math.min(2, value + 0.2))}
          aria-label="Zoom in"
          title="Zoom in"
          className="rounded p-1.5 hover:bg-muted disabled:opacity-40"
        >
          <ZoomIn className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <canvas
          ref={canvasRef}
          className="mx-auto max-w-none bg-white shadow-lg"
          aria-label={`PDF page ${page}`}
        />
      </div>
    </div>
  );
}
