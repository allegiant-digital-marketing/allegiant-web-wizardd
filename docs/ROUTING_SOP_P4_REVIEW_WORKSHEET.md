# Routing SOP — Tier-1 P4 Human Peer Review Worksheet

**Document under review:** `docs/ALLEGIANT_ARC_ROUTING_SOP.md` (v1.1)
**Reviewer:** _______________________________
**Role:** _______________________________
**Date:** _______________________________

---

## What this worksheet is

A structured pass through the Allegiant Gauntlet's P4 (four hostile reads) applied to the routing SOP. An AI did an initial P4 pass already during the SOP's authoring — this is the **human** P4 the SOP itself says is owed before it governs paid production. Until this worksheet is signed at the bottom, the SOP is pending — not operating standard.

**Time required:** ~60–90 minutes if done thoroughly.

## How to use it

1. Read `docs/ALLEGIANT_ARC_ROUTING_SOP.md` first — one pass, no marks. Get the whole framework in your head.
2. For each of the four reads below, put on that hat **specifically** — don't blend them. The four reads are kept distinct deliberately; that's where the discipline comes from.
3. For each finding, mark disposition: **No change required / Required change / Blocks adoption**.
4. Roll the four reads up into an overall disposition at the bottom.
5. Sign off.

The pre-populated content in each section is **what the AI P4 already found**. Your job is to (a) pressure-test whether those findings are right, (b) find what the AI missed, and (c) apply production-side judgment AI can't bring.

---

## Read 1 — CFO

**The role you're playing:** the executive who has to justify the cost of this SOP existing — both the time to apply it per partner, and any future engineering it implies. You're looking for hidden cost, marginal value, and downside.

**Questions to pressure-test:**

- Is the marginal value of this SOP positive vs. just having strategists eyeball each A.R.C. and use judgment?
- What does misrouting actually cost in dollars? (Wasted production hours, partner churn, reputation damage if results don't materialize)
- Is the cost of Step 0's "flag for human review" higher than the cost of just routing everyone and inspecting outliers?
- The SOP defers building software until volume justifies. Does that math seem right given Allegiant's current partner count and growth trajectory?
- Hidden costs: training time for new strategists, edge-case adjudication overhead, the 5–10-partner calibration period before the thresholds harden

**What the AI P4 already found (CFO read):**

> A 3-gate tree is simple enough to run by hand. What's the marginal value of building software over publishing the priority tree as a one-page decision SOP that strategists apply — and automating only once volume justifies it? Software earns its cost on (a) operator consistency, (b) the persisted attributed artifact the paid-production gate needs, and (c) programmatic feed into WIZARDD later. If those aren't needed yet, the interactive is premature.
>
> Also: misrouting a broken-base partner to Citation-Capture has real cost — wasted production + a partner who doesn't get results. The human-override path must be explicit, not implied.

**Your findings:**

| # | Finding | Disposition |
|---|---|---|
| 1 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |
| 2 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |
| 3 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |

---

## Read 2 — Competitor

**The role you're playing:** a competing agency that wants to point out why this SOP is unimpressive, generic, or worse than what they offer. Argue your competitor's side honestly — what would they attack?

**Questions to pressure-test:**

- Is "Foundation → Citation-Capture → Vertical-Slice" actually a novel framework, or is it rebranded "audit-fix-grow"?
- What's the unique Allegiant value vs. a generic SEO playbook a competitor could draft in a week?
- Are the thresholds (`avs<40`, `LCP≥8s`, `≤5 pages`) defensible, or could a competitor make us look amateur for citing uncalibrated numbers in client-facing material?
- Does the language read as "we have a method" or as "we have a procedure document"?
- What would a competitor exploit in front of a prospect? ("They route everyone to Foundation work because their thresholds are arbitrary…")

**What the AI P4 already found (Competitor read):**

> The router outputs a model label and an ID list — but the differentiated value, the ordered vertical-tuned playbook, doesn't exist until Phase 2 fill-in catches up behind those IDs. Until then, a rival with a fleshed-out playbook beats a labeled bucket.
>
> And the thresholds (LCP > 4s, avs < 40, ≤5 pages) are unsourced cut points with zero calibration data — confidently wrong is worse than vague.

**Your findings:**

| # | Finding | Disposition |
|---|---|---|
| 1 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |
| 2 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |
| 3 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |

---

## Read 3 — Fact-Checker

**The role you're playing:** an editor who treats every factual claim in the SOP as guilty until proven. Don't take any premise on trust.

**Premises to specifically verify** (check each one against the actual files):

- [ ] `schemas/local-service-verticals.json` exists, contains exactly 354 verticals, 17 categories
- [ ] 80 verticals in that file are flagged `is_ymyl: true`
- [ ] All schema field references in the SOP exist in `schemas/arc-extraction.schema.json`: `website.lcpMobileSeconds`, `website.knownIssues[]`, `aiVisibility.avs`, `aiVisibility.citationCount`, `targetServices[]`, `targetLocations[]`, `businessIdentity.vertical`, `metadata.completenessScore`, `metadata.extractionWarnings`
- [ ] The claim "Kirchner, Tucker Albin, and Armstrong all routed Foundation-First" — pull each partner's parsed extraction and re-walk the tree manually. Do they?
- [ ] The claim "`completenessScore` measures fraction of expected schema fields populated, not extraction success" — verify by reading `src/layers/1-ingestion/index.js`, function `computeFinalCompleteness`
- [ ] Tucker's reported A.R.C. issues — schema absent, broken links, lorem ipsum live — verify these are in the actual extraction
- [ ] Armstrong's reported issues — no JSON-LD, no robots.txt, no sitemap, apex doesn't resolve — verify in actual extraction
- [ ] The "9/9 tasks succeeded" claim for Tucker and Armstrong — verify in `metadata.extractionWarnings`

**Other questions:**

- Is the critical-foundation issue checklist complete? Anything missing? (Look at recent A.R.C.s for issues you've seen that aren't on the list)
- Are any of the cosmetic-vs-critical classifications wrong? (E.g., is "missing H1 at scale" really critical, or sometimes just a styling artifact?)
- Does "≤5 pages = majority of leads" map to anything measurable in the WIZARDD intake form, or is the operator answering from memory?

**Your findings:**

| # | Finding | Disposition |
|---|---|---|
| 1 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |
| 2 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |
| 3 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |

---

## Read 4 — Lawyer

**The role you're playing:** outside counsel who reads every sentence for worst-case interpretation, attribution risk, and downstream liability.

**Language to specifically scrutinize** (re-read each in its full context):

- [ ] Output framed as "recommended entry sequence" not "correct path" — does this hold everywhere in the SOP, or does some language drift?
- [ ] Compliance brake wording — does the SOP adequately communicate to the operator that bare Vertical-Slice on a YMYL partner is forbidden, not just "preferred against"?
- [ ] The phrase "human peer reviewer must sign off" — does the SOP make clear who is qualified to sign? (Or could anyone in the org claim P4 sign-off?)
- [ ] Persistence record claims to capture "operator name + decision timestamp" — any PII implications? Retention policy needed?
- [ ] Override-of-compliance-brake clause says "must be co-signed by a second operator" — is "operator" defined? Does this need to be a specifically senior role?
- [ ] "Uncalibrated starting cuts" — does labeling them this way actually protect Allegiant if a routing decision based on them turns out wrong for a partner?
- [ ] References to specific real partners by name (Kirchner, Tucker, Armstrong) in the procedure document — any partner-confidentiality concerns? Should they be anonymized to "Partner A / B / C"?

**Other questions:**

- Compliance-brake failure modes: what if the operator answers "No" on C3 for a partner who IS YMYL by vertical-list match? (SOP says the brake fires anyway — is the wording strong enough?)
- What if the operator's C3 contradicts the YMYL flag for the partner's vertical? Whose answer wins, and is that documented clearly enough that two operators would interpret it the same way?
- Worst-case scenario: SOP is followed exactly and a regulated partner suffers a compliance event in their content. Does the SOP's own language increase or decrease Allegiant's exposure?

**Your findings:**

| # | Finding | Disposition |
|---|---|---|
| 1 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |
| 2 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |
| 3 |   | ☐ No change · ☐ Required change · ☐ Blocks adoption |

---

## Overall disposition

Sum the findings across all four reads. Then check ONE:

- ☐ **CLEARED** — no required changes; SOP is operating standard as written.
- ☐ **CLEARED WITH REQUIRED CHANGES** — list the required changes below; SOP becomes operating standard after the author folds them in and the changes are version-committed.
- ☐ **NOT CLEARED** — substantive issues block adoption. List specifics; SOP returns to author for rework before re-review.

### Required changes (if any)

Number, describe, and reference which read surfaced it:

1.
2.
3.

### Risks accepted as-is (if any)

Things you noted but explicitly accept rather than require changes:

1.
2.

---

## Sign-off

**Reviewer signature:** ____________________________________________

**Printed name:** _______________________________

**Role:** _______________________________

**Date:** _______________________________

**Reviewer affirms:**

- ☐ I have read the SOP under review in full
- ☐ I have applied each of the four reads distinctly, not collapsed
- ☐ The findings above are mine, not generated or assisted by AI
- ☐ I have no undisclosed conflict of interest in the SOP being adopted

---

## SOP author response

*To be filled by SOP author (Chad Markham) after the reviewer signs off.*

For each required change, document what was changed in v1.2 and where:

| # | Required change | Change applied | Commit hash |
|---|---|---|---|
| 1 |   |   |   |
| 2 |   |   |   |
| 3 |   |   |   |

For any risks accepted as-is, document why:

1.
2.

**SOP author signature:** ____________________________________________

**Date:** _______________________________

---

## Closing this loop

**Once both signatures are present AND required changes are folded in:**

1. Update the SOP's status header from `⏸ PENDING TIER-1 P4 HUMAN PEER REVIEW` to `✅ OPERATING STANDARD — cleared at P4 by [reviewer], [date]`
2. Commit the updated SOP and this signed worksheet to the repo
3. The routing SOP is now operating standard at Allegiant — every paid partner build flows through it.
