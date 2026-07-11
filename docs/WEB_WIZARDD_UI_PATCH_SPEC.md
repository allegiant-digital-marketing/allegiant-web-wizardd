# Web WIZARDD Ingestion UI — Patch Specification v1.1

**Purpose:** Add a JSON drop-in field to the WIZARDD Ingestion UI so a builder can paste intake-form JSON alongside the parsed A.R.C. record. The intake JSON acts as a failsafe: if the parser fails to extract a field, the intake JSON supplies it, and the merged reviewed record targets a higher completeness score than parser-alone.

**Governing standard:** Allegiant Gauntlet Master Verification Standard v2.1.

**Status:** ✅ IMPLEMENTED (v1.1, 2026-07-11) via path (a-i) — patches written against the live source files. Shipped in: `src/ingestion-ui/index.html`, `src/ingestion-ui/styles.css`, `src/ingestion-ui/app.js`, `src/server.js`, `src/shared/intake-merge.js` (new), `src/layers/1-ingestion/index.js` (export addition).

---

## What this patch does

Adds a second input to the ingestion flow. The parse action consumes an A.R.C. URL and, optionally, a JSON blob from the intake form, which is merged into the parsed record following a defined merge rule.

## Merge rule (load-bearing)

For each field in the intake JSON:

- If the parser populated the field with a non-empty value, **the parser's value wins.** Intake JSON does not override parsed data. Numbers `0` and boolean `false` are real values and are never overwritten.
- If the parser left the field null / empty-string / empty-array — or lacks the key entirely — **the intake value populates the field.**
- Arrays merge wholesale, never per-element.
- The top-level `metadata` key in intake JSON is **ignored by design** (metadata is parser-owned); a warning surfaces if one was present.
- `metadata.completenessScore` is recomputed after the merge using the parser's own `computeFinalCompleteness` formula.

**Why parser wins on conflict:** the parser reads the A.R.C. Report, which is the recipient's-own-data source (§3.6). The intake form is a builder's transcription. On any conflict, the A.R.C. is more authoritative. The intake fills gaps; it does not overwrite verified data.

**Provenance tracking is mandatory:** every field the intake supplies is recorded in `metadata.fieldProvenance` — a flat map of dotted paths → `"intake"` — so the review UI badges intake-sourced fields and the saved record carries a full audit trail.

**Parser first-pass score is preserved:** the pre-merge completeness lands at `metadata.parserCompletenessScore` and displays alongside the merged score. Per Routing SOP v1.3 delta §11.1, the PARSER score — never the merged score — is the first-pass calibration metric. The failsafe exists to un-block builds, not to prop up calibration numbers.

## UI elements

1. **Intake panel** — collapsible `<details>` titled "Intake Form JSON (optional failsafe)" between the parse form and the saved-records list. Contains an 8-row monospace textarea, a "Validate JSON" button (green success with field count / red exact parse error), a "Clear" button, and a status line.
2. **Parse behavior** — with intake present: validate first; invalid JSON **halts the parse before any fetch** (panel auto-opens, error shown). Valid JSON is sent as `intakeJson` alongside `url`.
3. **Review badges** — fields sourced from intake carry a small mint `intake` badge: exact-match on scalar rows and whole-array rows; prefix-match on nested-object group labels and array-item headers. The review title shows the merged completeness badge plus a dashed `parser N` badge when a merge occurred.
4. **Save/load round-trip** — `metadata.mergeSource` (`"parser+intake"` / `"parser-only"`), `metadata.fieldProvenance`, `metadata.parserCompletenessScore`, and `metadata.sources` (`{ parser: <pre-merge snapshot>, intake: <pasted JSON> }`) persist through save and restore badges on load.

## Intake JSON expected shape

Same schema paths as the parsed record (`schemas/arc-extraction.schema.json`) so fields map 1:1. Builders paste a partial object containing only what they know; omitted keys and explicit nulls add nothing.

## Verification (per §5 tool-build row)

- **P2 — data round-trip integrity:** merge module unit-tested with 11 assertions (parser-wins conflict incl. `0`/`false`, deep null fill, empty-array wholesale fill, missing-path addition, metadata skip, source-record immutability, provenance exactness). All four JS files pass `node --check`.
- **P5 — functional test on the running build:** parser-only regression (no intake → behavior identical to v3, `mergeSource: "parser-only"`); invalid-JSON halt; merged run showing dual scores, badges, warning on skipped metadata; save → file contains provenance/sources/notes; reload → badges persist.

## Change control — v1.1 (2026-07-11, implementation shipped)

Version 1.1 marks this spec IMPLEMENTED. The shipped code follows v1.0 with these clarifications and additions, locked during implementation:

1. **Merge module location:** `src/shared/intake-merge.js` (new), imported by `src/server.js`. Unit-tested before integration.
2. **`metadata` excluded from merge** — parser-owned; warning surfaces if intake included one.
3. **Intake may add missing paths** — keys absent from the parsed record are added with `intake` provenance.
4. **Parser first-pass score preserved** (spec addition) — `metadata.parserCompletenessScore`, displayed alongside the merged score; it is the §11.1 calibration metric.
5. **Sources stored at `metadata.sources`** per spec §Save behavior.
6. **Save-endpoint fix (defect found during implementation):** `/api/save` previously rebuilt `metadata.builderReview` wholesale, silently dropping builder notes on every save since the notes feature shipped. Fixed — existing builderReview content is spread before annotation. Records saved before this fix do not contain their notes.
7. **Post-merge ajv re-validation deferred** — intake-sourced fields are visually badged instead; the builder is the validation gate. Revisit if intake typos become an escape class in the calibration log.

Version 1.0 — 2026-07-05. Specification authored while live source was unavailable to the session; superseded by this implemented revision.
