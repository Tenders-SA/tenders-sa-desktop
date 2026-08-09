/**
 * Tender detail screen tests.
 *
 * Refs: REQ-A12, REL-A1, A11Y-A1, INT-4
 *
 * The detail route returns a shape the list route does not (gap E-11), and
 * three of its fields have no pinned runtime type. These cover the states a
 * user can actually land in, including the two that are easy to get wrong:
 * a deleted tender, and a document set with no way to open it.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TenderDetail } from "../features/tenders/TenderDetail";
import { ApiError } from "../services/api/errors";
import type {
  TenderDetail as TenderDetailData,
  TendersEndpoint,
} from "../services/api/endpoints/tenders";
import type { DownloadResult } from "../services/api/transport";
import type { SaveDownloadPort } from "../services/storage/save-download";
import type { DocumentActionPort } from "../services/storage/document-actions";

const tender: TenderDetailData = {
  id: "t1",
  tender_id: "EXT-1",
  title: "Supply of office furniture",
  referenceNumber: "RFQ-2026-001",
  sourceOrganization: "Department of Public Works",
  description: "Desks and chairs",
  province: "Gauteng",
  closingDate: "2099-01-01T00:00:00.000Z",
  estimatedValue: 1_250_000,
  type: "Request for Quotation",
  status: "ACTIVE",
};

function endpointReturning(data: TenderDetailData): TendersEndpoint {
  return {
    get: vi.fn(async () => data),
    list: vi.fn(),
  } as unknown as TendersEndpoint;
}

function endpointRejecting(error: unknown): TendersEndpoint {
  return {
    get: vi.fn(async () => {
      throw error;
    }),
    list: vi.fn(),
  } as unknown as TendersEndpoint;
}

describe("TenderDetail", () => {
  it("renders the tender once loaded", async () => {
    render(<TenderDetail endpoint={endpointReturning(tender)} tenderId="t1" />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: tender.title }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("RFQ-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Gauteng")).toBeInTheDocument();
  });

  it("requests the id it was given", async () => {
    const endpoint = endpointReturning(tender);
    render(<TenderDetail endpoint={endpoint} tenderId="t1" />);
    await waitFor(() => expect(endpoint.get).toHaveBeenCalled());
    expect(endpoint.get).toHaveBeenCalledWith("t1", expect.anything());
  });

  it("announces loading to assistive technology", () => {
    render(<TenderDetail endpoint={endpointReturning(tender)} tenderId="t1" />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading tender/i);
  });

  it("shows the deadline as text, not colour alone", async () => {
    render(<TenderDetail endpoint={endpointReturning(tender)} tenderId="t1" />);
    await waitFor(() =>
      expect(screen.getByText(/closes in \d+ days/i)).toBeInTheDocument(),
    );
  });

  it("says the closing date is unknown rather than showing a bogus number", async () => {
    render(
      <TenderDetail
        endpoint={endpointReturning({ ...tender, closingDate: "not-a-date" })}
        tenderId="t1"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Closing date unknown")).toBeInTheDocument(),
    );
  });

  it("renders requirements from an array", async () => {
    render(
      <TenderDetail
        endpoint={endpointReturning({
          ...tender,
          requirements: ["CIDB Grade 5", "Tax clearance"],
        })}
        tenderId="t1"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("CIDB Grade 5")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: "Requirements" }),
    ).toBeInTheDocument();
  });

  it("renders requirements from a raw JSON string too (E-11)", async () => {
    // The same field, a different runtime type, depending on route. Both
    // must render or the screen breaks on real data.
    render(
      <TenderDetail
        endpoint={endpointReturning({
          ...tender,
          requirements: '["Tax clearance"]',
        })}
        tenderId="t1"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Tax clearance")).toBeInTheDocument(),
    );
  });

  it("omits the section entirely when a field is absent", async () => {
    render(<TenderDetail endpoint={endpointReturning(tender)} tenderId="t1" />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: tender.title })).toBeVisible(),
    );
    // An empty heading would assert the tender has no requirements.
    expect(screen.queryByRole("heading", { name: "Requirements" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Eligibility criteria" }),
    ).toBeNull();
  });

  it("does not crash on an unexpected field shape", async () => {
    render(
      <TenderDetail
        endpoint={endpointReturning({
          ...tender,
          bbbeeRequirements: { level: 1, mandatory: true },
        })}
        tenderId="t1"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Level: 1")).toBeInTheDocument(),
    );
    expect(screen.getByText("Mandatory: Yes")).toBeInTheDocument();
  });

  it("states that documents cannot be opened, rather than implying they can", async () => {
    // INT-4: downloads go through the parent's R2 download-url route and are
    // a later slice. Listing files with no way to open them would mislead.
    render(
      <TenderDetail
        endpoint={endpointReturning({
          ...tender,
          documentStats: { total: 3, processed: 2, pending: 1, failed: 0 },
        })}
        tenderId="t1"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("3 documents")).toBeInTheDocument(),
    );
    expect(screen.getByText(/2 processed, 1 still processing/)).toBeVisible();
    expect(screen.getByText(/not available in this build/i)).toBeVisible();
  });

  it("shows no document section when the tender has none", async () => {
    render(<TenderDetail endpoint={endpointReturning(tender)} tenderId="t1" />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: tender.title })).toBeVisible(),
    );
    expect(screen.queryByText(/not available in this build/i)).toBeNull();
  });

  it("shows the source URL as text, never as a fetchable link", async () => {
    // The desktop must never reach a government source directly.
    render(
      <TenderDetail
        endpoint={endpointReturning({
          ...tender,
          sourceUrl: "https://etenders.gov.za/notice/1",
        })}
        tenderId="t1"
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText("https://etenders.gov.za/notice/1"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("reports a deleted tender distinctly", async () => {
    render(
      <TenderDetail
        endpoint={endpointRejecting(
          new ApiError({ kind: "not-found", message: "Tender not found" }),
        )}
        tenderId="gone"
      />,
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This tender no longer exists.");
  });

  it("tells an unauthenticated user to sign in, not that the session expired", async () => {
    // In a gated build the user never had a session, so "expired" would be
    // false. "Sign in" is true either way.
    render(
      <TenderDetail
        endpoint={endpointRejecting(
          new ApiError({ kind: "unauthorized", message: "Unauthorized" }),
        )}
        tenderId="t1"
      />,
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/sign in/i);
  });

  it("treats a schema failure as a handled state, not a crash", async () => {
    render(
      <TenderDetail
        endpoint={endpointRejecting(
          new ApiError({ kind: "malformed", message: "bad shape" }),
        )}
        tenderId="t1"
      />,
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/format this version understands/i);
    expect(alert).toHaveAttribute("data-error-kind", "malformed");
  });

  it("stays silent when the request was cancelled by unmount", async () => {
    const { unmount } = render(
      <TenderDetail
        endpoint={endpointRejecting(
          new ApiError({ kind: "cancelled", message: "aborted" }),
        )}
        tenderId="t1"
      />,
    );
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("TenderDetail — document downloads (Slice 7)", () => {
  const withDocuments: TenderDetailData = {
    ...tender,
    documentStats: { total: 2, processed: 2, pending: 0, failed: 0 },
    documents: [
      { id: "d1", fileName: "Advert.pdf" },
      { id: "d2", fileName: "SBD4.docx", processingStatus: "done" },
    ],
  };

  const pdfBytes = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);

  function savePort(
    overrides: Partial<SaveDownloadPort> = {},
  ): SaveDownloadPort {
    return {
      saveDialog: vi.fn(async () => "C:\\Users\\you\\Downloads\\Advert.pdf"),
      writeBytes: vi.fn(async () => {}),
      ...overrides,
    };
  }

  function documentActionPort(
    overrides: Partial<DocumentActionPort> = {},
  ): DocumentActionPort {
    return {
      chooseDirectory: vi.fn(async () => null),
      tempDirectory: vi.fn(async () => "C:\\Temp"),
      joinPath: vi.fn(async (...parts: string[]) => parts.join("\\")),
      createDirectory: vi.fn(async () => {}),
      writeBytes: vi.fn(async () => {}),
      openPath: vi.fn(async () => {}),
      ...overrides,
    };
  }

  function documentsClient(rejectWith?: unknown) {
    return {
      downloadTenderDocument: rejectWith
        ? vi.fn(async () => {
            throw rejectWith;
          })
        : vi.fn(async () => ({
            bytes: pdfBytes,
            filename: "Advert.pdf",
            contentType: "application/pdf",
          })),
    };
  }

  it("offers a Download button for every listed document", async () => {
    render(
      <TenderDetail
        endpoint={endpointReturning(withDocuments)}
        tenderId="t1"
        documents={documentsClient()}
      />,
    );
    await waitFor(() => expect(screen.getByText("2 documents")).toBeVisible());
    expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(2);
    expect(screen.getByText("Advert.pdf")).toBeVisible();
    expect(screen.getByText("SBD4.docx")).toBeVisible();
  });

  it("saves the downloaded bytes to the user-picked path", async () => {
    const port = savePort();
    render(
      <TenderDetail
        endpoint={endpointReturning(withDocuments)}
        tenderId="t1"
        documents={documentsClient()}
        savePort={port}
      />,
    );
    const [download] = await screen.findAllByRole("button", {
      name: "Download",
    });

    await userEvent.click(download);

    await waitFor(() =>
      expect(port.writeBytes).toHaveBeenCalledWith(
        "C:\\Users\\you\\Downloads\\Advert.pdf",
        pdfBytes,
      ),
    );
    // Back to idle — no toast, the file is where the user pointed it.
    expect(
      (await screen.findAllByRole("button", { name: "Download" }))[0],
    ).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disables the button while the download is in flight", async () => {
    let resolveDownload: (value: DownloadResult) => void = () => {};
    render(
      <TenderDetail
        endpoint={endpointReturning(withDocuments)}
        tenderId="t1"
        documents={{
          downloadTenderDocument: vi.fn(
            (): Promise<DownloadResult> =>
              new Promise((resolve) => {
                resolveDownload = resolve;
              }),
          ),
        }}
        savePort={savePort()}
      />,
    );
    const [download] = await screen.findAllByRole("button", {
      name: "Download",
    });

    await userEvent.click(download);
    expect(screen.getByRole("button", { name: "Downloading…" })).toBeDisabled();

    resolveDownload({
      bytes: pdfBytes,
      filename: "Advert.pdf",
      contentType: "application/pdf",
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Downloading…" })).toBeNull(),
    );
  });

  it("opens a scoped temporary copy through the operating system", async () => {
    const actionPort = documentActionPort();
    const documents = documentsClient();
    render(
      <TenderDetail
        endpoint={endpointReturning(withDocuments)}
        tenderId="t1"
        documents={documents}
        documentActionPort={actionPort}
      />,
    );

    const [open] = await screen.findAllByRole("button", { name: "Open" });
    await userEvent.click(open);

    await waitFor(() =>
      expect(actionPort.openPath).toHaveBeenCalledWith(
        "C:\\Temp\\tenders-sa\\d1-Advert.pdf",
      ),
    );
    expect(documents.downloadTenderDocument).toHaveBeenCalledTimes(1);
    expect(actionPort.writeBytes).toHaveBeenCalledWith(
      "C:\\Temp\\tenders-sa\\d1-Advert.pdf",
      pdfBytes,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("downloads every tender document after one folder choice", async () => {
    const actionPort = documentActionPort({
      chooseDirectory: vi.fn(async () => "C:\\Downloads"),
    });
    const documents = documentsClient();
    render(
      <TenderDetail
        endpoint={endpointReturning(withDocuments)}
        tenderId="t1"
        documents={documents}
        documentActionPort={actionPort}
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Download all" }),
    );
    expect(await screen.findByText("Downloaded 2 documents.")).toBeVisible();
    expect(actionPort.chooseDirectory).toHaveBeenCalledTimes(1);
    expect(documents.downloadTenderDocument).toHaveBeenCalledTimes(2);
    expect(actionPort.writeBytes).toHaveBeenCalledTimes(2);
  });

  it("does not offer Download all for a single tender document", async () => {
    render(
      <TenderDetail
        endpoint={endpointReturning({
          ...withDocuments,
          documents: withDocuments.documents?.slice(0, 1),
          documentCount: 1,
        })}
        tenderId="t1"
        documents={documentsClient()}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Download" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Download all" })).toBeNull();
  });

  it("stays silent when the user cancels the save dialog", async () => {
    const port = savePort({ saveDialog: vi.fn(async () => null) });
    render(
      <TenderDetail
        endpoint={endpointReturning(withDocuments)}
        tenderId="t1"
        documents={documentsClient()}
        savePort={port}
      />,
    );
    const [download] = await screen.findAllByRole("button", {
      name: "Download",
    });
    await userEvent.click(download);

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Download" })[0],
      ).toBeEnabled(),
    );
    expect(port.writeBytes).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains the entitlement 403 as a plan limit, not a failure", async () => {
    render(
      <TenderDetail
        endpoint={endpointReturning(withDocuments)}
        tenderId="t1"
        documents={documentsClient(
          new ApiError({
            kind: "forbidden",
            status: 403,
            message: "entitlement required",
          }),
        )}
      />,
    );
    const [download] = await screen.findAllByRole("button", {
      name: "Download",
    });
    await userEvent.click(download);

    expect(
      await screen.findByText(/your plan does not include this document/i),
    ).toBeVisible();
  });

  it("shows the retryable copy for a server failure", async () => {
    render(
      <TenderDetail
        endpoint={endpointReturning(withDocuments)}
        tenderId="t1"
        documents={documentsClient(
          new ApiError({ kind: "server", status: 500, message: "boom" }),
        )}
      />,
    );
    const [download] = await screen.findAllByRole("button", {
      name: "Download",
    });
    await userEvent.click(download);

    expect(
      await screen.findByText(/could not load this document right now/i),
    ).toBeVisible();
  });
});
