# Routing SOP — Tier-1 P4 Human Peer Review Worksheet (Signed)

**Document under review:** `docs/ALLEGIANT_ARC_ROUTING_SOP.md` (v1.1 at review time; v1.2 as of author response)
**Reviewer:** Mike Small
**Role:** Director of Production, Allegiant Digital Marketing
**Review dates:** 2026-06-24 through 2026-06-30

---

## What this worksheet is

A structured pass through the Allegiant Gauntlet's P4 (four hostile reads) applied to the routing SOP. An AI did an initial P4 pass during the SOP's authoring; this is the **human** P4 that the Gauntlet v2.1 §I.B requires before an SOP can govern paid production.

**Status:** ✅ SIGNED AND COMPLETE. Findings folded into SOP v1.2.

---

## Read 1 — CFO

### Finding 1

**Excellent:** The routing framework clearly creates more value than relying solely on strategist judgment because it establishes consistency, reduces onboarding time, and creates an auditable decision trail.

**Potential Update:** The SOP could define measurable success criteria for the routing model itself. Without KPIs, Allegiant cannot determine whether the routing decisions are actually improving outcomes over time.

**Disposition:** Required Change

### Finding 2

**Excellent:** The SOP correctly postpones software automation until sufficient volume exists. That is the appropriate business decision today.

**Potential Update:** The document could clearly identify the trigger that justifies moving from manual routing to automation (for example, partner volume, monthly routing frequency, or routing time per strategist). Otherwise, automation becomes subjective rather than economically driven.

**Disposition:** Required Change

### Finding 3

**Excellent:** The human-review path is appropriately conservative, but...

**Potential Update:** Step 0 may create operational bottlenecks if parser warnings become common during template evolution. The SOP should require periodic review of Step 0 trigger frequency so that excessive false positives do not become hidden production cost.

**Disposition:** Required Change

---

## Read 2 — Competitor

### Finding 1

**Excellent:** The routing logic itself is solid...

**Potential Update:** but today the competitive advantage resides almost entirely in the decision tree. The actual execution playbooks behind Foundation-First, Citation-Capture, and Vertical-Slice still appear to be developing. A competitor with mature implementation playbooks could reasonably argue that Allegiant has categorized work better than it has operationalized it.

**Disposition:** Required Change

### Finding 2

**Excellent:** The SOP repeatedly acknowledges that several thresholds are "starting cuts." Internally this is appropriate, but...

**Potential Update:** these values should likely not appear in partner-facing material until validated with production data. A competitor could easily criticize arbitrary thresholds and raise doubt.

**Disposition:** Required Change

### Finding 3

**Very Good:** The terminology is typically very good, but portions of the SOP occasionally read like engineering documentation rather than a strategic methodology.

**Potential Update:** A brief introductory section explaining *why* this routing model improves partner outcomes would strengthen the document and better distinguish Allegiant's approach from a generic audit-fix-grow framework.

**Disposition:** Required Change

---

## Read 3 — Fact-Checker

### Finding 1

**Excellent:** The supporting documentation consistently reinforces the parser architecture, structural variance findings, and schema decisions.

**Potential Update:** Several factual assertions in the SOP depend on implementation artifacts (schema files, parser code, extraction outputs, vertical counts, and completeness calculations) rather than the SOP itself. Those references could potentially be periodically validated during version releases as part of release QA instead of relying on manual spot checks.

**Disposition:** Required Change

*(Note: this finding was flagged Required Change in-line but did not appear in Mike's final rollup. The SOP author elected to include it as Required Change #11, treating it as a governance addition rather than a rollup omission.)*

### Finding 2

**Excellent:** The "critical foundation issue" list is comprehensive, but...

**Potential Update:** a few items appear to mix truly blocking technical failures with severe optimization deficiencies. Missing H1 tags or missing meta descriptions at scale may warrant Foundation routing, but they are generally accepted as lower-severity than DNS failures, broken HTTPS, indexing failures, or unresolved domains. We could potentially consider grouping the list into Critical Infrastructure versus Critical Optimization issues to raise this to the next level.

**Disposition:** Required Change

### Finding 3

**Potential Update:** Operator input C2 ("Do ≤5 pages generate the majority of leads?") appears to rely on operator knowledge rather than measurable intake data. Wherever possible, this should eventually be derived from analytics or intake-form data instead of institutional memory.

**Disposition:** Required Change

---

## Read 4 — Lawyer

### Finding 1

**Excellent:** The SOP consistently refers to a "recommended entry sequence," which appropriately limits liability. That wording should remain consistent throughout future revisions. Any language implying the router determines the objectively correct path should be avoided.

**Disposition:** No Change Required

### Finding 2

**Excellent:** The compliance brake is one of the strongest sections of the SOP. However...

**Potential Update:** the document could benefit from explicitly defining who qualifies as the required second approver when overriding compliance decisions. "Operator" is too broad for an operating standard.

**Disposition:** Required Change

### Finding 3

**Excellent:** The SOP currently references actual partner names as routing examples.

**Potential Update:** While acceptable for internal engineering documentation, an operating standard would be stronger if those examples were anonymized (Partner A, Partner B, etc.) or moved into separate test fixtures. This reduces unnecessary confidentiality concerns and keeps the SOP focused on process rather than specific engagements.

**Disposition:** Required Change

---

## Overall Disposition

☒ **CLEARED WITH REQUIRED CHANGES**

- The routing methodology itself is sound.
- The gate sequence is logical.
- The compliance brake is appropriately conservative.
- The supporting parser architecture, schema decisions, and structural variance analysis demonstrate that substantial engineering thought has gone into the system.
- The remaining issues are primarily governance, maintainability, calibration, and operational clarity rather than flaws in the routing model itself. **None of the required changes alter the routing logic.**

### Required Changes (per Mike's rollup)

1. Define measurable success metrics for the routing model (CFO).
2. Define objective criteria for when routing automation becomes economically justified (CFO).
3. Add periodic review of Step 0 false-positive rates (CFO).
4. Complete the implementation playbooks behind each routing sequence before presenting the methodology as a competitive differentiator (Competitor).
5. Keep routing thresholds internal until validated with production data (Competitor).
6. Add a brief business rationale explaining why the routing model exists before introducing the gates (Competitor).
7. Separate Critical Infrastructure failures from Critical Optimization failures within Gate 1 (Fact Checker).
8. Replace operator memory for C2 with measurable intake or analytics data when feasible (Fact Checker).
9. Define the minimum authority required for compliance override co-signers (Lawyer).
10. Consider anonymizing partner examples or moving them into engineering test documentation (Lawyer).
11. Add release QA process for factual claim verification against implementation artifacts (Fact Checker — inclusion by SOP author from Read 3 Finding 1).

### Risks Accepted As-Is

- Initial routing thresholds are acceptable provided they remain clearly identified as calibration values and are reviewed as production data accumulates.
- Manual routing prior to automation is appropriate at Allegiant's current scale.
- The parser's hybrid deterministic/LLM extraction strategy is well justified and appears maintainable given the documented structural variance across A.R.C. reports.

### Overall Assessment

**Score: 9.5/10**

Most SOPs I've reviewed are either high-level business documents or highly technical engineering specs. This one successfully bridges those worlds. It establishes clear operational rules while remaining implementable in software, and the supporting documentation demonstrates a thoughtful architecture rather than an ad hoc process. The changes above would make it more resilient as an official operating standard without changing the core methodology.

---

## Sign-off

**Reviewer signature:** Mike Small

**Printed name:** Mike Small

**Role:** Director of Production, Allegiant Digital Marketing

**Date:** 2026-06-30

**Reviewer affirms:**

- ☒ I have read the SOP under review in full
- ☒ I have applied each of the four reads distinctly, not collapsed
- ☒ The findings above are mine, not generated or assisted by AI
- ☒ I have no undisclosed conflict of interest in the SOP being adopted

---

## SOP author response

**Author:** Chad Markham, President/CEO, Allegiant Digital Marketing
**Response date:** 2026-07-01

All 11 required changes folded into v1.2. Six were self-contained edits I authorized directly; five required specific policy decisions on scope, thresholds, and org structure. The five policy decisions:

- **Success metrics (Change 1):** all three — override rate, partner satisfaction @ 90 days, time-to-first-shipped-page — adopted as provisional starting cuts pending calibration.
- **Automation trigger criteria (Change 2):** cleaner set adopted (volume · team-scale · consistency drift), with provisional labeling and quarterly review under the Gauntlet Part IV calibration loop. Team-scale selected over operator-time as the discrete, less-ambiguous measurement.
- **Playbook completeness (Change 4):** deferred to post-calibration. The `weighting_tier` tagging of the 263-item master reference — per the newly-adopted Allegiant SEO Weighting Model (`docs/ALLEGIANT_SEO_WEIGHTING_MODEL.md`) — is the executable-playbook mechanism. Section 12.2 of v1.2 acknowledges explicitly that until tagging is complete, the SOP is categorization framework, not full methodology.
- **Compliance override authority (Change 9):** Chad Markham (CEO) directly, sole authority pending org-structure changes. Section 7 states the condition for revisiting.
- **Partner anonymization (Change 10):** full anonymization in SOP body (Partner A / B / C). Internal reference key preserved in Appendix C, marked internal-only.

### Changes applied

| # | Required change | Change applied in v1.2 |
|---|---|---|
| 1 | Define measurable success metrics | Section 9 added — override rate, partner satisfaction @ 90d, time-to-first-page. All provisional starting cuts. |
| 2 | Define objective automation triggers | Section 8 added — cleaner set (volume, team-scale, consistency drift) as provisional cuts. Quarterly review per Gauntlet §IV. |
| 3 | Periodic Step 0 false-positive review | Section 10.1 added — quarterly Step 0 trigger-rate check with revisit thresholds. |
| 4 | Complete implementation playbooks | Section 12.2 updated — `weighting_tier` tagging per Weighting Model is the playbook mechanism, deferred to post-calibration. Explicit acknowledgment that until tagged, SOP is framework not methodology. |
| 5 | Keep thresholds internal until validated | Header classification note added; Section 6 opens with internal-only reminder. |
| 6 | Business rationale intro | Section 1 added — "Why this framework exists." |
| 7 | Split Critical Infrastructure vs Optimization | Section 5.1 (Infrastructure) and 5.2 (Optimization) created as sub-lists. Both trigger Gate 1. |
| 8 | C2 references measurable data, not memory | Section 3 C2 wording tightened — operator answers Yes only from analytics or intake data, never memory. |
| 9 | Compliance override authority | Section 7 defines Chad Markham as sole co-signer authority pending org changes. |
| 10 | Anonymize partner examples | Kirchner → Partner A; Tucker Albin → Partner B; Armstrong → Partner C throughout body. Internal reference key in Appendix C, marked internal-only. |
| 11 | Release QA for factual claims | Section 10.2 added — every SOP version bump verifies schema, partner data, and vertical count claims against actual repo files as a Gauntlet P2 pass before commit. |

### Risks accepted as-is

Beyond the risks Mike explicitly accepted in his own list (routing thresholds provisional, manual routing at current scale, parser architecture), no additional risks accepted by author beyond what v1.2 documents.

**Author signature:** Chad Markham

**Date:** 2026-07-01

---

## Status

☒ **CLEARED — OPERATING STANDARD.** All required changes folded into `docs/ALLEGIANT_ARC_ROUTING_SOP.md` v1.2. SOP status banner updated from ⏸ PENDING to ✅ OPERATING STANDARD. Governs live partner builds effective 2026-07-01.
