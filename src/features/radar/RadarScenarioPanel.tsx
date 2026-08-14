import { useState, type FormEvent } from "react";
import type {
  RadarScenarioInput,
  RadarScenarioResult,
  RecommendationsEndpoint,
} from "../../services/api/endpoints/recommendations";

export function RadarScenarioPanel({
  recommendations,
  activeResult,
  onApply,
  onExit,
  onClose,
}: {
  recommendations: RecommendationsEndpoint;
  activeResult: RadarScenarioResult | null;
  onApply: (result: RadarScenarioResult) => void;
  onExit: () => void;
  onClose: () => void;
}) {
  const [scenarioType, setScenarioType] =
    useState<RadarScenarioInput["scenarioType"]>("standard");
  const [cidbGrading, setCidbGrading] = useState("");
  const [bbbeeLevel, setBbbeeLevel] = useState("");
  const [province, setProvince] = useState("");
  const [industries, setIndustries] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setScanning(true);
    setError(null);
    const input: RadarScenarioInput = { scenarioType };
    if (cidbGrading.trim()) input.cidbGrading = cidbGrading.trim();
    if (bbbeeLevel) input.bbbeeLevel = Number(bbbeeLevel);
    if (province.trim()) input.addProvinces = [province.trim()];
    const codes = industries
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    if (codes.length > 0) input.addIndustryCodes = codes;
    try {
      onApply(await recommendations.scanScenario(input));
    } catch {
      setError(
        "Scenario scan could not be completed. Your base Radar scores are unchanged.",
      );
    } finally {
      setScanning(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenario-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="scenario-title"
              className="text-lg font-semibold text-foreground"
            >
              Radar scenario preview
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The server recalculates a temporary comparison. Nothing is saved
              to your profile or base scores.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scenario preview"
            className="text-sm text-muted-foreground"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm text-foreground">
            Scenario
            <select
              value={scenarioType}
              onChange={(event) =>
                setScenarioType(
                  event.target.value as RadarScenarioInput["scenarioType"],
                )
              }
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2"
            >
              <option value="standard">Standard rescan</option>
              <option value="cidb">CIDB upgrade</option>
              <option value="bbbee">B-BBEE change</option>
              <option value="province">Add province</option>
              <option value="jv">Joint venture capabilities</option>
              <option value="combined">Combined changes</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-foreground">
              Target CIDB grading
              <input
                value={cidbGrading}
                onChange={(event) => setCidbGrading(event.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm text-foreground">
              Target B-BBEE level
              <input
                type="number"
                min="1"
                max="8"
                value={bbbeeLevel}
                onChange={(event) => setBbbeeLevel(event.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm text-foreground">
              Province to add
              <input
                value={province}
                onChange={(event) => setProvince(event.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm text-foreground">
              Industry codes, comma separated
              <input
                value={industries}
                onChange={(event) => setIndustries(event.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={scanning}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Run scenario scan"}
          </button>
        </form>

        {activeResult && (
          <section
            aria-label="Scenario result"
            className="mt-5 rounded border border-border p-4"
          >
            <h3 className="text-sm font-semibold text-foreground">
              Projected comparison
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeResult.scannedCount} matches scanned ·{" "}
              {activeResult.delta.improvedCount} improved · average{" "}
              {activeResult.delta.averageDelta >= 0 ? "+" : ""}
              {activeResult.delta.averageDelta} points
            </p>
            <button
              type="button"
              onClick={onExit}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Exit scenario and restore base scores
            </button>
          </section>
        )}
      </section>
    </div>
  );
}
