import { describe, expect, it } from "vitest";
import {
  redact,
  redactString,
  REDACTED,
} from "../services/observability/redaction";
import {
  Logger,
  type LogEvent,
  type LogSink,
} from "../services/observability/logger";

function capturingSink(): LogSink & { events: LogEvent[] } {
  const events: LogEvent[] = [];
  return {
    events,
    write(event) {
      events.push(event);
    },
  };
}

function makeLogger(
  overrides: Partial<ConstructorParameters<typeof Logger>[0]> = {},
) {
  const sink = capturingSink();
  const logger = new Logger({
    context: { appVersion: "0.1.0", environment: "test" },
    sink,
    now: () => new Date("2026-07-27T00:00:00.000Z"),
    ...overrides,
  });
  return { logger, sink };
}

describe("redactString", () => {
  const cases: Array<[string, string]> = [
    ["bearer token", "Authorization: Bearer abc123xyz"],
    ["api key", "using tsa_prod_livekey123"],
    ["jwt", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig"],
    ["email", "contact buyer@example.com"],
    ["sa id number", "id 8001015009087"],
    ["rand amount", "bid R 1 250 000.00"],
    ["card number", "card 4111 1111 1111 1111"],
  ];

  it.each(cases)("redacts a %s", (_label, input) => {
    expect(redactString(input)).toContain(REDACTED);
  });

  it("leaves operational text untouched", () => {
    const text = "sync operation pending attempt 2";
    expect(redactString(text)).toBe(text);
  });
});

describe("redact (strict mode)", () => {
  it("drops any field whose key is not on the safe list", () => {
    const output = redact({
      status: "pending", // safe
      tenderTitle: "Construction of a rural clinic", // not safe
    }) as Record<string, unknown>;

    expect(output.status).toBe("pending");
    expect(output.tenderTitle).toBe(REDACTED);
  });

  it("redacts credential-shaped keys regardless of the safe list", () => {
    const output = redact({
      accessToken: "abc",
      password: "hunter2",
      apiKey: "tsa_prod_x",
      authorization: "Bearer y",
    }) as Record<string, unknown>;

    for (const value of Object.values(output)) {
      expect(value).toBe(REDACTED);
    }
  });

  it("never lets pricing, document content, or personal data through", () => {
    const output = JSON.stringify(
      redact({
        bidAmount: "R 4 500 000",
        documentBody: "Full text of the tender specification…",
        contactEmail: "buyer@example.com",
        idNumber: "8001015009087",
      }),
    );

    expect(output).not.toContain("4 500 000");
    expect(output).not.toContain("tender specification");
    expect(output).not.toContain("buyer@example.com");
    expect(output).not.toContain("8001015009087");
  });

  it("reduces an Error to its class name, dropping the message", () => {
    const output = redact(
      new Error("failed for tender R 1 000 000 at /home/user/secret.pdf"),
    ) as { name: string; message: string };

    expect(output.name).toBe("Error");
    expect(output.message).toBe(REDACTED);
  });

  it("handles nesting and arrays without leaking", () => {
    const output = JSON.stringify(
      redact({ items: [{ secretValue: "R 99 999" }] }),
    );
    expect(output).not.toContain("99 999");
  });

  it("stops at a depth limit rather than recursing forever", () => {
    type Nested = { next?: Nested };
    const deep: Nested = {};
    let cursor = deep;
    for (let i = 0; i < 20; i += 1) {
      cursor.next = {};
      cursor = cursor.next;
    }
    expect(() => redact(deep)).not.toThrow();
  });
});

describe("redact (standard mode)", () => {
  it("keeps scrubbed unknown values for local debugging", () => {
    const output = redact(
      { tenderTitle: "Rural clinic" },
      "standard",
    ) as Record<string, unknown>;
    expect(output.tenderTitle).toBe("Rural clinic");
  });

  it("still scrubs sensitive values inside kept fields", () => {
    const output = redact(
      { note: "email buyer@example.com about it" },
      "standard",
    ) as Record<string, string>;
    expect(output.note).toContain(REDACTED);
    expect(output.note).not.toContain("buyer@example.com");
  });

  it("still drops credential-shaped keys", () => {
    const output = redact({ accessToken: "abc" }, "standard") as Record<
      string,
      unknown
    >;
    expect(output.accessToken).toBe(REDACTED);
  });
});

describe("Logger", () => {
  it("stamps version, environment, and timestamp on every event (OPS-1)", () => {
    const { logger, sink } = makeLogger();
    logger.info("shell.started");

    expect(sink.events[0]).toMatchObject({
      level: "info",
      event: "shell.started",
      appVersion: "0.1.0",
      environment: "test",
      timestamp: "2026-07-27T00:00:00.000Z",
    });
  });

  it("redacts caller-supplied fields before they reach the sink", () => {
    const { logger, sink } = makeLogger();
    logger.error("api.request.failed", {
      status: 500,
      responseBody: "tender pricing R 1 000 000",
    });

    const written = JSON.stringify(sink.events[0]);
    expect(written).not.toContain("1 000 000");
    expect(sink.events[0].fields?.status).toBe(500);
  });

  it("carries correlation context through a derived logger", () => {
    const { logger, sink } = makeLogger();
    logger.withCorrelation("req_abc123").warn("sync.retry");

    expect(sink.events[0].correlationId).toBe("req_abc123");
  });

  it("writes nothing at all when telemetry is disabled", () => {
    const { logger, sink } = makeLogger({ enabled: false });
    logger.error("should.not.appear", { anything: "at all" });

    expect(sink.events).toHaveLength(0);
  });

  it("emits each level", () => {
    const { logger, sink } = makeLogger();
    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");

    expect(sink.events.map((e) => e.level)).toEqual([
      "debug",
      "info",
      "warn",
      "error",
    ]);
  });
});
