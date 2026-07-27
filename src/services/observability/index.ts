import { invoke } from "@tauri-apps/api/core";
import { Logger, consoleSink, type LogEvent, type LogSink } from "./logger";

export { Logger, consoleSink } from "./logger";
export type { LogEvent, LogLevel, LogSink } from "./logger";
export { redact, redactString, REDACTED } from "./redaction";
export type { RedactionMode } from "./redaction";

/**
 * Sink that forwards to the native `log_event` command, which
 * re-redacts before writing. Falls back to the console when the
 * native bridge is unavailable (browser dev server, tests) rather
 * than throwing -- losing a log line must never break the app.
 */
export const nativeSink: LogSink = {
  write(event: LogEvent) {
    const payload = {
      level: event.level,
      event: event.event,
      timestamp: event.timestamp,
      appVersion: event.appVersion,
      environment: event.environment,
      correlationId: event.correlationId,
      // The native side takes flat string pairs; nested structures
      // would mean maintaining a second recursive scrubber in Rust.
      fields: Object.entries(event.fields ?? {}).map(
        ([key, value]) => [key, String(value)] as [string, string],
      ),
    };

    void invoke("log_event", { event: payload }).catch(() => {
      consoleSink.write(event);
    });
  },
};

/** Application logger. Version/environment come from the build. */
export const logger = new Logger({
  context: {
    appVersion: "0.1.0",
    environment: "development",
  },
  sink: nativeSink,
});
