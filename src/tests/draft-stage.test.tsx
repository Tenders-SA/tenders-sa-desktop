import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DraftStage } from "../features/applications/workflow/DraftStage";
import { ResponseDocumentEditor } from "../features/applications/workflow/ResponseDocumentEditor";
import { UnsavedChangesDialog } from "../features/applications/workflow/UnsavedChangesDialog";
import { ApiError } from "../services/api/errors";
import type { ApplicationsEndpoint } from "../services/api/endpoints/applications";
import type {
  ResponseDocLocalStore,
  ResponseDocVersionEntry,
} from "../services/storage/response-doc-store";

function fakeLocalStore(
  initial: {
    drafts?: Record<string, string>;
    versions?: Record<string, ResponseDocVersionEntry[]>;
    pendingKeys?: string[];
  } = {},
): ResponseDocLocalStore & {
  persistDraft: ReturnType<typeof vi.fn>;
  enqueueSave: ReturnType<typeof vi.fn>;
  clearDraft: ReturnType<typeof vi.fn>;
  replayPendingSaves: ReturnType<typeof vi.fn>;
} {
  const drafts = { ...(initial.drafts ?? {}) };
  const versions = { ...(initial.versions ?? {}) };
  const pendingKeys = [...(initial.pendingKeys ?? [])];
  // applicationId is positional in every store method; the fake is
  // single-application, so it is ignored after the call signature.
  return {
    persistDraft: vi.fn(
      async (applicationId: string, key: string, content: string) => {
        void applicationId;
        drafts[key] = content;
      },
    ),
    loadDraft: vi.fn(async (applicationId: string, key: string) => {
      void applicationId;
      return drafts[key];
    }),
    clearDraft: vi.fn(async (applicationId: string, key: string) => {
      void applicationId;
      delete drafts[key];
    }),
    snapshotVersion: vi.fn(
      async (
        applicationId: string,
        key: string,
        content: string,
        source: ResponseDocVersionEntry["source"],
      ) => {
        void applicationId;
        versions[key] = [
          {
            id: `v${(versions[key]?.length ?? 0) + 1}`,
            content,
            source,
            createdAt: new Date().toISOString(),
          },
          ...(versions[key] ?? []),
        ];
      },
    ),
    listVersions: vi.fn(async (applicationId: string, key: string) => {
      void applicationId;
      return versions[key] ?? [];
    }),
    enqueueSave: vi.fn(
      async (applicationId: string, key: string, content: string) => {
        void applicationId;
        if (!pendingKeys.includes(key)) pendingKeys.push(key);
        drafts[key] = content;
      },
    ),
    listPendingSaveKeys: vi.fn(async (applicationId: string) => {
      void applicationId;
      return [...pendingKeys];
    }),
    replayPendingSaves: vi.fn(
      async (
        save: (appId: string, key: string, content: string) => Promise<void>,
      ) => {
        let replayed = 0;
        for (const key of [...pendingKeys]) {
          const content = drafts[key] ?? "";
          await save("a1", key, content);
          pendingKeys.splice(pendingKeys.indexOf(key), 1);
          delete drafts[key];
          replayed += 1;
        }
        return replayed;
      },
    ),
  };
}

function singleDocumentEndpoint(overrides: Partial<ApplicationsEndpoint> = {}) {
  return {
    getResponseBlueprint: vi.fn(async () => ({
      blueprint: {
        tenderId: "t1",
        responseDocuments: [{ key: "technical", title: "Technical Proposal" }],
      },
      responseDocs: { technical: "Existing response" },
      responseDocStatus: { technical: { state: "ready" } },
    })),
    saveResponseDocument: vi.fn(async () => ({ ok: true, key: "technical" })),
    generateResponseDocument: vi.fn(),
    ...overrides,
  } as unknown as ApplicationsEndpoint;
}

describe("DraftStage", () => {
  it("opens a full-screen workbench and edits the generated response through existing contracts", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => ({ ok: true, key: "technical" }));
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            {
              key: "technical",
              title: "Technical Proposal",
              brief: "Address the technical specification.",
              requiredBy: "Technical returnable",
            },
            {
              key: "capability statement",
              title: "Capability Statement",
              brief: "Show the company's relevant capability.",
            },
            {
              key: "pricing/schedule #1",
              title: "Pricing Schedule",
              kind: "pricing",
              brief: "Complete every rate and VAT total.",
              requiredBy: "Annexure B",
            },
            {
              key: "transformation_commitments",
              title: "Transformation Commitments",
              kind: "future_ai_kind",
              brief: "Address the AI-identified commitment.",
            },
          ],
        },
        responseDocs: { technical: "Existing response" },
        responseDocStatus: { technical: { state: "ready" } },
      })),
      saveResponseDocument: save,
      generateResponseDocument: vi.fn(async () => ({
        key: "technical",
        status: "generating",
      })),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <Routes>
          <Route
            path="/applications/:applicationId/draft/:documentKey"
            element={
              <DraftStage
                applicationId="a1"
                documentKey="technical"
                endpoint={endpoint}
                tenderDocuments={[
                  {
                    id: "price-1",
                    fileName: "Annexure B Pricing Schedule.xlsx",
                    documentCategory: "Pricing",
                  },
                ]}
              />
            }
          />
          <Route
            path="/applications/:applicationId/plan"
            element={<p>Returned to plan</p>}
          />
        </Routes>
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole("region", {
      name: "Technical Proposal",
    });
    expect(dialog).toHaveClass("h-full");
    expect(
      screen.queryByRole("dialog", { name: "Technical Proposal" }),
    ).toBeNull();
    expect(
      screen.getByText("Address the technical specification."),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /capability statement/i }),
    );
    expect(
      screen.getByRole("textbox", { name: "Edit Capability Statement" }),
    ).toHaveTextContent("");
    expect(
      screen.getByRole("region", { name: "Capability Statement" }),
    ).toHaveAccessibleName("Capability Statement");

    await user.click(screen.getByRole("button", { name: /pricing schedule/i }));
    expect(
      screen.getByRole("textbox", { name: "Edit Pricing Schedule" }),
    ).toHaveTextContent("");
    expect(screen.getByText("Complete the official returnable")).toBeVisible();
    expect(screen.getByText("Annexure B Pricing Schedule")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /transformation commitments/i }),
    );
    expect(
      screen.getByRole("textbox", { name: "Edit Transformation Commitments" }),
    ).toHaveTextContent("");
    await user.click(
      screen.getByRole("button", { name: "Send AI instruction" }),
    );
    expect(endpoint.generateResponseDocument).toHaveBeenCalledWith(
      "a1",
      "transformation_commitments",
      undefined,
    );

    await user.click(
      screen.getByRole("button", { name: /technical proposal/i }),
    );

    const editor = screen.getByRole("textbox", {
      name: "Edit Technical Proposal",
    });
    await user.click(editor);
    await user.keyboard("{Control>}a{/Control}Our delivery method");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Text style" }),
      "2",
    );
    expect(editor.querySelector("h2")).toHaveTextContent("Our delivery method");
    expect(
      screen.getByRole("button", { name: /technical proposal unsaved/i }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save document" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const savedMarkdown = (save.mock.calls as unknown[][])[0]?.[2];
    expect(String(savedMarkdown).trim()).toBe("## Our delivery method");
    await user.click(screen.getByRole("button", { name: "Close editor" }));
    expect(await screen.findByText("Returned to plan")).toBeVisible();
  }, 10_000);

  it("guards dirty Close with Stay, Discard and Save choices", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => ({ ok: true, key: "technical" }));
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "technical", title: "Technical Proposal" },
          ],
        },
        responseDocs: { technical: "Existing response" },
      })),
      saveResponseDocument: save,
      generateResponseDocument: vi.fn(),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <Routes>
          <Route
            path="/applications/:applicationId/draft/:documentKey"
            element={
              <DraftStage
                applicationId="a1"
                documentKey="technical"
                endpoint={endpoint}
              />
            }
          />
          <Route
            path="/applications/:applicationId/plan"
            element={<p>Returned to plan</p>}
          />
        </Routes>
      </MemoryRouter>,
    );

    const editor = await screen.findByRole("textbox", {
      name: "Edit Technical Proposal",
    });
    await user.click(editor);
    await user.keyboard("{Control>}a{/Control}Unsaved response");
    fireEvent(
      window,
      new Event("beforeunload", { bubbles: false, cancelable: true }),
    );

    await user.click(screen.getByRole("button", { name: "Close editor" }));
    const warning = screen.getByRole("alertdialog", {
      name: "Save your changes?",
    });
    expect(warning).toBeVisible();
    expect(screen.getByRole("button", { name: "Stay" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Stay" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(editor).toHaveTextContent("Unsaved response");

    await user.click(screen.getByRole("button", { name: "Close editor" }));
    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("a1", "technical", "Unsaved response"),
    );
    expect(await screen.findByText("Returned to plan")).toBeVisible();
  });

  it("shows recovery instead of substituting the first document for a stale key", async () => {
    const user = userEvent.setup();
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "cover_letter", title: "Cover Letter" },
            { key: "capability", title: "Capability Statement" },
          ],
        },
      })),
      saveResponseDocument: vi.fn(),
      generateResponseDocument: vi.fn(),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/removed"]}>
        <DraftStage
          applicationId="a1"
          documentKey="removed"
          endpoint={endpoint}
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("region", {
        name: "Document no longer in this response plan",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open Cover Letter" }));
    expect(
      screen.getByRole("textbox", { name: "Edit Cover Letter" }),
    ).toBeVisible();
  });

  it("keeps selection by key when a generation refresh reorders and adds documents", async () => {
    const interval = vi
      .spyOn(window, "setInterval")
      .mockImplementation((handler: TimerHandler) => {
        queueMicrotask(() => {
          if (typeof handler === "function") handler();
        });
        return 1 as unknown as ReturnType<typeof setInterval>;
      });
    try {
      const getResponseBlueprint = vi
        .fn()
        .mockResolvedValueOnce({
          blueprint: {
            tenderId: "t1",
            responseDocuments: [
              { key: "cover_letter", title: "Cover Letter" },
              { key: "technical", title: "Technical Proposal" },
            ],
          },
        })
        .mockResolvedValue({
          blueprint: {
            tenderId: "t1",
            responseDocuments: [
              {
                key: "ai_returnable",
                title: "AI Returnable",
                kind: "new_kind",
              },
              { key: "technical", title: "Technical Proposal" },
              { key: "cover_letter", title: "Cover Letter" },
            ],
          },
          responseDocStatus: { technical: { state: "ready" } },
          responseDocs: { technical: "Generated technical response" },
        });
      const endpoint = {
        getResponseBlueprint,
        saveResponseDocument: vi.fn(),
        generateResponseDocument: vi.fn(async () => ({
          key: "technical",
          status: "generating",
        })),
      } as unknown as ApplicationsEndpoint;

      render(
        <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
          <DraftStage
            applicationId="a1"
            documentKey="technical"
            endpoint={endpoint}
          />
        </MemoryRouter>,
      );

      expect(
        await screen.findByRole("textbox", { name: "Edit Technical Proposal" }),
      ).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", { name: "Send AI instruction" }),
      );

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /ai returnable/i }),
        ).toBeVisible(),
      );
      expect(
        screen.getByRole("region", { name: "Technical Proposal" }),
      ).toHaveAccessibleName("Technical Proposal");
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: "Edit Technical Proposal" }),
        ).toHaveTextContent("Generated technical response"),
      );
    } finally {
      interval.mockRestore();
    }
  });

  it("surfaces a 402 generate failure in the full-screen editor", async () => {
    const user = userEvent.setup();
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "technical", title: "Technical Proposal" },
          ],
        },
      })),
      saveResponseDocument: vi.fn(),
      generateResponseDocument: vi.fn(async () => {
        throw new ApiError({
          kind: "payment-required",
          status: 402,
          code: "SUBSCRIPTION_REQUIRED",
          message: "Subscription required",
        });
      }),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <DraftStage
          applicationId="a1"
          documentKey="technical"
          endpoint={endpoint}
        />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Send AI instruction" }),
    );
    expect(
      await screen.findByText(/generating this document needs a paid plan/i),
    ).toBeVisible();
  });

  it("surfaces a 409 precondition failure in the full-screen editor", async () => {
    const user = userEvent.setup();
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "technical", title: "Technical Proposal" },
          ],
        },
      })),
      saveResponseDocument: vi.fn(),
      generateResponseDocument: vi.fn(async () => {
        throw new ApiError({
          kind: "validation",
          status: 409,
          code: "PRECONDITIONS_NOT_MET",
          message: "Generation preconditions not met",
        });
      }),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <DraftStage
          applicationId="a1"
          documentKey="technical"
          endpoint={endpoint}
        />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Send AI instruction" }),
    );
    expect(
      await screen.findByText(
        /complete the required additional information before generating/i,
      ),
    ).toBeVisible();
  });

  it("shows a failed generation with a Retry action and no raw error", async () => {
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "technical", title: "Technical Proposal" },
          ],
        },
        responseDocs: {},
        responseDocStatus: {
          technical: { state: "failed", error: "AI service was busy" },
        },
      })),
      saveResponseDocument: vi.fn(),
      generateResponseDocument: vi.fn(),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <DraftStage
          applicationId="a1"
          documentKey="technical"
          endpoint={endpoint}
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: "Send AI instruction" }),
    ).toBeVisible();
    expect(screen.getByText("Retry generation")).toBeVisible();
    expect(screen.getByText(/generation failed — retry it/i)).toBeVisible();
    expect(screen.queryByText("AI service was busy")).toBeNull();
  });

  it("shows a template indicator for fallback content", async () => {
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "technical", title: "Technical Proposal" },
          ],
        },
        responseDocs: { technical: "Template content" },
        responseDocStatus: { technical: { state: "ready", isFallback: true } },
      })),
      saveResponseDocument: vi.fn(),
      generateResponseDocument: vi.fn(),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <DraftStage
          applicationId="a1"
          documentKey="technical"
          endpoint={endpoint}
        />
      </MemoryRouter>,
    );

    expect(
      (await screen.findAllByText("Saved · template")).length,
    ).toBeGreaterThan(0);
  });

  it("warns about unresolved placeholders in a generated document", async () => {
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "technical", title: "Technical Proposal" },
          ],
        },
        responseDocs: { technical: "Content with {{company_name}}" },
        responseDocStatus: {
          technical: {
            state: "ready",
            unresolvedPlaceholders: ["company_name"],
          },
        },
      })),
      saveResponseDocument: vi.fn(),
      generateResponseDocument: vi.fn(),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <DraftStage
          applicationId="a1"
          documentKey="technical"
          endpoint={endpoint}
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/1 unresolved placeholder remains/i),
    ).toBeVisible();
  });

  it("offers Check again when a generation is stale and still generating", async () => {
    const user = userEvent.setup();
    const recheck = vi.fn(async () => true);
    render(
      <ResponseDocumentEditor
        title="Technical Proposal"
        content=""
        status={{ state: "generating" }}
        staleGenerating
        onSave={vi.fn()}
        onGenerate={vi.fn()}
        onRecheck={recheck}
        onDirtyChange={vi.fn()}
        onDraftChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(recheck).toHaveBeenCalledTimes(1);
  });

  it("shows the draft list when no document key is selected, then opens one", async () => {
    const user = userEvent.setup();
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "cover_letter", title: "Cover Letter" },
            { key: "technical", title: "Technical Proposal" },
          ],
        },
        responseDocs: { cover_letter: "Saved cover" },
      })),
      saveResponseDocument: vi.fn(),
      generateResponseDocument: vi.fn(),
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft"]}>
        <DraftStage applicationId="a1" endpoint={endpoint} />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Response documents" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /technical proposal/i }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /technical proposal/i }),
    );
    expect(
      await screen.findByRole("textbox", { name: "Edit Technical Proposal" }),
    ).toBeVisible();
  });

  it("generates every remaining document with one request each", async () => {
    const user = userEvent.setup();
    const generate = vi.fn(async () => ({ key: "x", status: "generating" }));
    const endpoint = {
      getResponseBlueprint: vi.fn(async () => ({
        blueprint: {
          tenderId: "t1",
          responseDocuments: [
            { key: "cover_letter", title: "Cover Letter" },
            { key: "technical", title: "Technical Proposal" },
          ],
        },
        responseDocs: { cover_letter: "Saved cover" },
      })),
      saveResponseDocument: vi.fn(),
      generateResponseDocument: generate,
    } as unknown as ApplicationsEndpoint;

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft"]}>
        <DraftStage applicationId="a1" endpoint={endpoint} />
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole("button", { name: /generate all 1 remaining/i }),
    );
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(generate).toHaveBeenCalledWith("a1", "technical");
  });

  it("sends composer instructions as the generate prompt and clears them", async () => {
    const user = userEvent.setup();
    const generate = vi.fn(async () => {});
    render(
      <ResponseDocumentEditor
        title="Technical Proposal"
        content=""
        onSave={vi.fn()}
        onGenerate={generate}
        onDirtyChange={vi.fn()}
        onDraftChange={vi.fn()}
      />,
    );

    await user.type(
      screen.getByRole("textbox", {
        name: "Instructions for AI document changes",
      }),
      "Keep it short",
    );
    await user.click(
      screen.getByRole("button", { name: "Send AI instruction" }),
    );
    await waitFor(() => expect(generate).toHaveBeenCalledWith("Keep it short"));
    expect(
      screen.getByRole("textbox", {
        name: "Instructions for AI document changes",
      }),
    ).toHaveValue("");
  });

  it("recovers an unsaved local draft into the editor on open", async () => {
    const store = fakeLocalStore({ drafts: { technical: "Local draft v1" } });

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <DraftStage
          applicationId="a1"
          documentKey="technical"
          endpoint={singleDocumentEndpoint()}
          localStore={store}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Edit Technical Proposal" }),
      ).toHaveTextContent("Local draft v1"),
    );
    expect(screen.getByText(/unsaved local draft restored/i)).toBeVisible();
    expect(store.loadDraft).toHaveBeenCalledWith("a1", "technical");
  });

  it("persists edits locally after the debounce, encrypted through the store", async () => {
    const user = userEvent.setup();
    const store = fakeLocalStore();

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <DraftStage
          applicationId="a1"
          documentKey="technical"
          endpoint={singleDocumentEndpoint()}
          localStore={store}
        />
      </MemoryRouter>,
    );

    const editor = await screen.findByRole("textbox", {
      name: "Edit Technical Proposal",
    });
    await user.click(editor);
    await user.keyboard("{Control>}a{/Control}Edited locally");
    await waitFor(
      () =>
        expect(store.persistDraft).toHaveBeenCalledWith(
          "a1",
          "technical",
          "Edited locally",
        ),
      { timeout: 2000 },
    );
  });

  it("queues a save locally when offline and shows pending sync", async () => {
    const user = userEvent.setup();
    const save = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ kind: "offline", message: "No network connection" }),
      );
    const store = fakeLocalStore();

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <DraftStage
          applicationId="a1"
          documentKey="technical"
          endpoint={singleDocumentEndpoint({ saveResponseDocument: save })}
          localStore={store}
        />
      </MemoryRouter>,
    );

    const editor = await screen.findByRole("textbox", {
      name: "Edit Technical Proposal",
    });
    await user.click(editor);
    await user.keyboard("{Control>}a{/Control}Offline content");
    await user.click(screen.getByRole("button", { name: "Save document" }));

    await waitFor(() =>
      expect(store.enqueueSave).toHaveBeenCalledWith(
        "a1",
        "technical",
        "Offline content",
      ),
    );
    expect(
      screen.getByText(/saved locally — pending sync to your response plan/i),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Sync now replays the queued save and clears the pending notice", async () => {
    const user = userEvent.setup();
    const save = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ kind: "offline", message: "No network connection" }),
      )
      .mockResolvedValue({ ok: true, key: "technical" });
    const store = fakeLocalStore();

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <DraftStage
          applicationId="a1"
          documentKey="technical"
          endpoint={singleDocumentEndpoint({ saveResponseDocument: save })}
          localStore={store}
        />
      </MemoryRouter>,
    );

    const editor = await screen.findByRole("textbox", {
      name: "Edit Technical Proposal",
    });
    await user.click(editor);
    await user.keyboard("{Control>}a{/Control}Offline content");
    await user.click(screen.getByRole("button", { name: "Save document" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sync now" })).toBeVisible(),
    );

    await user.click(screen.getByRole("button", { name: "Sync now" }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("a1", "technical", "Offline content");
    await waitFor(() =>
      expect(
        screen.queryByText(
          /saved locally — pending sync to your response plan/i,
        ),
      ).toBeNull(),
    );
  });

  it("restores a saved version from local history when clean, and blocks it when dirty", async () => {
    const user = userEvent.setup();
    const store = fakeLocalStore({
      versions: {
        technical: [
          {
            id: "v1",
            content: "Older saved version",
            source: "save",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/applications/a1/draft/technical"]}>
        <DraftStage
          applicationId="a1"
          documentKey="technical"
          endpoint={singleDocumentEndpoint()}
          localStore={store}
        />
      </MemoryRouter>,
    );

    const editor = await screen.findByRole("textbox", {
      name: "Edit Technical Proposal",
    });
    await waitFor(() =>
      expect(screen.getByText(/local history \(1\)/i)).toBeVisible(),
    );
    await user.click(screen.getByText(/local history \(1\)/i));
    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect(editor).toHaveTextContent("Older saved version");
    expect(screen.getByText("Unsaved changes")).toBeVisible();

    await user.click(editor);
    await user.keyboard("{Control>}a{/Control}More edits");
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  });
});

describe("UnsavedChangesDialog", () => {
  it("stays open and keeps the decision available after a failed save", async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesDialog
        onSave={vi.fn(async () => {
          throw new Error("offline");
        })}
        onDiscard={vi.fn()}
        onStay={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(
      await screen.findByText(/could not save this document/i),
    ).toBeVisible();
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Discard" })).toBeEnabled();
  });
});
