/**
 * Endpoint-parity guard (TASK-2.4, REQ-A14, INT-A3).
 *
 * The desktop is an extension of the production Tenders-SA web
 * application and consumes **the same parent-internal routes the web app
 * uses**. It does not consume the public Developer API at
 * `api.tenders-sa.org`, which is read-only public data with no
 * auth-session, workspace, or mutation routes and therefore cannot serve
 * this product at all.
 *
 * Nothing in the type system enforces that. Phase 0's transport fixtures
 * drifted to the Developer API precisely because nothing objected (gap
 * PA-1), and a contributor reading them as the contract would have built
 * a client against the wrong API with `?cursor` pagination no
 * main-application route implements.
 *
 * This file is the objection. It scans real source -- with comments
 * stripped, so historical notes explaining the drift stay allowed -- and
 * fails if the Developer API returns.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const srcRoot = resolve(__dirname, "..");

/** Files whose whole purpose is to assert the Developer API is absent. */
const NEGATIVE_ASSERTION_FILES = new Set([
  "tests/endpoint-parity.test.ts",
  "tests/capability-scope.test.ts",
]);

const DEVELOPER_API_HOST = "api.tenders-sa.org";

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, acc);
    } else if ([".ts", ".tsx"].includes(extname(full))) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Strips `//` and block comments so that prose *about* the Developer API
 * -- like the header of `api-transport.test.ts` explaining what PA-1 was
 * -- does not trip the guard. Only executable references count.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) =>
      // A naive `indexOf("//")` is WRONG here and silently defeats this
      // whole guard: it matches the `//` inside `https://`, truncating the
      // line before the host so the offending URL disappears. The first
      // draft of this file did exactly that and passed against a planted
      // violation. Requiring the `//` not to be preceded by `:` keeps
      // scheme separators intact while still stripping real comments,
      // including trailing ones after a URL.
      line.replace(/(^|[^:])\/\/.*$/, "$1"),
    )
    .join("\n");
}

interface Scanned {
  path: string;
  code: string;
}

const scanned: Scanned[] = sourceFiles(srcRoot)
  .map((full) => ({
    path: relative(srcRoot, full).split("\\").join("/"),
    code: stripComments(readFileSync(full, "utf8")),
  }))
  .filter((f) => !NEGATIVE_ASSERTION_FILES.has(f.path));

describe("endpoint parity — the desktop uses the main application API", () => {
  it("scans a non-trivial number of source files", () => {
    // Guards the guard: a broken walk would make every assertion below
    // pass vacuously.
    expect(scanned.length).toBeGreaterThan(20);
  });

  it("references the Developer API host nowhere in executable source", () => {
    const offenders = scanned
      .filter((f) => f.code.includes(DEVELOPER_API_HOST))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("uses no /v1 or /v2 request path", () => {
    // The Developer API's versioned surface. Main-application routes are
    // all under /api/ -- including /api/v1/*, which is a different thing
    // and deliberately still allowed.
    const offenders = scanned
      .filter((f) => /["'`]\/v[12]\//.test(f.code))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("uses no ?cursor pagination, which no main-application route implements", () => {
    // Main-application routes paginate with page/limit or limit/offset
    // (endpoint-inventory.md §4). A `cursor` parameter is a tell that a
    // fixture or adapter was written against the Developer API.
    const offenders = scanned
      .filter(
        (f) => /cursor["']?\s*:/.test(f.code) || f.code.includes("cursor="),
      )
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe("endpoint parity — allowed main-application paths", () => {
  it("permits /api/v1/* , which belongs to the main application", () => {
    // Sanity check that the /v1 guard is not over-broad: the parent's own
    // internal routes include /api/v1/applications and /api/v1/notifications,
    // and those must remain usable.
    const sample = `const p = "/api/v1/applications";`;
    expect(/["'`]\/v[12]\//.test(stripComments(sample))).toBe(false);
  });

  it("keeps the workspace cockpit routes on the parent /api/v1 surface", () => {
    // Explicit coverage for the cockpit routes added in
    // desktop-workspace-cockpit T1/T4: they are application-scoped and live
    // on ApplicationsEndpoint, so a future contributor cannot quietly re-home
    // them to another host or a parallel client without this test objecting.
    const source = stripComments(
      readFileSync(
        resolve(srcRoot, "services/api/endpoints/applications.ts"),
        "utf8",
      ),
    );
    const expected = [
      "`/api/v1/applications/${encodeURIComponent(id)}/assist`",
      "`/api/v1/applications/${encodeURIComponent(id)}/assist/compliance-gaps`",
      "`/api/v1/applications/${encodeURIComponent(id)}/assist/research`",
      "`/api/v1/applications/${encodeURIComponent(id)}/assist/additional-info`",
      "`/api/v1/applications/${encodeURIComponent(id)}/assist/response-blueprint`",
      "`/api/v1/applications/${encodeURIComponent(id)}/assist/generate-response-doc`",
      "`/api/v1/applications/${encodeURIComponent(id)}/assist/response-doc`",
      "`/api/v1/applications/${encodeURIComponent(id)}/assist/enrich-blueprint`",
      "`/api/v1/applications/${encodeURIComponent(id)}/assist/workspace-export`",
      '"/api/v1/applications/workspace/summary"',
      "`/api/v1/applications/${encodeURIComponent(id)}/workspace`",
      '"PATCH"',
      '"PUT"',
    ];
    for (const fragment of expected) {
      expect(source, fragment).toContain(fragment);
    }
  });

  it("still catches a bare /v2 path", () => {
    const sample = `const p = "/v2/tenders";`;
    expect(/["'`]\/v[12]\//.test(stripComments(sample))).toBe(true);
  });

  it("ignores the Developer API host when it appears only in a comment", () => {
    const sample = `// historical: fixtures once used https://api.tenders-sa.org\nconst x = 1;`;
    expect(stripComments(sample)).not.toContain(DEVELOPER_API_HOST);
  });

  it("does NOT let a scheme separator hide a real URL (regression)", () => {
    // The bug this guard shipped with on its first draft: `indexOf("//")`
    // truncated at the `//` in `https://`, so the host vanished and a
    // planted violation passed silently. Any future rewrite of
    // `stripComments` must keep this passing.
    //
    // Note it is the *host* check that catches a full URL, not the path
    // check: in `https://host/v2/tenders` the `/v2/` is preceded by the
    // host, not by a quote, so the bare-path regex correctly does not
    // fire. Bare paths are covered by the test above.
    const sample = `const bad = "https://${DEVELOPER_API_HOST}/v2/tenders";`;
    expect(stripComments(sample)).toContain(DEVELOPER_API_HOST);
  });

  it("still strips a comment trailing a URL", () => {
    const sample = `const ok = "http://localhost:3000/api"; // just a comment`;
    expect(stripComments(sample)).not.toContain("just a comment");
    expect(stripComments(sample)).toContain("localhost:3000");
  });
});
