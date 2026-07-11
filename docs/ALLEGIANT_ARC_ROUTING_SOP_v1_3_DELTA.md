# Routing SOP v1.3 — DELTA

**Version:** 1.3 (delta to v1.2)
**Dated:** 2026-07-01
**Status:** ✅ OPERATING STANDARD — v1.2 remains the base document; this delta folds in one addition per calibration threshold sign-off between Chad Markham and Claude (advisor role), 2026-07-01.
**Applies to:** `docs/ALLEGIANT_ARC_ROUTING_SOP.md` v1.2.

---

## What v1.3 adds

Per v1.2 §11, "Recalibration owed after 5–10 manual SOP applications generate outcome data." The 5–10 range is the review trigger, not the quality bar for advancing to Phase 2 execution. v1.3 adds an explicit calibration threshold that gates advancement.

## Insert as new §11.1 immediately after §11 in the base document:

### 11.1 Calibration threshold for Phase 2 readiness

Reaching the 5–10 ingestion count is necessary but not sufficient for advancing to Phase 2 work (weighting_tier tagging, generation layer scoping). Three conditions must be met, sustained across the calibration window:

| Condition | Target | Rationale |
|---|---|---|
| **Completeness score** | ≥90 on five consecutive first-pass ingestions (no manual patches during ingestion — the record accepted as-parsed for first review) | Phase 2 generation consumes the parsed record. Manual patching in the ingestion step means the parser isn't reliable; generation built on it inherits the same gap. Kirchner at 98, Tucker/Armstrong at 80, Webb at 71 — 90 is the level that suggests the parser is capturing the report's actual content, not just its structural shell. |
| **Escape rate** | ≤2 defect classes escape per ingestion, sustained across the 5-run window | Standing Instructions §7 measures escapes, not runs. Webb surfaced 6 defect classes. Repeated escapes are noise, not signal — 10 runs at Webb-quality do not calibrate Phase 2, they just document the same defects 10 times. |
| **Partner-type variety** | ≥3 of the 5 runs on non-Kirchner-lookalike partners — mix of local-service (like Webb), national B2B (Tucker-style), and, when available, YMYL (medical/legal/financial) | Otherwise calibration is on one archetype and Phase 2 breaks on partner type 2. |

**Explicit non-trigger:** hitting 5–10 runs alone. Volume without quality is worthless calibration data.

**If the threshold is not met after 10 runs:** halt Phase 2 advancement. Apply the calibration-loop feedback (Standing Instructions §7) — the escape pattern is the raw material for parser/schema revision. Iterate on the upstream (A.R.C. Report expansion, AVS tool expansion, parser fixes, schema extensions) until a fresh 5-run window meets the threshold.

**Governance:** the completeness score and escape count per ingestion are logged per §10.3. The quarterly review (§10.1) surfaces whether the threshold is on track and whether Phase 2 is realistically approachable in the near term.

## Insert as new §12.4 immediately after §12.3 in the base document:

### 12.4 Upstream expansions referenced by this SOP

Two companion instruction sets extend the ingestion pipeline upstream of Web WIZARDD:

- `docs/ARC_REPORT_EXPANSION_INSTRUCTIONS.md` — fields the A.R.C. Report must surface for the parser to catch. Applied to every A.R.C. Report built on or after its adoption date.
- `docs/AVS_TOOL_EXPANSION_INSTRUCTIONS.md` — fields the AVS tool must produce for the A.R.C. Report to embed. Applied to every AVS run on or after its adoption date.

The WIZARDD schema extension proposed to accommodate the expanded upstream fields — Nextdoor and extended review platforms, per-platform AI visibility (5 platforms including Copilot with `cited` / `citationContext` / `score`), four discipline scores (AEO / GEO / AI SEO / LLM SEO) — is deferred until the upstream expansions are live so the schema is designed against real fields, not proposed ones. Track as a v1.1 schema extension in the calibration log.

---

## Change control

- **Version:** 1.3 (delta to v1.2 base document)
- **Dated:** 2026-07-01
- **Approved by:** Chad Markham, President/CEO, Allegiant Digital Marketing (aligned in-session 2026-07-01)
- **Base document unchanged:** `docs/ALLEGIANT_ARC_ROUTING_SOP.md` v1.2 sections 1–12.3 remain authoritative. This delta adds §11.1 and §12.4.
- **On next full revision:** fold §11.1 and §12.4 into a consolidated v2.0 base document that supersedes v1.2 + v1.3-delta.
