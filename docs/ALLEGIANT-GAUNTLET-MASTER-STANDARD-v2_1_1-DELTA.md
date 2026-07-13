# The Allegiant Gauntlet — Master Verification Standard v2.1.1 DELTA

**Status:** SIGNED by Chad Markham 2026-07-12 — executed by upload of this dated delta to the A.R.C. generator Project Knowledge (repo commit to WIZARDD `docs/` per Distribution step 1 completes the record). This delta's §III-B AI-visibility row is authoritative; v2.1 as written remains authoritative on all other items.
**Base document:** `ALLEGIANT-GAUNTLET-MASTER-STANDARD-v2_1.md` (LOCKED 2026-07-04 per Standing Instructions v1.1). The base document is unchanged; this delta amends exactly two items. On the next full revision (v2.2), fold both in and retire this delta.
**Owner:** Chad Markham, Allegiant Digital Marketing. **Drafted:** 2026-07-11.

---

## Escapes prompting this revision (per Part IV — every revision cites its escapes)

1. **2026-07-05:** AVS/ARC expansion instructions v1.0 were drafted against an assumed AVS architecture (Google AI Overviews listed as a queried platform; Copilot treated as decided). Corrected same day against the live AVS tool documentation — the tool queries ChatGPT, Claude, Gemini, and Perplexity; it has never measured AI Overviews; Copilot is an open decision.
2. **2026-07-11:** A fresh conversation in the A.R.C. generator project, mechanically applying the conflict rule ("on process, the Master Standard wins"), resolved the AI-visibility platform question **backwards** — reinstating AI Overviews and excluding Copilot — because §III-B's row still carries the pre-correction platform list. Stale paper in a locked standard actively mis-routed a parallel thread. This delta ends that.

---

## Amendment 1 — §III-B per-dimension verification table, AI-visibility row

**REPLACE this row:**

| Dimension | Source of truth | Fabrication mode to prevent |
|---|---|---|
| AI visibility (4 platforms) | Actual queries to ChatGPT / Perplexity / Gemini / Claude (+ AI Overviews), responses captured + dated | Claiming the recipient is/isn't cited without running the queries |

**WITH this row:**

| Dimension | Source of truth | Fabrication mode to prevent |
|---|---|---|
| AI visibility | The AVS tool's machine-readable export block (`avsExport`), supplied at intake and embedded verbatim: per-platform `cited` · `citationContext` (`cited` / `not_cited` / `not_evaluated`; `at_risk` reserved until AVS ships competitor detection) · `score` 0–100 · `queryDate` (ISO). Platform rows render from the export's own platform list — currently ChatGPT, Claude, Gemini, Perplexity; Copilot appears if and when the AVS tool adds it. Discipline scores (AEO / GEO / AI SEO / LLM SEO) render only when a deep-audit export contains them; otherwise the panel states "Discipline audit not yet run." No export at intake → "AVS audit not yet run." | Transcribing or asserting any value not present in the export — including inferred mentions, estimated scores, platforms the export does not contain, or emitting `at_risk` |

**Rationale.** The report generator does not query AI platforms and cannot verify claims it would be asserting (§3.9 — the verification method must actually verify). The AVS tool is the instrument that runs the queries; its export is the dated capture §III-B's governing rule requires. Embedding the export verbatim keeps the report's AI-visibility claims traceable to their live capture and makes the 4-vs-5-platform outcome (Copilot pending) a data question, not a template edit.

**Companion documents already aligned:** `ARC_REPORT_EXPANSION_INSTRUCTIONS.md` v1.2 §5 · `AVS_TOOL_EXPANSION_INSTRUCTIONS.md` v2.0 Change 1 · A.R.C. generator research-spec Step 9 replacement (delivered as an appendix with the template build).

## Amendment 2 — Document-control status line

**REPLACE:** `**Status:** DRAFT for Chad's lock. Standalone — supersedes v2.0 (the chain is not reintroduced).`
**WITH:** `**Status:** LOCKED by Chad Markham 2026-07-04 (recorded in Standing Instructions v1.1). Standalone — supersedes v2.0 (the chain is not reintroduced). Amended by v2.1.1 DELTA (2026-07-11): §III-B AI-visibility row.`

**Rationale.** The lock occurred 2026-07-04 but the document-control block was never updated; two independent readers (the A.R.C. build thread and the verification conversation) flagged the mismatch. The live document should state its actual status.

---

## Distribution on sign-off

1. Commit this delta to the WIZARDD repo `docs/` (versioned home, same pattern as the Routing SOP v1.3 delta).
2. Upload this delta to the A.R.C. generator project's knowledge files alongside the base v2.1 — future conversations then resolve the AI-visibility question forward, not backward.
3. Any other location holding v2.1 (team distribution, other projects) receives the delta alongside it.

## Sign-off

**Signed:** Chad Markham, President/CEO, Allegiant Digital Marketing — by commit dated 2026-07-12
