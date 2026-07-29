import { useEffect, useId, useState } from "react";
import { AsyncSection, Panel } from "../../components/common/AsyncSection";
import { useAsync } from "../../hooks/use-async";
import { describeApiError } from "../../services/api/describe-error";
import type {
  PreferenceValues,
  PreferencesEndpoint,
} from "../../services/api/endpoints/preferences";
import { PROVINCES } from "../tenders/tender-filter-options";
import type { SessionSummary } from "../../services/auth/ports";

export interface SettingsProps {
  endpoint: PreferencesEndpoint;
  session?: SessionSummary;
}

/**
 * Settings (brief §5) — the inputs Tender Radar matches on.
 *
 * These are not cosmetic preferences: `minMatchScore` and
 * `preferredProvinces` decide what the Radar shows, so this screen is where a
 * user tells the platform what work they want.
 *
 * **Only the two safely-typed fields are editable here**, and that is a
 * deliberate line rather than an unfinished one. Match score is a bounded
 * number and provinces come from the fixed canonical list, so both can be
 * written without guessing. Categories and keywords are free-form sets whose
 * valid values live in parent data with no endpoint to enumerate them — an
 * editor for those would let a user type a category that silently matches
 * nothing, which is worse than sending them to the web app. They are shown
 * read-only so the user can still see what is affecting their matches.
 *
 * Saving sends the **whole** preference object, because the parent route
 * replaces every column. Sending only the changed field would wipe the
 * categories and keywords this screen cannot edit.
 */
export function Settings({ endpoint, session }: SettingsProps) {
  const state = useAsync((signal) => endpoint.get(signal), [endpoint]);

  return (
    <section aria-labelledby="settings-heading" className="max-w-3xl">
      <h1
        id="settings-heading"
        className="text-xl font-semibold text-foreground"
      >
        Settings
      </h1>

      {session && (
        <div className="mt-4">
          <Panel title="Account">
            <dl className="flex flex-col gap-2">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="w-40 shrink-0 text-sm text-muted-foreground">
                  Signed in as
                </dt>
                <dd className="text-sm text-foreground">{session.email}</dd>
              </div>
              {session.displayName && (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                  <dt className="w-40 shrink-0 text-sm text-muted-foreground">
                    Name
                  </dt>
                  <dd className="text-sm text-foreground">
                    {session.displayName}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">
              Password and email changes are made on the Tenders-SA website.
            </p>
          </Panel>
        </div>
      )}

      <div className="mt-4">
        <AsyncSection
          state={state}
          subject="your matching preferences"
          onRetry={state.reload}
          isEmpty={() => false}
        >
          {(result) => (
            <PreferenceForm
              endpoint={endpoint}
              initial={result.preferences}
              isDefault={result.isDefault}
              onSaved={state.reload}
            />
          )}
        </AsyncSection>
      </div>
    </section>
  );
}

function PreferenceForm({
  endpoint,
  initial,
  isDefault,
  onSaved,
}: {
  endpoint: PreferencesEndpoint;
  initial: PreferenceValues;
  isDefault: boolean;
  onSaved: () => void;
}) {
  const [minMatchScore, setMinMatchScore] = useState(initial.minMatchScore);
  const [provinces, setProvinces] = useState<string[]>(
    initial.preferredProvinces,
  );
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "saving" }
    | { status: "saved" }
    | { status: "error"; message: string; kind: string }
  >({ status: "idle" });
  const scoreId = useId();

  // Re-seed if the server value changes under us (after a save reload).
  useEffect(() => {
    setMinMatchScore(initial.minMatchScore);
    setProvinces(initial.preferredProvinces);
  }, [initial]);

  const dirty =
    minMatchScore !== initial.minMatchScore ||
    provinces.join("|") !== initial.preferredProvinces.join("|");

  return (
    <Panel title="Tender Radar preferences">
      {isDefault && (
        // Distinguishes "you chose 70" from "nobody has set this".
        <p className="mb-3 text-sm text-muted-foreground">
          You have not set any preferences yet — these are the platform
          defaults.
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setState({ status: "saving" });
          endpoint
            // The complete object: the route replaces every column, so
            // everything not edited here is passed through unchanged.
            .update({
              ...initial,
              minMatchScore,
              preferredProvinces: provinces,
            })
            .then(() => {
              setState({ status: "saved" });
              onSaved();
            })
            .catch((error: unknown) =>
              setState({
                status: "error",
                ...describeApiError(error, "your preferences"),
              }),
            );
        }}
      >
        <div className="flex items-center gap-2">
          <label htmlFor={scoreId} className="text-sm text-muted-foreground">
            Minimum match score
          </label>
          <select
            id={scoreId}
            value={minMatchScore}
            onChange={(event) => setMinMatchScore(Number(event.target.value))}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {[40, 50, 60, 70, 80, 90].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm text-muted-foreground">
            Provinces you want work in
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {PROVINCES.map((province) => (
              <label
                key={province}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={provinces.includes(province)}
                  onChange={(event) =>
                    setProvinces((current) =>
                      event.target.checked
                        ? [...current, province]
                        : current.filter((name) => name !== province),
                    )
                  }
                  className="size-4"
                />
                {province}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Leave all unchecked to consider every province.
          </p>
        </fieldset>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={!dirty || state.status === "saving"}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {state.status === "saving" ? "Saving…" : "Save preferences"}
          </button>
          {state.status === "saved" && !dirty && (
            <p role="status" className="text-sm text-success">
              Saved. Your matches will be recalculated.
            </p>
          )}
        </div>

        {state.status === "error" && (
          <p
            role="alert"
            data-error-kind={state.kind}
            className="mt-2 text-sm text-destructive"
          >
            {state.message}
          </p>
        )}
      </form>

      <ReadOnlyList
        label="Preferred categories"
        values={initial.preferredCategories}
      />
      <ReadOnlyList
        label="Excluded categories"
        values={initial.excludedCategories}
      />
      <ReadOnlyList
        label="Must include keywords"
        values={initial.mustIncludeKeywords}
      />
      <ReadOnlyList
        label="Excluded keywords"
        values={initial.excludedKeywords}
      />

      <p className="mt-3 text-sm text-muted-foreground">
        Categories and keywords are edited on the Tenders-SA website, where the
        valid category names can be picked from a list.
      </p>
    </Panel>
  );
}

/**
 * A preference this screen shows but cannot safely edit.
 *
 * "None set" rather than a blank: an empty row would read as a rendering
 * fault, and the distinction between "no filter" and "not loaded" matters.
 */
function ReadOnlyList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="mt-3 flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="w-48 shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">
        {values.length > 0 ? (
          values.join(", ")
        ) : (
          <span className="text-muted-foreground">None set</span>
        )}
      </span>
    </div>
  );
}
