# Allegiant A.R.C. Routing SOP — Entry-Sequence Decision Logic

**Version:** 1.2
**Dated:** July 1, 2026
**Status:** ✅ **OPERATING STANDARD** — cleared at Gauntlet P4 by Mike Small (Director of Production), review completed 2026-06-30. Governs live partner builds.
**Governing standard:** Allegiant Gauntlet Master Verification Standard v2.1.
**Companion documents:** `docs/ALLEGIANT_MASTER_FACTOR_REFERENCE.md` · `docs/ALLEGIANT_SEO_WEIGHTING_MODEL.md` · `schemas/local-service-verticals.json` · `docs/ROUTING_SOP_P4_REVIEW_WORKSHEET.md`
**Classification note:** Threshold values in Section 5 (The priority tree) and Section 8 (Automation triggers) are **internal-only pending calibration data**. Do not include specific numerical thresholds in partner-facing material until validated with production outcomes.

---

## Revisions from v1.1

v1.2 folds in all 11 required changes from the Tier-1 P4 human peer review (Mike Small, Director of Production, 2026-06-30). None alter the routing logic itself; changes are governance, calibration discipline, operational clarity, external-communication risk, and playbook framing. See `docs/ROUTING_SOP_P4_REVIEW_WORKSHEET.md` for the full signed review record.

| # | Change | Source read |
|---|---|---|
| 1 | Success metrics section added (override rate · partner satisfaction @ 90 days · time-to-first-shipped-page) | CFO |
| 2 | Automation trigger criteria section added — cleaner set (volume · team-scale · consistency drift), provisional pending calibration data | CFO |
| 3 | Periodic Step 0 false-positive rate review added to Governance | CFO |
| 4 | Playbook framing updated — weighting_tier tagging of the 263-item master reference is the executable-playbook mechanism, deferred to post-calibration | Competitor |
| 5 | Internal-only threshold classification added to document header + Section 5 | Competitor |
| 6 | "Why this framework exists" opening section added | Competitor |
| 7 | Critical-foundation issue checklist split into Critical Infrastructure vs. Critical Optimization | Fact-Checker |
| 8 | C2 language tightened — operator answers Yes only from analytics or intake data, never memory | Fact-Checker |
| 9 | Compliance override co-signer authority defined — Chad Markham (CEO) directly, sole authority pending org changes | Lawyer |
| 10 | Partner examples fully anonymized (Partner A / B / C in body; internal-only reference key in Appendix C) | Lawyer |
| 11 | Release QA process added to Governance — every SOP version bump verifies schema, partner data, and vertical count claims against actual repo files | Fact-Checker (Read 3 F1) |

---

## 1. Why this framework exists

Before the routing framework, three problems recurred across A.R.C.-to-build handoffs:

**Inconsistent strategist judgment.** Two strategists reading the same A.R.C. could land on materially different starting emphases — one leading with technical foundation, another with content depth, another with AI visibility. That inconsistency wasn't laziness; it was the absence of a shared decision procedure. It cost calibration effort every time a partner escalated to Chad for arbitration.

**No auditable decision trail.** When a partner asked "why did you lead with Foundation work instead of local-service optimization?" the answer lived in a strategist's head, not a written record. That opacity hurt trust with partners and prevented internal learning from decisions that turned out well or badly.

**No mechanism to scale institutional knowledge.** Chad's judgment on what to lead with — accumulated over 25+ years including 17 at a national agency and 5 teaching at UT Austin — didn't transfer to newer strategists without shadowing every A.R.C. read. That's a hiring ceiling.

This framework addresses those three problems by turning the entry-sequence decision into a written procedure a strategist follows with a completed A.R.C., a small set of operator confirms, and locked reference documents. The routing decision is auditable, teachable, and defensible without requiring Chad's real-time judgment on every partner. It is not a substitute for expertise; it codifies expertise so the team can execute it consistently.

This distinguishes Allegiant's approach from generic "audit → fix → grow" methodology. The value is not in the three named sequences — every SEO agency does some version of foundation-first, citation-optimization, or fast-slice work. The value is in the decision procedure that says which one this partner leads with, why, and under what conditions the recommendation gets overridden.

---

## 2. What this is (mechanics)

A decision procedure that takes a **completed, human-verified A.R.C.** and outputs the recommended **entry sequence** — which slice of the full 263-item standard (`docs/ALLEGIANT_MASTER_FACTOR_REFERENCE.md`) a partner leads with in the first 60–90 days.

These are **not three destinations.** Every partner reaches the full standard. They are three starting orders: **Foundation-First**, **Citation-Capture**, **Vertical-Slice**.

The sequences are **graduation steps**: a partner routed Foundation-First is re-run against a fresh A.R.C. after the base is fixed, and typically routes Citation-Capture next.

(Entry sequences, not packages — distinct from Pkg A–D.)

---

## 3. Prerequisite & inputs

**Prerequisite:** a completed A.R.C., already human-verified upstream (accuracy is assumed clean by this step).

**Machine inputs** — read from `schemas/arc-extraction.schema.json` (locked contract, reused unchanged):

- `website.lcpMobileSeconds`
- `website.knownIssues[]` (plus reviews/social `knownIssues` for NAP)
- `aiVisibility.avs` · `aiVisibility.citationCount`
- `targetServices[]` (count)
- `targetLocations[]` (tiers / national presence)
- `businessIdentity.vertical`
- `metadata.completenessScore`
- `metadata.extractionWarnings`

**Operator confirms** (the thin routing-inputs layer — the three signals no contract carries):

- **C1 — Timeline:** quick-win mandate or tight deadline? (Y/N)
- **C2 — Revenue concentration:** do **≤5 pages generate the majority of leads**? (Y/N)
  - Operator answers **Yes only if**: (a) partner's Google Analytics shows top 5 pages generating >50% of goal completions, OR (b) partner's intake form data confirms this concentration. Never answer from memory, institutional impression, or partner self-report without underlying data.
- **C3 — Compliance class:** regulated / YMYL vertical (medical, legal, financial, etc.)? (Y/N) — *unmissable; this confirm is load-bearing.*

**Vertical references** — the canonical enumerations:

- **Local-service set:** `schemas/local-service-verticals.json` — 354 verticals across 17 categories. Membership = "vertical is a local-service type" for Gate 2.
- **YMYL set:** the 80 verticals flagged `is_ymyl: true` within `local-service-verticals.json`. **Belt-and-suspenders for C3:** even if the operator answers No, the compliance brake fires if the partner's `businessIdentity.vertical` matches an `is_ymyl: true` entry. The stricter of the two answers wins.

---

## 4. Step 0 — Sufficiency check (run first, gate-agnostic)

If the fields decisive for foundation assessment are **null** AND `extractionWarnings` indicate **un-parsed tabs** (e.g., "Website Audit tab parsing not completed") → **STOP, flag for human review, do not route.**

Distinguish from a fully-read-but-sparse report: warnings saying "9/9 tasks succeeded" with some source fields simply null is **not** insufficient signal — it routes normally. (Real example: Partner B and Partner C both came back `completenessScore: 80` with all tasks succeeded — sparse source, not failed read.)

**`completenessScore` semantics:** the score measures the fraction of expected schema fields that landed values, not "did extraction succeed." A small business with a thin online footprint can score 70 without any extraction failure. Use the score as supporting context only; the extraction-failure case is what Step 0 catches via `extractionWarnings`.

---

## 5. Critical-foundation issue checklist (drives Gate 1)

Classify `website.knownIssues[]` (plus reviews/social for NAP) into two categories. **Either category, ≥1 issue, triggers Gate 1.**

### 5.1 Critical Infrastructure Failures — base is technically broken

The site cannot function as a discoverable, crawlable, load-safe web property:

- Not indexed by Google
- Missing XML sitemap
- Missing robots.txt
- Apex domain unresolved
- Broken HTTPS · security headers absent
- Severe load failure (mobile LCP ≥ 8s — internal-only threshold, uncalibrated starting cut)
- Broken links at scale (>10 4xx/5xx on primary paths)

### 5.2 Critical Optimization Failures — base is technically functional but not competitive

The site works but cannot rank or be cited at scale:

- Schema / JSON-LD absent
- Live placeholder / lorem-ipsum content in production
- Severe NAP inconsistency across ≥3 directories (map pack partners)
- Missing H1 at scale (>50% of money pages)
- Missing meta descriptions at scale (>50% of money pages)
- Duplicate content at scale (>10% site-wide per Siteliner or equivalent)

### 5.3 Cosmetic-only — does NOT trigger Gate 1

Single missing alt text, tap targets too close on one page, one missing meta tag, one broken link on a non-money page.

> *Wording varies across reports — "Schema markup not detected" (Partner B report) = "Zero JSON-LD structured data" (Partner C report). A human strategist classifies by meaning. **When this is automated, the matcher needs a controlled vocabulary or it will miss** — flagged as the key automation dependency (Phase 2 schema work).*

---

## 6. The priority tree (first match wins)

**Threshold values in this section are internal-only pending calibration data from production outcomes. Do not surface specific numerical cuts in partner-facing material.**

**GATE 1 — Foundation-First.**
Fire if **≥ 1 issue from Section 5.1 (Critical Infrastructure) OR Section 5.2 (Critical Optimization) is present**.
→ Lead with **Technical → On-Page → Content/E-E-A-T** (master-list Parts 3 → 1 → 5).
Secondary lean: **Citation-Capture** on re-run after the base is fixed.

**GATE 2 — Vertical-Slice.** *(Reached only if the base is sound — Gate 1 did not fire.)*
Fire if **any** of:

- Local single-market: `businessIdentity.vertical` ∈ `schemas/local-service-verticals.json` **AND** `targetLocations[]` shows no national entry
- C2 = Yes (≤5 pages generate majority of leads, per analytics/intake data)
- C1 = Yes (quick-win mandate)

→ Build complete money-page slices end-to-end, ship fast, expand.

**⚠ COMPLIANCE BRAKE:** if **C3 = Yes** OR `businessIdentity.vertical` matches a vertical flagged `is_ymyl: true` in `schemas/local-service-verticals.json`, Vertical-Slice does **not** fire bare → output **"Vertical-Slice + mandatory compliance scaffolding"** (the slice must carry the vertical's required disclaimers, credentials, claim-substantiation, etc.). **Never a thin ship-fast slice for a regulated/YMYL partner.**

If the operator's C3 answer contradicts the YMYL vertical-list match, the brake fires regardless — the stricter answer wins, and the override record captures the operator's reasoning.

**GATE 3 — Citation-Capture.** *(Default: sound base, broad/national footprint, no urgency.)*
Drive off the AI gap: low `avs` (< ~40, uncalibrated starting cut) and/or low `citationCount`.

**Degrade field-by-field** — use whichever AI fields are present. If **both** `avs` and `citationCount` are null → insufficient signal → flag-for-review or default to Standard with a note. *(avs does not travel as a bundle: Partner C had avs=38 but null citationCount.)*

→ Lead with **AI / GEO** (master-list Parts 7–8) on the existing base.

**NO-MATCH.** *(None fire: sound base, broad footprint, no urgency, AND adequate AI visibility — e.g. `avs` ≥ ~60 uncalibrated cut.)*
→ **Standard full-roadmap sequencing**, or operator selects. A defined response — never returns nothing.

---

## 7. Output & persistence

Every routing produces:

- **Recommended entry sequence** (primary) **+ secondary lean** — always framed "recommended," never "the correct path"
- **Signals that fired** — the specific field values / critical issues that drove the decision (shown, not hidden)
- **Compliance-scaffolding flag** (if the brake fired) + reason (C3=Yes / vertical-is-YMYL / both)
- **Source A.R.C. URL + `extractedAt` + staleness flag** — the recommendation is only as current as the A.R.C.
- **Operator name + decision timestamp** (attribution — this gates paid production)
- **Override record** (if the operator overrides the recommendation, with reason)

**Compliance-brake override — heightened authority.** Overriding the compliance brake specifically requires co-signature from **Chad Markham (CEO)** directly. This authority sits with Chad alone as of this SOP version. When Allegiant org structure changes — dedicated compliance role added, Director-level authority delegated for compliance decisions, or external counsel engaged for regulated-vertical work — this SOP is updated to reflect the new authority chain. Any co-signer must be different from the person routing.

**Persistence location:** `data/routing-decisions/{arcReportId}-{decisionTimestamp}.json`. The `data/` directory is gitignored (matches existing exclusion for `data/reviewed-records/`). Each routing decision is a standalone JSON artifact, locally persisted, retrieved by report ID for re-runs and audit.

Not an ephemeral screen — every routing decision is an attributed JSON file the build queue can pick up.

---

## 8. Automation triggers (provisional — pending calibration data)

Manual SOP application is correct at Allegiant's current scale. Automation becomes economically justified when **all three** of the following are sustained:

| Trigger | Threshold (uncalibrated starting cut) | What it measures |
|---|---|---|
| Volume | ≥8 routings/month for 2 consecutive quarters | Throughput cost — the tree is running often enough that automation saves aggregate time |
| Team scale | ≥3 strategists applying the SOP regularly | Coordination cost — enough people are running the tree that automation genuinely enforces consistency |
| Consistency drift | Two strategists route the same A.R.C. differently on ≥1 in 10 blind pairs | Quality cost — manual application is producing inconsistent decisions |

**All three trigger values are provisional pending calibration data.** These are the conditions Mike's P4 review flagged as needing objective criteria (Read 1 CFO Finding 2). They are labeled "uncalibrated starting cuts" until routing volume and team composition give us enough data to validate or revise them.

Trigger review is part of the Part IV calibration loop of the governing Gauntlet standard — every quarter, actual routing volume, actual team size, and actual consistency-drift rate get checked against these cuts. If any trigger fires, revisit the automation decision. If none fires after four consecutive quarters, revisit whether the cuts are too conservative.

---

## 9. Success metrics (provisional — pending calibration data)

Three metrics track whether the routing framework is producing better outcomes than manual strategist judgment alone. All are provisional starting cuts pending 5–10-partner calibration:

| Metric | Signal | Baseline expectation | Revisit trigger |
|---|---|---|---|
| **Override rate** | % of routing decisions where the operator overrides the recommendation | <15% steady-state — high override rate means thresholds need re-calibration | >20% for 2 consecutive quarters |
| **Partner satisfaction @ 90 days** | Partner-reported satisfaction score at 90-day mark, correlated with routed entry sequence | Foundation-First partners as satisfied as Citation-Capture partners (routing doesn't correlate with dissatisfaction) | Any sequence's 90-day score is >20% below the others |
| **Time-to-first-shipped-page** | Time from A.R.C. completion to first partner-facing page ship, by entry sequence | Vertical-Slice fastest; Citation-Capture second; Foundation-First slowest by design | Any sequence's time-to-ship exceeds 2× the fastest |

Metric tracking is Allegiant's responsibility during the calibration period. Aggregate results feed the quarterly review (Section 10) and the Gauntlet's calibration loop.

---

## 10. Governance

### 10.1 Quarterly review cadence

Every quarter, the following reviews run:

- **Step 0 false-positive rate.** If Step 0 fires on >X% of A.R.C.s in a quarter (X uncalibrated pending data; likely 5–10%), investigate: either the parser needs improvement, or the sufficiency criteria in Section 4 are too aggressive.
- **Override rate.** Per Section 9, if the routing recommendation is being overridden >15% of the time, thresholds in Section 6 need re-calibration.
- **Success metric drift.** Per Section 9, any metric hitting its revisit trigger prompts a review.
- **Automation trigger check.** Per Section 8, actual routing volume, team size, and consistency drift checked against provisional cuts.

Quarterly review deliverable: a written summary in the calibration log (per Gauntlet v2.1 Part IV) identifying which triggers fired, what actions were taken, and what SOP revisions are pending.

### 10.2 Release QA

Every SOP version bump (v1.1 → v1.2, v1.2 → v1.3, etc.) requires release-QA verification before commit:

- All schema field references in this SOP verified against actual `schemas/arc-extraction.schema.json`
- All partner data claims in this SOP verified against actual parsed extractions
- All vertical-count and YMYL-count claims verified against actual `schemas/local-service-verticals.json`
- All cross-references to other Allegiant documents verified against those documents in the current commit

Release QA runs as a Gauntlet P2 pass against the SOP itself before the commit lands. Findings block release.

### 10.3 Calibration loop feed

Every escape — an incorrect routing recommendation caught downstream by Chad, a partner, or a subsequent A.R.C. — gets logged per Gauntlet v2.1 §IV with the four fields: *what escaped · which section should have caught it · why it didn't · the fix (a rule, checklist item, or SOP revision).* Escape rates drive the changelog.

---

## 11. Validation status

- **Gate 1 — live-validated.** Partner A (residential electrician), Partner B (commercial collections), Partner C (commercial kitchen equipment repair) all routed Foundation-First on real extraction data. Independently corroborated by each report's own Phase-1 roadmap. The strategist who authored the A.R.C. reached the same lead the tree does.

- **Gates 2–3, compliance brake, no-match — logic + schema validated, not live.** The real sample was foundation-broken across the board; the compliance brake only bites a *healthy-based* YMYL-local partner, which this pipeline rarely produces.

- **Uncalibrated starting cuts** pending outcome data. Every threshold value in this SOP is provisional. Recalibration owed after 5–10 manual SOP applications generate outcome data.

- **P4 review — CLEARED.** Tier-1 human peer review by Mike Small (Director of Production), completed 2026-06-30, disposition CLEARED WITH REQUIRED CHANGES (9.5/10 assessment). All 11 required changes folded into this v1.2 revision. See `docs/ROUTING_SOP_P4_REVIEW_WORKSHEET.md` for the signed review record.

- **Re-run on a fresh A.R.C. after foundation work** — the sequences are graduation steps, not permanent labels.

---

## 12. Phase 2 dependencies (deferred — do not block adoption)

Known gaps that don't block adoption today but constrain automation and executable-playbook completeness later:

1. **`knownIssues` controlled vocabulary.** Today this SOP works as a human procedure because a strategist classifies issues by meaning. Automation requires the parser's schema to gain a parallel `knownIssuesCategorized[]` field with enum values (e.g., `["schema_missing", "not_indexed", "no_sitemap", "severe_lcp", "broken_links_scale", ...]`). The existing freeform `knownIssues[]` stays for human readability; the categorized field is what the router consumes. **Future schema v1.1.**

2. **Master factor reference `weighting_tier` tagging — executable playbook mechanism.** The three entry sequences pull ordered slices from the 263-item master list (`docs/ALLEGIANT_MASTER_FACTOR_REFERENCE.md`). Today the master list carries no prioritization metadata — meaning the slices are conceptually defined but not deterministically computable. Tagging each factor with its `weighting_tier` (1–10 per `docs/ALLEGIANT_SEO_WEIGHTING_MODEL.md`) is the mechanism that turns this SOP from "framework + slotting logic" into "executable playbook." **Deferred to Phase 2, after 5–10-partner SOP calibration** — tagging before calibration risks locking in assumptions the data may move. Until this tagging is complete, this SOP acknowledges that it is a categorization framework, not a full methodology.

3. **Routing tool (interactive).** Manual SOP application is correct now. Build software only when all three Section 8 triggers fire — that's the operational discipline against premature engineering.

---

## Appendix A — Local-service vertical enumeration

See `schemas/local-service-verticals.json`. 354 verticals across 17 categories, schema-conformant (8 keys per vertical), all IDs unique. 80 YMYL-flagged including 2 Allegiant policy decisions: `cryotherapy_studio` (therapeutic claims routine) and `residential_real_estate_brokerage` (sits atop the largest financial transaction most consumers make).

## Appendix B — Master factor reference

See `docs/ALLEGIANT_MASTER_FACTOR_REFERENCE.md`. 263 factors across 9 parts (On-Page / Off-Page / Technical / UX / E-E-A-T / Local / AI SEO / Platform-Specific / Measurement & Governance), each specified to a uniform 7-field template. Prioritization per `docs/ALLEGIANT_SEO_WEIGHTING_MODEL.md`. `weighting_tier` factor tagging is Phase 2 work (see Section 12.2).

## Appendix C — Partner reference key (internal only)

**Not for external distribution.** For internal audit trail supporting Section 11 (Validation status):

- **Partner A** — Kirchner Electric (residential electrician, single-market local)
- **Partner B** — Tucker Albin & Associates (commercial collections, national B2B)
- **Partner C** — Armstrong Repair (commercial kitchen equipment repair, single-market local)

These identifiers appear in the routing decision artifacts (`data/routing-decisions/`) but not in the SOP body. When quoting SOP validation status in partner-facing or external material, use the anonymized identifiers (Partner A / B / C) only. This appendix is preserved for internal review of the validation claim and gets updated only when the validation set changes.
