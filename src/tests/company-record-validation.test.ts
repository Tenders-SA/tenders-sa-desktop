/**
 * Spec: desktop-company-profile-full-record §4.3 (H3), §4.4 (H4)
 *
 * The rules under test exist because the parent validates creates more loosely
 * than updates: `POST` coerces a bad email, URL or `clientType` to `null`,
 * while `PUT` answers 400 for the same value. Validating only to the create
 * bar therefore produces records that can be saved once and never edited
 * again, so these rules are applied to both paths.
 */

import { describe, expect, it } from "vitest";
import {
  emptyExperienceDraft,
  emptyPersonnelDraft,
  lines,
  validateExperienceDraft,
  validatePersonnelDraft,
} from "../features/company/company-record-validation";

describe("experience draft validation", () => {
  it("requires a project name", () => {
    const result = validateExperienceDraft(emptyExperienceDraft());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.projectName).toBeDefined();
  });

  it("sends null for an empty nullable field, so clearing it clears it", () => {
    // `PUT` spreads only the keys present in the body
    // (`experiences/[id]/route.ts:97-104`), so an omitted key leaves the
    // stored value in place and the user watches their edit come back.
    const result = validateExperienceDraft({
      ...emptyExperienceDraft(),
      projectName: "Depot upgrade",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        projectName: "Depot upgrade",
        currency: "ZAR",
        clientName: null,
        clientType: null,
        contractValue: null,
        referenceContact: null,
        referenceEmail: null,
        description: null,
        categoryRelevance: [],
        provinceRelevance: [],
        completionCertUrl: null,
        referenceLetterUrl: null,
      });
      // Dates are the exception: the update route maps a falsy date to
      // `undefined`, so no value sent from here can clear one.
      expect("startDate" in result.value).toBe(false);
      expect("completionDate" in result.value).toBe(false);
    }
  });

  it("rejects an email the update route would reject", () => {
    const result = validateExperienceDraft({
      ...emptyExperienceDraft(),
      projectName: "Depot",
      referenceEmail: "not-an-email",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.referenceEmail).toBeDefined();
  });

  it("rejects a URL the update route would reject", () => {
    const result = validateExperienceDraft({
      ...emptyExperienceDraft(),
      projectName: "Depot",
      completionCertUrl: "docs.example.org/cert.pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.completionCertUrl).toBeDefined();
  });

  it("rejects a client type outside the parent's three", () => {
    const result = validateExperienceDraft({
      ...emptyExperienceDraft(),
      projectName: "Depot",
      clientType: "Municipality",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.clientType).toBeDefined();
  });

  it("rejects a completion date before the start date", () => {
    const result = validateExperienceDraft({
      ...emptyExperienceDraft(),
      projectName: "Depot",
      startDate: "2025-06-01",
      completionDate: "2025-01-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.completionDate).toBeDefined();
  });

  it("accepts and normalises a complete draft", () => {
    const result = validateExperienceDraft({
      projectName: "  Depot upgrade  ",
      clientName: "City of Tshwane",
      clientType: "Government",
      contractValue: "4500000",
      currency: "ZAR",
      startDate: "2025-02-01",
      completionDate: "2025-11-30",
      referenceContact: "T. Mokoena",
      referenceEmail: "t.mokoena@example.org",
      description: "Full rebuild.",
      categoryRelevance: "construction\nroads",
      provinceRelevance: "Gauteng",
      completionCertUrl: "https://docs.example.org/cert.pdf",
      referenceLetterUrl: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.projectName).toBe("Depot upgrade");
      expect(result.value.contractValue).toBe(4_500_000);
      expect(result.value.categoryRelevance).toEqual(["construction", "roads"]);
      expect(result.value.referenceLetterUrl).toBeNull();
    }
  });

  it("clears an emptied relevance list with [], which the parent honours", () => {
    // These feed tender matching. Omitting the key would leave the removed
    // categories in place and keep matching against them.
    const result = validateExperienceDraft({
      ...emptyExperienceDraft(),
      projectName: "Depot",
      categoryRelevance: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.categoryRelevance).toEqual([]);
  });
});

describe("personnel draft validation", () => {
  it("requires a full name and a role", () => {
    const result = validatePersonnelDraft(emptyPersonnelDraft());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.fullName).toBeDefined();
      expect(result.errors.role).toBeDefined();
    }
  });

  it("rejects fractional or negative years of experience", () => {
    for (const yearsExperience of ["4.5", "-1"]) {
      const result = validatePersonnelDraft({
        ...emptyPersonnelDraft(),
        fullName: "N. Dlamini",
        role: "PM",
        yearsExperience,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.yearsExperience).toBeDefined();
    }
  });

  it("drops certifications with no name", () => {
    const result = validatePersonnelDraft({
      ...emptyPersonnelDraft(),
      fullName: "N. Dlamini",
      role: "PM",
      certifications: [{ name: "PrEng", issuer: "ECSA" }, { name: "  " }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.certifications).toEqual([
        { name: "PrEng", issuer: "ECSA" },
      ]);
    }
  });

  it("sends null for an emptied certification list, so it can be cleared", () => {
    const result = validatePersonnelDraft({
      ...emptyPersonnelDraft(),
      fullName: "N. Dlamini",
      role: "PM",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.certifications).toBeNull();
      expect(result.value.department).toBeNull();
      expect(result.value.yearsExperience).toBeNull();
    }
  });

  it("rejects a CV link that is not a URL", () => {
    const result = validatePersonnelDraft({
      ...emptyPersonnelDraft(),
      fullName: "N. Dlamini",
      role: "PM",
      cvUrl: "cv.pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.cvUrl).toBeDefined();
  });
});

describe("lines", () => {
  it("splits on newlines and commas, trimming and de-duplicating", () => {
    expect(lines(" a\nb , a ,, c ")).toEqual(["a", "b", "c"]);
  });
});
