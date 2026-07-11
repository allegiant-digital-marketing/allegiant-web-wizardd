# Web WIZARDD Ingestion UI — Patch Specification v1.0

**Purpose:** Add a JSON drop-in field to the WIZARDD Ingestion UI so a builder can paste intake-form JSON alongside the parsed A.R.C. record. The intake JSON acts as a failsafe: if the parser fails to extract a field, the intake JSON supplies it, and the merged reviewed record targets a higher completeness score than parser-alone.

**Governing standard:** Allegiant Gauntlet Master Verification Standard v2.1.

**Status:** SPECIFICATION for Chad's execution. This document exists because the sandbox does not currently have the live WIZARDD source files. Two paths to apply:

1. **(a-i)** Chad uploads current `src/ingestion-ui/index.html`, `styles.css`, `app.js`, and `src/server.js` to a Claude session; Claude produces the exact code patches. Cleaner audit trail.
2. **(a-ii)** Chad applies this specification directly. Faster; the spec describes exactly what to change and where.

Either path produces the same end-state deliverable.

---

## What this patch does

Adds a second input to the ingestion flow. Currently the parse button consumes an A.R.C. URL and produces a parsed record. After this patch, the reviewed record can additionally accept a JSON blob from the intake form, which is merged into the parsed record following a defined merge rule.

## Merge rule (load-bearing — get this right)

For each field in the parsed record schema:

- If the parser populated the field with a non-null value, **the parser's value wins.** Intake JSON does not override parsed data.
- If the parser left the field null AND the intake JSON contains a value for that field, **the intake value populates the field.**
- If both are null, the field stays null.
- The `metadata.completenessScore` is recomputed after the merge — it reflects the merged record's field population, not the parser-alone number.

**Why parser wins on conflict:** the parser reads the A.R.C. Report, which is the recipient's-own-data source (§3.6). The intake form is a builder's transcription. On any conflict, the A.R.C. is more authoritative. The intake fills gaps; it does not overwrite verified data.

**Provenance tracking is mandatory:** every field in the merged record carries a source flag — `parser` or `intake`. This lands in the saved JSON as a parallel structure (`fieldProvenance`) so downstream reviewers know which data came from where.

## UI changes required

### 1. New input panel (below the A.R.C. URL panel, above the review panel)

Component: collapsible section titled **"Intake Form JSON (optional failsafe)"**. Collapsed by default. When expanded, contains:

- A `<textarea>` sized ~8 rows, with placeholder text: `Paste intake-form JSON here. This will fill in fields the parser missed. Parser values take precedence on any conflict.`
- A "Validate JSON" button. On click, attempts `JSON.parse()` on the textarea content. Shows success (green: "Valid JSON, X fields parsed") or failure (red: exact parser error).
- A "Clear" button to reset the textarea.

### 2. Parse button behavior change

The existing Parse button, when clicked with intake JSON present in the textarea:

1. Fetches and parses the A.R.C. URL as before.
2. Parses the intake JSON.
3. Applies the merge rule above.
4. Recomputes `metadata.completenessScore` on the merged record.
5. Adds `metadata.mergeSource: "parser+intake"` (parser-alone runs get `metadata.mergeSource: "parser-only"`).
6. Adds parallel `fieldProvenance` object to the record.
7. Displays the merged record in the review panel.

If intake JSON is present but invalid, the parse halts before fetching — surface the JSON error clearly, do not silently proceed with parser-only.

### 3. Review panel indicators

For every field displayed in the review panel:

- Fields sourced from the parser display normally (existing UI).
- Fields sourced from the intake JSON display with a subtle badge or icon (e.g., a small "i" tag or `[intake]` suffix in a muted color) so the reviewer knows which fields came from where.

### 4. Save behavior

The saved JSON at `data/reviewed-records/{partner}--{date}.json` includes:

- The merged record (existing behavior).
- The `fieldProvenance` object.
- The `metadata.mergeSource` value.
- Both source inputs preserved separately as `sources.parser` (the pre-merge parsed record) and `sources.intake` (the pasted JSON) — for audit and replay.

## Intake JSON expected shape

The intake JSON should follow the same schema as the parsed record (`schemas/arc-extraction.schema.json`) so field paths map 1:1. Builders paste a partial record with only the fields they know from the intake form; empty fields are simply omitted or set to null.

Example intake JSON for Webb Pest Service:

```json
{
  "businessIdentity": {
    "businessName": "Webb Pest Service"
  },
  "social": {
    "facebook": "https://facebook.com/webbpestservice",
    "instagram": "https://instagram.com/webbpestservice"
  },
  "reviews": {
    "yelp": {
      "rating": 4.6,
      "count": 84,
      "url": "https://yelp.com/biz/webb-pest-service"
    }
  },
  "aiVisibility": {
    "perPlatform": {
      "copilot": {
        "cited": false,
        "citationContext": "at_risk",
        "score": 42
      }
    },
    "disciplineScores": {
      "aeo": { "score": 51, "notes": "FAQ schema partial, direct-answer format inconsistent" },
      "geo": { "score": 38, "notes": "Fact density thin; few chunk-optimized passages" },
      "aiSeo": { "score": 62, "notes": "Solid SSR foundation; AI crawlers allowed" },
      "llmSeo": { "score": 29, "notes": "No knowledge graph presence; branded search volume low" }
    }
  }
}
```

## Verification (per §5 tool-build row)

Per §5 tool-build P2/P5:

- **P2 — data round-trip integrity:** merge rule tested with three cases: parser-only (existing behavior preserved), intake-only-supplements-parser (gaps fill correctly, parser wins on overlaps), invalid-intake-JSON (halts cleanly, no silent proceed).
- **P5 — functional test on deployed build:** ingest Webb A.R.C. + intake JSON simulating what Chad manually filled in during the 2026-07-01 run. Verify the merged record hits ≥90 completeness and the six defect classes surface as `fieldProvenance: intake` in the merged record.

## Change control

- Version 1.0 — 2026-07-01. Initial specification derived from Webb Pest Service ingestion escapes.
- Applied via path (a-i) or (a-ii) at Chad's discretion.
- Post-application, the WIZARDD ingestion UI carries this failsafe for the remainder of the calibration window.
