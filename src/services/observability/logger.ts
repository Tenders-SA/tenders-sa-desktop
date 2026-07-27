import { redact, type RedactionMode } from "./redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  appVersion: string;
  environment: string;
  /** Ties a log line back to a request/operation (OPS-1). */
  correlationId?: string;
}

export interface LogEvent {
  level: LogLevel;
  /** Short stable event name, e.g. "sync.operation.failed". */
  event: string;
  timestamp: string;
  appVersion: string;
  environment: string;
  correlationId?: string;
  fields?: Record<string, unknown>;
}

/** Where redacted events go. The Rust bridge implements this in the app. */
export interface LogSink {
  write(event: LogEvent): void;
}

export interface LoggerOptions {
  context: LogContext;
  sink: LogSink;
  mode?: RedactionMode;
  enabled?: boolean;
  now?: () => Date;
}

/**
 * Structured logger (REQ-8, OPS-1).
 *
 * Every event carries application version, environment, and optional
 * correlation context, and every caller-supplied field passes through
 * redaction before it reaches the sink -- there is no code path that
 * writes raw fields, deliberately, so a careless call site cannot leak.
 */
export class Logger {
  private readonly context: LogContext;
  private readonly sink: LogSink;
  private readonly mode: RedactionMode;
  private readonly enabled: boolean;
  private readonly now: () => Date;

  constructor(options: LoggerOptions) {
    this.context = options.context;
    this.sink = options.sink;
    this.mode = options.mode ?? "strict";
    this.enabled = options.enabled ?? true;
    this.now = options.now ?? (() => new Date());
  }

  private emit(
    level: LogLevel,
    event: string,
    fields?: Record<string, unknown>,
  ): void {
    if (!this.enabled) {
      return;
    }
    this.sink.write({
      level,
      event,
      timestamp: this.now().toISOString(),
      appVersion: this.context.appVersion,
      environment: this.context.environment,
      correlationId: this.context.correlationId,
      fields: fields
        ? (redact(fields, this.mode) as Record<string, unknown>)
        : undefined,
    });
  }

  debug = (event: string, fields?: Record<string, unknown>) =>
    this.emit("debug", event, fields);
  info = (event: string, fields?: Record<string, unknown>) =>
    this.emit("info", event, fields);
  warn = (event: string, fields?: Record<string, unknown>) =>
    this.emit("warn", event, fields);
  error = (event: string, fields?: Record<string, unknown>) =>
    this.emit("error", event, fields);

  /** Derives a logger sharing this sink with added correlation context. */
  withCorrelation(correlationId: string): Logger {
    return new Logger({
      context: { ...this.context, correlationId },
      sink: this.sink,
      mode: this.mode,
      enabled: this.enabled,
      now: this.now,
    });
  }
}

/** Console sink, used when the native bridge is unavailable (dev/tests). */
export const consoleSink: LogSink = {
  write(event) {
    const line = JSON.stringify(event);
    if (event.level === "error") {
      console.error(line);
    } else if (event.level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  },
};
