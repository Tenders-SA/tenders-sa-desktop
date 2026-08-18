/**
 * Pure helpers for the extended company profile.
 *
 * Kept out of `ExtendedProfileEditor.tsx` so that file exports components
 * only — a module mixing the two breaks React Fast Refresh, which the lint
 * rule `react-refresh/only-export-components` guards.
 */

import {
  equipmentAssetList,
  operationalCapacityFields,
  professionalBodyList,
  splitUnmatchedRows,
  type CompanyType,
  type ExtendedCompanyProfile,
  type ExtendedProfileWrite,
} from "../../services/api/endpoints/company";

export const COMPANY_TYPE_LABELS: Record<string, string> = {
  SOLE_PROPRIETOR: "Sole proprietor",
  CLOSE_CORPORATION: "Close corporation",
  PTY_LTD: "Private company (Pty) Ltd",
  PUBLIC_COMPANY: "Public company",
  NPO: "Non-profit organisation",
  COOPERATIVE: "Co-operative",
  JOINT_VENTURE: "Joint venture",
  OTHER: "Other",
};

/**
 * Reads a loaded profile into the complete write shape the parent demands.
 *
 * Unrecognised rows are salvaged and appended back after the recognised ones,
 * exactly as `ExtendedProfileEditor` does, so that round-tripping a profile
 * through the editor never drops what can be kept. Rows with no usable `name`
 * are excluded from both, because the parent's schema rejects them
 * ({@link splitUnmatchedRows}) — and because this shape is compared against
 * the editor's output by {@link fingerprintExceptCidb}, so the two must build
 * the same list or a CIDB-only edit would stop taking the narrow route.
 */
export function extendedWriteFrom(
  profile: ExtendedCompanyProfile | null | undefined,
): ExtendedProfileWrite | undefined {
  if (!profile?.companyType) return undefined;
  const capacity = operationalCapacityFields(profile.operationalCapacity);
  const equipment = equipmentAssetList(profile.equipmentAssets);
  const bodies = professionalBodyList(profile.professionalBodies);
  return {
    companyType: profile.companyType as CompanyType,
    profileDocument: profile.profileDocument ?? null,
    profileText: profile.profileText ?? null,
    equipmentAssets: [
      ...equipment.matched,
      ...splitUnmatchedRows(equipment.unmatched).writable,
    ],
    operationalCapacity: capacity ?? null,
    cidbGrading: profile.cidbGrading ?? null,
    professionalBodies: [
      ...bodies.matched,
      ...splitUnmatchedRows(bodies.unmatched).writable,
    ],
  };
}

/**
 * Everything except the CIDB grading, for deciding whether a save can go
 * through the narrow single-field route instead (R-C12).
 */
export function fingerprintExceptCidb(write: ExtendedProfileWrite): string {
  return JSON.stringify({
    companyType: write.companyType,
    profileDocument: write.profileDocument,
    profileText: write.profileText,
    equipmentAssets: write.equipmentAssets,
    operationalCapacity: write.operationalCapacity,
    professionalBodies: write.professionalBodies,
  });
}

/** `yyyy-mm-dd` for `<input type="date">` from the parent's ISO timestamps. */
export function dateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}
