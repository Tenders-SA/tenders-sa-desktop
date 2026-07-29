/**
 * Tests for the unknown-shape field reader.
 *
 * Refs: INT-A2, REL-A1
 *
 * This module exists because audit gap E-11 means `requirements`,
 * `eligibilityCriteria`, and `bbbeeRequirements` genuinely arrive in
 * different runtime types depending on which route produced them. Every
 * shape below has been observed or is directly implied by the parent's
 * `parseJsonField`, so each case is a contract statement, not a hypothetical.
 */

import { describe, expect, it } from "vitest";
import { describeJsonField } from "../features/tenders/tender-fields";

describe("describeJsonField", () => {
  it("returns null for absent values, so the section is omitted", () => {
    // Not an empty array: an empty "Requirements" heading would read as
    // "this tender has no requirements", which the payload does not say.
    expect(describeJsonField(null)).toBeNull();
    expect(describeJsonField(undefined)).toBeNull();
    expect(describeJsonField("")).toBeNull();
    expect(describeJsonField("   ")).toBeNull();
    expect(describeJsonField([])).toBeNull();
    expect(describeJsonField({})).toBeNull();
  });

  it("reads an array of strings, which is the parsed detail-route shape", () => {
    expect(describeJsonField(["CIDB Grade 5", "Tax clearance"])).toEqual([
      "CIDB Grade 5",
      "Tax clearance",
    ]);
  });

  it("parses a JSON string, which is what the list route returns raw", () => {
    expect(
      describeJsonField('["Valid tax clearance","BBBEE certificate"]'),
    ).toEqual(["Valid tax clearance", "BBBEE certificate"]);
  });

  it("shows a malformed JSON string as text rather than dropping it", () => {
    // A truncated payload is still information a bidder can read. Silently
    // rendering nothing would hide a requirement that does exist.
    expect(describeJsonField('["unterminated')).toEqual(['["unterminated']);
  });

  it("does not split plain prose on commas", () => {
    // The tempting shortcut. "Desks, chairs and filing cabinets" is one
    // requirement, not three, and mangling it changes its meaning.
    const prose = "Supply, delivery and installation of office furniture";
    expect(describeJsonField(prose)).toEqual([prose]);
  });

  it("flattens an object into humanised label/value lines", () => {
    expect(describeJsonField({ minLevel: 2, tax_clearance: true })).toEqual([
      "Min level: 2",
      "Tax clearance: Yes",
    ]);
  });

  it("leaves an acronym key uppercase instead of writing `Sars`", () => {
    expect(describeJsonField({ SARS: "cleared" })).toEqual(["SARS: cleared"]);
  });

  it("joins a nested array onto its key instead of printing JSON", () => {
    expect(describeJsonField({ certificates: ["CIDB", "SARS"] })).toEqual([
      "Certificates: CIDB, SARS",
    ]);
  });

  it("reads an array of objects, which the parent's Json columns permit", () => {
    expect(
      describeJsonField([{ name: "CIDB", level: "5" }, { name: "SARS" }]),
    ).toEqual(["Name: CIDB", "Level: 5", "Name: SARS"]);
  });

  it("drops empty and non-renderable members without losing the rest", () => {
    expect(
      describeJsonField(["Keep", "", null, undefined, "Also keep"]),
    ).toEqual(["Keep", "Also keep"]);
  });

  it("renders booleans as Yes/No, never as `true`", () => {
    expect(describeJsonField({ mandatory: false })).toEqual(["Mandatory: No"]);
  });

  it("truncates a pathological payload rather than rendering thousands of rows", () => {
    const huge = Array.from({ length: 60 }, (_, i) => `Item ${i}`);
    const lines = describeJsonField(huge) ?? [];
    expect(lines).toHaveLength(51);
    expect(lines[lines.length - 1]).toBe("…and 10 more items not shown");
  });

  it("says `item` in the singular when exactly one is hidden", () => {
    const lines =
      describeJsonField(Array.from({ length: 51 }, (_, i) => `Item ${i}`)) ??
      [];
    expect(lines[lines.length - 1]).toBe("…and 1 more item not shown");
  });

  it("ignores a NaN value rather than printing NaN at a bidder", () => {
    expect(describeJsonField({ level: Number.NaN })).toBeNull();
  });
});
