/**
 * Tender-specific additional-information Q&A (Slice 2, R-A-1..R-A-6).
 *
 * Renders the fields the parent detected for this tender (bid contact,
 * pricing basis, delivery address, conditional commitments, declarations),
 * pre-filled with the persisted answers, and saves them with an explicit
 * button press — there is deliberately **no** auto-save timer (R-A-2): the
 * parent's debounced PUT fires without a human asking, and a background
 * mutation is not how this desktop works (R-W-7).
 *
 * `{persisted:false}` is not an error: the parent answers that when its
 * `applicationExtraInfo` column predates a migration, and the answers must
 * survive in the panel rather than vanish.
 */

import { useEffect, useState } from "react";
import { AsyncSection, Panel } from "../../../components/common/AsyncSection";
import { useAsync } from "../../../hooks/use-async";
import { describeApiError } from "../../../services/api/describe-error";
import type {
  AdditionalInfo,
  AdditionalInfoField,
  AdditionalInfoSaveResult,
  AdditionalInfoValues,
} from "../../../services/api/endpoints/applications";

export interface AdditionalInfoPanelProps {
  endpoint: {
    getAdditionalInfo: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<AdditionalInfo>;
    saveAdditionalInfo: (
      id: string,
      values: AdditionalInfoValues,
      signal?: AbortSignal,
    ) => Promise<AdditionalInfoSaveResult>;
  };
  applicationId: string;
}

export function AdditionalInfoPanel({
  endpoint,
  applicationId,
}: AdditionalInfoPanelProps) {
  const state = useAsync(
    (signal) => endpoint.getAdditionalInfo(applicationId, signal),
    [endpoint, applicationId],
  );

  return (
    <AsyncSection
      state={state}
      subject="the additional information"
      onRetry={state.reload}
      isEmpty={(info) => !info.fields?.length}
      empty={
        <Panel title="Additional information">
          <p className="text-sm text-muted-foreground">
            No additional information is required for this tender.
          </p>
        </Panel>
      }
    >
      {(info) => (
        <AdditionalInfoForm
          info={info}
          endpoint={endpoint}
          applicationId={applicationId}
        />
      )}
    </AsyncSection>
  );
}

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; result: AdditionalInfoSaveResult }
  | { status: "unavailable" }
  | { status: "error"; message: string };

function AdditionalInfoForm({
  info,
  endpoint,
  applicationId,
}: {
  info: AdditionalInfo;
  endpoint: AdditionalInfoPanelProps["endpoint"];
  applicationId: string;
}) {
  const fields = info.fields ?? [];
  const [draft, setDraft] = useState<AdditionalInfoValues>(() =>
    seeded(info.values),
  );
  const [dirty, setDirty] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: "idle" });

  const requiredFields = fields.filter((field) => field.required);
  const filledRequired = requiredFields.filter((field) =>
    isFilled(field, draft[field.id ?? ""]),
  ).length;
  const progress =
    requiredFields.length > 0
      ? Math.round((filledRequired / requiredFields.length) * 100)
      : 100;

  function update(id: string, value: string | boolean) {
    setDraft((prev) => {
      const next = { ...prev, [id]: value };
      setDirty(true);
      return next;
    });
    setSave({ status: "idle" });
  }

  function saveNow() {
    setSave({ status: "saving" });
    endpoint
      .saveAdditionalInfo(applicationId, draft)
      .then((result) => {
        // `persisted:false` is the parent's pre-migration answer: answers are
        // not lost, but they only live on this device for now.
        setSave(
          result.persisted === false
            ? { status: "unavailable" }
            : { status: "saved", result },
        );
        setDirty(false);
      })
      .catch((error: unknown) => {
        const described = describeApiError(error, "the additional information");
        setSave({ status: "error", message: described.message });
      });
  }

  // If the parent re-serves different answers (another device, a reload),
  // adopt them — but never while the user has unsaved edits in the panel.
  useEffect(() => {
    if (!dirty) setDraft(seeded(info.values));
  }, [info, dirty]);

  return (
    <Panel title="Additional information" aside={<SaveBadge save={save} />}>
      {requiredFields.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={requiredFields.length}
            aria-valuenow={filledRequired}
            aria-label="Required answers progress"
            className="h-1.5 flex-1 rounded bg-border"
          >
            <div
              className={`h-full rounded ${
                progress === 100 ? "bg-success" : "bg-warning"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {filledRequired}/{requiredFields.length} required
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <FieldInput
            key={field.id ?? "field"}
            field={field}
            value={draft[field.id ?? ""]}
            onChange={(value) => update(field.id ?? "", value)}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={save.status === "saving" || !dirty}
          onClick={saveNow}
          className="rounded border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
        >
          {save.status === "saving" ? "Saving…" : "Save answers"}
        </button>
        {save.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {save.message}
          </p>
        )}
      </div>
    </Panel>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: AdditionalInfoField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const filled = isFilled(field, value);
  const fullWidth = field.type === "textarea" || field.type === "checkbox";
  const textValue = typeof value === "string" ? value : "";

  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      {field.type === "checkbox" ? (
        <label className="flex cursor-pointer items-start gap-3 rounded border border-border p-3">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="text-sm font-medium text-foreground">
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </span>
            {field.help && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {field.help}
              </span>
            )}
          </span>
        </label>
      ) : (
        <label className="block">
          <span className="flex items-baseline gap-1 text-sm font-medium text-foreground">
            {field.label ?? "Unlabelled field"}
            {field.required && <span className="text-destructive">*</span>}
            {filled && <span className="text-success">✓</span>}
          </span>
          {field.type === "textarea" ? (
            <textarea
              value={textValue}
              placeholder={field.placeholder}
              onChange={(event) => onChange(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          ) : (
            <input
              type={
                field.type === "email" || field.type === "tel"
                  ? field.type
                  : "text"
              }
              value={textValue}
              placeholder={field.placeholder}
              onChange={(event) => onChange(event.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          )}
          {field.help && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {field.help}
            </span>
          )}
        </label>
      )}
    </div>
  );
}

function SaveBadge({ save }: { save: SaveState }) {
  if (save.status === "saving") {
    return (
      <span className="text-xs text-muted-foreground" role="status">
        Saving…
      </span>
    );
  }
  if (save.status === "saved") {
    const left = save.result.unfilledRequired;
    return (
      <span className="text-xs text-success" role="status">
        {typeof left === "number" && left > 0
          ? `Saved · ${left} required left`
          : "Saved"}
      </span>
    );
  }
  if (save.status === "unavailable") {
    return (
      <span className="text-xs text-warning" role="status">
        Not saved — kept on this device
      </span>
    );
  }
  return null;
}

/** The same fill rule the parent uses (countUnfilledRequired). */
function isFilled(
  field: AdditionalInfoField,
  value: string | boolean | undefined,
): boolean {
  if (field.type === "checkbox") return value === true;
  return typeof value === "string" && value.trim() !== "";
}

function seeded(values: AdditionalInfo["values"]): AdditionalInfoValues {
  const out: AdditionalInfoValues = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === "string" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}
