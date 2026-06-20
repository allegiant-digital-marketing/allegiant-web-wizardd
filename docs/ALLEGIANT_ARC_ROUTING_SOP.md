# Allegiant A.R.C. Routing SOP — Entry-Sequence Decision Logic

**Version:** 1.1
**Dated:** June 20, 2026
**Status:** ⏸ **PENDING TIER-1 P4 HUMAN PEER REVIEW** — not yet operating standard.
**Produced via:** Allegiant Gauntlet (decision-adapted) + P5 dry-run on real extraction data.
**Validation status:** Gate 1 live-validated (3 partners + roadmap corroboration). Gates 2–3, compliance brake, and no-match: logic + schema validated only. Tier-1 human peer review at P4 owed before this governs live builds — see `docs/ROUTING_SOP_P4_REVIEW_WORKSHEET.md`.

---

## Revisions from v1.0

v1.1 closes the five open items identified during the WIZARDD repo integration review:

1. **Local-service vertical set enumerated.** Now references `schemas/local-service-verticals.json` (354 verticals across 17 categories, committed). Gate 2's "vertical is a local-service type" check is now a deterministic lookup, not strategist judgment.
2. **YMYL vertical set enumerated.** 80 verticals in the same file flagged `is_ymyl: true`. The compliance brake now fires on **either** the operator confirm (C3=Yes) **or** the vertical-list match — belt and suspenders.
3. **Persistence location decided.** Routing decisions land at `data/routing-decisions/{arcReportId}-{decisionTimestamp}.json`. The `data/` directory is gitignored (matches existing exclusion for `data/reviewed-records/`).
4. **`completenessScore` semantics corrected in Gate 1.** Gate 1 no longer fires on `completenessScore < 80` as a standalone trigger — the score measures field-population fraction, not extraction success, and a small business with a thin online footprint can score low without any foundation problem. Step 0 catches the actual extraction-failure case via `extractionWarnings`. Gate 1 fires only on **≥1 critical-foundation issue**.
5. **`knownIssues` controlled-vocabulary path noted as Phase 2.** Today this SOP works as a human procedure because a strategist classifies issues by meaning. Automation requires the parser's schema to gain a parallel `knownIssuesCategorized[]` field with enum values. Logged as a Phase 2 schema v1.1 dependency.

---

## What this is

A decision procedure that takes a **completed, human-verified A.R.C.** and outputs the recommended **entry sequence** — which slice of the full 263-item standard (`docs/ALLEGIANT_MASTER_FACTOR_REFERENCE.md`) a partner leads with in the first 60–90 days.

These are **not three destinations.** Every partner reaches the full standard. They are three starting orders: **Foundation-First**, **Citation-Capture**, **Vertical-Slice**.

The sequences are **graduation steps**: a partner routed Foundation-First is re-run against a fresh A.R.C. after the base is fixed, and typically routes Citation-Capture next.

(Entry sequences, not packages — distinct from Pkg A–D.)

## Prerequisite & inputs

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
- **C3 — Compliance class:** regulated / YMYL vertical (medical, legal, financial, etc.)? (Y/N) — *unmissable; this confirm is load-bearing.*

**Vertical references** — the canonical enumerations:

- **Local-service set:** `schemas/local-service-verticals.json` — 354 verticals across 17 categories. Membership = "vertical is a local-service type" for Gate 2.
- **YMYL set:** the 80 verticals flagged `is_ymyl: true` within `local-service-verticals.json`. **Belt-and-suspenders for C3:** even if the operator answers No, the compliance brake fires if the partner's `businessIdentity.vertical` matches an `is_ymyl: true` entry. The stricter of the two answers wins.

## Step 0 — Sufficiency check (run first, gate-agnostic)

If the fields decisive for foundation assessment are **null** AND `extractionWarnings` indicate **un-parsed tabs** (e.g., "Website Audit tab parsing not completed") → **STOP, flag for human review, do not route.**

Distinguish from a fully-read-but-sparse report: warnings saying "9/9 tasks succeeded" with some source fields simply null is **not** insufficient signal — it routes normally. (Real example: Tucker and Armstrong both came back `completenessScore: 80` with all tasks succeeded — sparse source, not failed read.)

**`completenessScore` semantics:** the score measures the fraction of expected schema fields that landed values, not "did extraction succeed." A small business with a thin online footprint can score 70 without any extraction failure. Use the score as supporting context only; the extraction-failure case is what Step 0 catches via `extractionWarnings`.

## Critical-foundation issue checklist (drives Gate 1)

Classify `website.knownIssues[]` (plus reviews/social for NAP). **A critical issue = the base can't hold an AI citation or rank reliably:**

- Schema / JSON-LD absent
- Not indexed · missing XML sitemap · missing robots.txt
- Apex domain unresolved · broken HTTPS · security headers absent
- Severe load failure (mobile LCP ≫ 4s — e.g. ≥ 8s)
- Broken links at scale (404s)
- Live placeholder / lorem-ipsum content in production
- Severe NAP inconsistency across directories
- Missing H1 / missing meta descriptions at scale
- Duplicate content at scale (≫ 10%)

**Cosmetic-only — does NOT trigger Gate 1:** a single missing alt text, tap targets too close, one missing meta tag.

> *Wording varies across reports — "Schema markup not detected" (Tucker) = "Zero JSON-LD structured data" (Armstrong). A human classifies by meaning. **When this is automated, the matcher needs a controlled vocabulary or it will miss** — flagged as the key automation dependency (Phase 2 schema work).*

## The priority tree (first match wins)

**GATE 1 — Foundation-First.**
Fire if **≥ 1 critical-foundation issue present**.
→ Lead with **Technical → On-Page → Content/E-E-A-T** (master-list Parts 3 → 1 → 5).
Secondary lean: **Citation-Capture** on re-run after the base is fixed.

**GATE 2 — Vertical-Slice.** *(Reached only if the base is sound — Gate 1 did not fire.)*
Fire if **any** of:

- Local single-market: `businessIdentity.vertical` ∈ `schemas/local-service-verticals.json` **AND** `targetLocations[]` shows no national entry
- C2 = Yes (≤5 pages generate majority of leads)
- C1 = Yes (quick-win mandate)

→ Build complete money-page slices end-to-end, ship fast, expand.

**⚠ COMPLIANCE BRAKE:** if **C3 = Yes** OR `businessIdentity.vertical` matches a vertical flagged `is_ymyl: true` in `schemas/local-service-verticals.json`, Vertical-Slice does **not** fire bare → output **"Vertical-Slice + mandatory compliance scaffolding"** (the slice must carry the vertical's required disclaimers, credentials, claim-substantiation, etc.). **Never a thin ship-fast slice for a regulated/YMYL partner.**

If the operator's C3 answer contradicts the YMYL vertical-list match, the brake fires regardless — the stricter answer wins, and the override record captures the operator's reasoning.

**GATE 3 — Citation-Capture.** *(Default: sound base, broad/national footprint, no urgency.)*
Drive off the AI gap: low `avs` (< ~40, uncalibrated starting cut) and/or low `citationCount`.

**Degrade field-by-field** — use whichever AI fields are present. If **both** `avs` and `citationCount` are null → insufficient signal → flag-for-review or default to Standard with a note. *(avs does not travel as a bundle: Armstrong had avs=38 but null citationCount.)*

→ Lead with **AI / GEO** (master-list Parts 7–8) on the existing base.

**NO-MATCH.** *(None fire: sound base, broad footprint, no urgency, AND adequate AI visibility — e.g. `avs` ≥ ~60.)*
→ **Standard full-roadmap sequencing**, or operator selects. A defined response — never returns nothing.

## Output & persistence

Every routing produces:

- **Recommended entry sequence** (primary) **+ secondary lean** — always framed "recommended," never "the correct path"
- **Signals that fired** — the specific field values / critical issues that drove the decision (shown, not hidden)
- **Compliance-scaffolding flag** (if the brake fired) + reason (C3=Yes / vertical-is-YMYL / both)
- **Source A.R.C. URL + `extractedAt` + staleness flag** — the recommendation is only as current as the A.R.C.
- **Operator name + decision timestamp** (attribution — this gates paid production)
- **Override record** (if the operator overrides the recommendation, with reason) — overriding the compliance brake specifically carries heightened accountability and must be co-signed by a second operator

**Persistence location:** `data/routing-decisions/{arcReportId}-{decisionTimestamp}.json`. The `data/` directory is gitignored (matches existing exclusion for `data/reviewed-records/`). Each routing decision is a standalone JSON artifact, locally persisted, retrieved by report ID for re-runs and audit.

Not an ephemeral screen — every routing decision is an attributed JSON file the build queue can pick up.

## Validation status & governance

- **Gate 1 — live-validated.** Kirchner, Tucker Albin, and Armstrong all routed Foundation-First on real extraction data; independently corroborated by each report's own Phase-1 roadmap ("Foundation — Fix, Optimize, Launch" / "Foundation Fix, Claim, Cleanse"). The strategist who authored the A.R.C. reached the same lead the tree does.

- **Gates 2–3, compliance brake, no-match — logic + schema validated, not live.** The real sample was foundation-broken across the board; the compliance brake only bites a *healthy-based* YMYL-local partner, which this pipeline rarely produces.

- **Uncalibrated starting cuts** pending outcome data: `avs` < 40 (low) / ≥ 60 (adequate); "severe" LCP ≥ 8s; ≤ 5 revenue pages. **Recalibration owed after 5-10 manual SOP applications generate outcome data.**

- **Tier-1 gate:** because this routes a paid production process, a **human peer reviewer must sign off at Gauntlet P4** before it governs live builds. AI review does not substitute. **Current status: pending** — review worksheet at `docs/ROUTING_SOP_P4_REVIEW_WORKSHEET.md`.

- **Re-run on a fresh A.R.C. after foundation work** — the sequences are graduation steps, not permanent labels.

## Phase 2 dependencies (deferred — do not block adoption)

Known gaps that don't block adoption today but constrain automation later:

1. **`knownIssues` controlled vocabulary.** Today this SOP works as a human procedure because a strategist classifies the issues by meaning. The day this becomes software, the parser's schema needs to gain a parallel `knownIssuesCategorized[]` field with enum values (e.g., `["schema_missing", "not_indexed", "no_sitemap", "severe_lcp", "broken_links_scale", ...]`). The existing freeform `knownIssues[]` stays for human readability; the categorized field is what the router consumes. **Future schema v1.1.**

2. **Master factor reference tier tagging.** The three entry sequences pull ordered slices from the 263-item master list (`docs/ALLEGIANT_MASTER_FACTOR_REFERENCE.md`). Today the master list isn't tagged per-factor as Foundation-tier / Citation-Capture-tier / Vertical-Slice-tier — meaning the slices are conceptually defined but not deterministically computable. Tagging the master list against the three sequences turns this SOP from "recommendation framework" into "executable playbook." **Future Phase 2 work, after 5–10-partner SOP calibration.**

3. **Routing tool (interactive).** Manual SOP application is correct now. Build software when (a) operator consistency matters across multiple strategists, (b) the persisted-artifact requirement gates production volume, or (c) the WIZARDD generation layer needs programmatic routing decisions. None are true yet.

## Appendix A — Local-service vertical enumeration

See `schemas/local-service-verticals.json`. 354 verticals across 17 categories, schema-conformant (8 keys per vertical), all IDs unique. 80 YMYL-flagged including 2 Allegiant policy decisions: `cryotherapy_studio` (therapeutic claims routine) and `residential_real_estate_brokerage` (sits atop the largest financial transaction most consumers make).

## Appendix B — Master factor reference

See `docs/ALLEGIANT_MASTER_FACTOR_REFERENCE.md`. 263 factors across 9 parts (On-Page / Off-Page / Technical / UX / E-E-A-T / Local / AI SEO / Platform-Specific / Measurement & Governance), each specified to a uniform 7-field template. The routing SOP's three entry sequences will eventually pull tier-tagged slices from this reference once Phase 2 tagging is complete.
