/**
 * Edit the extended company profile.
 *
 * Refs: Slice 11 spec R-C5, R-C11, §4.1 (H1), §4.2 (R-C12).
 *
 * `POST /api/v1/company/profile/extended` **replaces** all seven profile
 * fields, so this editor always emits a complete {@link ExtendedProfileWrite}
 * seeded from the loaded profile. Fields the user never touches are carried
 * through explicitly; nothing is nulled unless the user emptied it.
 */

import { useState, type FormEvent } from "react";
import {
  COMPANY_TYPES,
  equipmentAssetList,
  numberOrUndefined,
  operationalCapacityFields,
  professionalBodyList,
  splitUnmatchedRows,
  type CompanyType,
  type EquipmentAsset,
  type ExtendedCompanyProfile,
  type ExtendedProfileWrite,
  type ProfessionalBody,
  type UnknownJsonRow,
} from "../../services/api/endpoints/company";
import { control, EditorActions, Field } from "./company-form-controls";
import { COMPANY_TYPE_LABELS } from "./extended-profile-model";

interface ExtendedProfileEditorProps {
  profile: ExtendedCompanyProfile | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (value: ExtendedProfileWrite) => Promise<void>;
}

interface Draft {
  companyType: string;
  cidbGrading: string;
  profileText: string;
  profileDocument: string;
  staffCount: string;
  vehicleCount: string;
  premisesOwned: string;
  premisesSize: string;
  /** Intersected with {@link UnknownJsonRow}: a matching row may still carry
   * keys another path wrote, and the editor must not be what drops them. */
  equipmentAssets: (EquipmentAsset & UnknownJsonRow)[];
  professionalBodies: (ProfessionalBody & UnknownJsonRow)[];
  /**
   * Rows whose shape this editor cannot present as fields, but which carry a
   * usable name and can therefore still be written back. Not editable.
   */
  preservedEquipment: ({ name: string } & UnknownJsonRow)[];
  preservedBodies: ({ name: string } & UnknownJsonRow)[];
  /**
   * Rows that cannot be written back at all: the parent's schema requires a
   * string `name` on every entry, so attaching them 400s the whole save. They
   * are counted so the form can say plainly that saving drops them.
   */
  unwritableEquipment: number;
  unwritableBodies: number;
}

function draftFrom(profile: ExtendedCompanyProfile | null): Draft {
  const capacity = operationalCapacityFields(profile?.operationalCapacity);
  const equipment = equipmentAssetList(profile?.equipmentAssets);
  const bodies = professionalBodyList(profile?.professionalBodies);
  const salvagedEquipment = splitUnmatchedRows(equipment.unmatched);
  const salvagedBodies = splitUnmatchedRows(bodies.unmatched);
  return {
    companyType: profile?.companyType ?? "",
    cidbGrading: profile?.cidbGrading ?? "",
    profileText: profile?.profileText ?? "",
    profileDocument: profile?.profileDocument ?? "",
    staffCount: capacity?.staffCount == null ? "" : String(capacity.staffCount),
    vehicleCount:
      capacity?.vehicleCount == null ? "" : String(capacity.vehicleCount),
    premisesOwned:
      capacity?.premisesOwned == null ? "" : String(capacity.premisesOwned),
    premisesSize: capacity?.premisesSize ?? "",
    equipmentAssets: equipment.matched,
    professionalBodies: bodies.matched,
    preservedEquipment: salvagedEquipment.writable,
    preservedBodies: salvagedBodies.writable,
    unwritableEquipment: salvagedEquipment.unwritable.length,
    unwritableBodies: salvagedBodies.unwritable.length,
  };
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function ExtendedProfileEditor({
  profile,
  saving,
  onCancel,
  onSave,
}: ExtendedProfileEditorProps) {
  const [draft, setDraft] = useState(() => draftFrom(profile));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>(
    {},
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Partial<Record<keyof Draft, string>> = {};

    if (!draft.companyType) {
      next.companyType = "Company type is required.";
    }
    const document = draft.profileDocument.trim();
    if (document && !isUrl(document)) {
      next.profileDocument =
        "The company profile document must be a full web address.";
    }
    for (const [key, value] of [
      ["staffCount", draft.staffCount],
      ["vehicleCount", draft.vehicleCount],
    ] as const) {
      if (
        value.trim() &&
        !(Number.isInteger(Number(value)) && Number(value) >= 0)
      ) {
        next[key] = "Must be a whole number.";
      }
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setErrors({});

    const capacityEntries: Record<string, unknown> = {};
    const staffCount = numberOrUndefined(draft.staffCount);
    const vehicleCount = numberOrUndefined(draft.vehicleCount);
    if (staffCount != null) capacityEntries.staffCount = staffCount;
    if (vehicleCount != null) capacityEntries.vehicleCount = vehicleCount;
    if (draft.premisesOwned) {
      capacityEntries.premisesOwned = draft.premisesOwned === "true";
    }
    if (draft.premisesSize.trim()) {
      capacityEntries.premisesSize = draft.premisesSize.trim();
    }

    // Salvaged rows are appended: this POST replaces the whole column, so
    // writing back only what the editor understood would delete the rest.
    // Rows with no usable `name` are *not* appended — the parent's schema
    // rejects them and the whole save would 400. The form says so above.
    const equipmentAssets = [
      ...draft.equipmentAssets.filter((item) => item.name.trim()),
      ...draft.preservedEquipment,
    ];
    const professionalBodies = [
      ...draft.professionalBodies.filter((item) => item.name.trim()),
      ...draft.preservedBodies,
    ];

    await onSave({
      companyType: draft.companyType as CompanyType,
      profileDocument: document || null,
      profileText: draft.profileText.trim() || null,
      equipmentAssets: equipmentAssets.length ? equipmentAssets : null,
      operationalCapacity: Object.keys(capacityEntries).length
        ? capacityEntries
        : null,
      cidbGrading: draft.cidbGrading.trim() || null,
      professionalBodies: professionalBodies.length ? professionalBodies : null,
    });
  }

  return (
    <form
      onSubmit={submit}
      /** See `ExperienceEditor` — our validation is the authoritative one. */
      noValidate
      aria-label="Edit company profile detail"
      className="rounded border border-border bg-background p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company type" required error={errors.companyType}>
          <select
            value={draft.companyType}
            onChange={(event) => set("companyType", event.target.value)}
            className={control}
          >
            <option value="">Select a company type</option>
            {COMPANY_TYPES.map((value) => (
              <option key={value} value={value}>
                {COMPANY_TYPE_LABELS[value] ?? value}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="CIDB grading"
          hint="For construction work — a hard eligibility gate on many tenders."
        >
          <input
            value={draft.cidbGrading}
            onChange={(event) => set("cidbGrading", event.target.value)}
            className={control}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Company profile text">
            <textarea
              rows={8}
              value={draft.profileText}
              onChange={(event) => set("profileText", event.target.value)}
              className={control}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Company profile document link"
            error={errors.profileDocument}
            hint="A link to the document. Uploading files happens in the Document Vault."
          >
            <input
              type="url"
              value={draft.profileDocument}
              onChange={(event) => set("profileDocument", event.target.value)}
              className={control}
            />
          </Field>
        </div>
      </div>

      <fieldset className="mt-5 border-t border-border pt-4">
        <legend className="text-sm font-medium text-card-foreground">
          Operational capacity
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Staff" error={errors.staffCount}>
            <input
              type="number"
              min="0"
              step="1"
              value={draft.staffCount}
              onChange={(event) => set("staffCount", event.target.value)}
              className={control}
            />
          </Field>
          <Field label="Vehicles" error={errors.vehicleCount}>
            <input
              type="number"
              min="0"
              step="1"
              value={draft.vehicleCount}
              onChange={(event) => set("vehicleCount", event.target.value)}
              className={control}
            />
          </Field>
          <Field label="Premises owned">
            <select
              value={draft.premisesOwned}
              onChange={(event) => set("premisesOwned", event.target.value)}
              className={control}
            >
              <option value="">Not recorded</option>
              <option value="true">Owned</option>
              <option value="false">Leased</option>
            </select>
          </Field>
          <Field label="Premises size">
            <input
              value={draft.premisesSize}
              onChange={(event) => set("premisesSize", event.target.value)}
              className={control}
            />
          </Field>
        </div>
      </fieldset>

      <RepeatableRows
        legend="Equipment and assets"
        emptyCopy="No equipment recorded."
        addCopy="Add equipment"
        rows={draft.equipmentAssets}
        preserved={draft.preservedEquipment.length}
        unwritable={draft.unwritableEquipment}
        onChange={(rows) => set("equipmentAssets", rows)}
        blank={{ name: "" }}
        render={(row, update) => (
          <>
            <Field label="Item">
              <input
                value={row.name}
                onChange={(event) => update({ name: event.target.value })}
                className={control}
              />
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                min="0"
                value={row.quantity ?? ""}
                onChange={(event) =>
                  update({ quantity: numberOrUndefined(event.target.value) })
                }
                className={control}
              />
            </Field>
            <Field label="Value">
              <input
                type="number"
                min="0"
                value={row.value ?? ""}
                onChange={(event) =>
                  update({ value: numberOrUndefined(event.target.value) })
                }
                className={control}
              />
            </Field>
          </>
        )}
      />

      <RepeatableRows
        legend="Professional bodies"
        emptyCopy="No professional registrations recorded."
        addCopy="Add professional body"
        rows={draft.professionalBodies}
        preserved={draft.preservedBodies.length}
        unwritable={draft.unwritableBodies}
        onChange={(rows) => set("professionalBodies", rows)}
        blank={{ name: "" }}
        render={(row, update) => (
          <>
            <Field label="Body">
              <input
                value={row.name}
                onChange={(event) => update({ name: event.target.value })}
                className={control}
              />
            </Field>
            <Field label="Membership number">
              <input
                value={row.membershipNumber ?? ""}
                onChange={(event) =>
                  update({ membershipNumber: event.target.value })
                }
                className={control}
              />
            </Field>
            <Field label="Expiry date">
              <input
                type="date"
                value={row.expiryDate ?? ""}
                onChange={(event) => update({ expiryDate: event.target.value })}
                className={control}
              />
            </Field>
          </>
        )}
      />

      <EditorActions
        saving={saving}
        saveLabel="Save company profile detail"
        onCancel={onCancel}
      />
    </form>
  );
}

function RepeatableRows<T extends { name: string }>({
  legend,
  emptyCopy,
  addCopy,
  rows,
  blank,
  preserved,
  unwritable,
  onChange,
  render,
}: {
  legend: string;
  emptyCopy: string;
  addCopy: string;
  rows: T[];
  blank: T;
  /** Count of unrecognised rows carried through this save untouched. */
  preserved: number;
  /** Count of rows the save contract cannot carry — see {@link splitUnmatchedRows}. */
  unwritable: number;
  onChange: (rows: T[]) => void;
  render: (row: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <fieldset className="mt-5 border-t border-border pt-4">
      <legend className="text-sm font-medium text-card-foreground">
        {legend}
      </legend>
      {rows.length === 0 && preserved === 0 && unwritable === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">{emptyCopy}</p>
      )}
      {preserved > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {preserved} further {preserved === 1 ? "entry is" : "entries are"} in
          a format this screen cannot edit. {preserved === 1 ? "It" : "They"}{" "}
          will be kept exactly as {preserved === 1 ? "it is" : "they are"}.
        </p>
      )}
      {unwritable > 0 && (
        <p className="mt-2 text-xs text-destructive">
          {unwritable} {unwritable === 1 ? "entry is" : "entries are"} stored in
          a format the save contract does not accept.{" "}
          {unwritable === 1 ? "It" : "They"} cannot be written back, so saving
          will remove {unwritable === 1 ? "it" : "them"}. Cancel if you need{" "}
          {unwritable === 1 ? "it" : "them"} kept.
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {rows.map((row, index) => (
          <li
            key={index}
            className="grid gap-3 rounded border border-border p-3 sm:grid-cols-3"
          >
            {render(row, (patch) =>
              onChange(
                rows.map((item, position) =>
                  position === index ? { ...item, ...patch } : item,
                ),
              ),
            )}
            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={() =>
                  onChange(rows.filter((_, position) => position !== index))
                }
                className="rounded border border-border px-3 py-1.5 text-xs text-foreground"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...rows, { ...blank }])}
        className="mt-3 rounded border border-border px-3 py-1.5 text-sm text-foreground"
      >
        {addCopy}
      </button>
    </fieldset>
  );
}
