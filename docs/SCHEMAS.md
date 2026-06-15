# Schema Decisions

This document records the reasoning behind every meaningful schema decision in `schemas/`. When a future session or developer needs to know *why* a field is shaped a certain way — read this first instead of guessing.

Last updated: June 15, 2026

---

## The two-input model

**Decision.** Web WIZARDD requires exactly two inputs: an A.R.C. Report URL and the Web WIZARDD intake form. There is no separate ICP Strategy URL input.

**Why.** As of June 2026, every A.R.C. Report contains the partner's personas inline (the `audience` section with full persona profiles, buying journey, decision drivers, and channel map). The standalone ICP Strategy docs that previously lived at `webb-pest-icp.netlify.app`, `laurie-flood-icp-strategy.netlify.app`, `austin-moon-icp-strategy.netlify.app`, etc. are no longer being produced separately. Requiring two URLs when one carries all the data would be pointless ceremony.

**Architectural consequence.** Ingestion has one parser, not two. Manual Override Mode has one possible missing input, not two independent ones. Cross-document consistency checks (business name in A.R.C. == business name in ICP) are no longer needed — the data is structurally co-located.

---

## "Personas" vs "ICPs" terminology

**Decision.** Schema fields use **`personas`**, not `icps`.

**Why.** The new A.R.C. format uses "personas" (P1, P2, etc.) as the field label. The standalone ICP docs used "ICPs" (ICP 01, ICP 02, etc.). Both terms refer to the same architectural concept — a fully-developed buyer archetype with trigger, mindset, channel behavior, and decision profile.

We standardize on **personas** because that's what new A.R.C. Reports will say, and the schema should match the source vocabulary to keep downstream code intuitive. The SOP language should be updated to read "ICPs (personas)" at first reference and "personas" thereafter — flagged for the v1.1 SOP revision per the post-build review plan.

---

## Persona weighting — `weightingHint` rather than `weight`

**Decision.** The persona object has a `weightingHint` field (number from 0 to 1, sum across all personas should approximate 1.0), not a strict `weight` field.

**Why.** Standalone ICP docs (Webb Pest, Austin Moon) gave explicit social-calendar weighting per ICP — "~70% ICP 01, ~20% ICP 02, ~7% ICP 03, ~3% ICP 04." The new A.R.C. format does not give explicit numeric weights per persona; it categorizes by tier (Primary / Secondary) plus a sub-label (Highest Value, Growth Segment, Highest LTV, Emergency Capture).

Until the A.R.C. template adds an explicit weight field (proposed as a v2 enhancement), the parser must infer weighting from the tier + sub-label combination. The `weightingHint` name signals that this is an inferred value, not an authoritative one — Generation can use it as a starting point, but builder review can override.

**Default inference table** (applied by the parser when no explicit weight is present):

| Tier + sub-label                        | Default weight |
| --------------------------------------- | --- |
| Primary · Highest Value                 | 0.25 |
| Primary (no sub-label)                  | 0.20 |
| Primary · Growth Segment                | 0.15 |
| Secondary · Highest LTV                 | 0.10 |
| Secondary · Emergency Capture           | 0.15 |
| Secondary (no sub-label)                | 0.10 |

These should sum to approximately 1.0 across the persona roster. If they don't, the parser normalizes. Builders can override any weighting before Generation runs.

---

## Buying journey — flexible stage count

**Decision.** `audience.buyingJourney.stages` is an open array, not a fixed 3-stage or 4-stage structure.

**Why.** Standalone ICP docs used a 4-stage journey (Trigger → Vetting → Decision → Retention). The Kirchner A.R.C. uses a 3-stage journey (Search & discover → Evaluate & compare → Validate & decide). Future A.R.C.s may use different counts depending on the vertical (commercial sales cycles often need 5+ stages).

Forcing every A.R.C. into the same stage count would lose fidelity. The schema accepts any number of stages, each with a step number, name, optional description, and optional channel list.

---

## Channel priority — strict enum + free-text notes

**Decision.** `audience.channelMap.priority` is a strict enum (`Critical`, `High`, `Rising`, `Supporting`, `Low`). Nuance lives in the optional `priorityNotes` field.

**Why.** Critical / High / Rising / Supporting / Low gives Generation a clean signal for content emphasis. But the Kirchner A.R.C. surfaced a real case where LinkedIn is "Low overall, high for Carla" — the channel doesn't matter for five of six personas, but is the sole vetting channel for the highest-LTV persona.

If we let `priority` be free-text, downstream code can't sort or filter by priority cleanly. If we omit the nuance, we lose strategic intelligence. The split — enum base + free-text modifier — keeps both.

---

## Social platform schema — every platform always present

**Decision.** Every social platform in `currentDigitalPresence.social` is a full `socialPlatform` object. A platform the partner has no presence on is represented with `status: "missing"`, not by omitting the field or setting it to `null`.

**Why.** Three reasons:

1. **Consistency for parsers.** Code can always iterate over a fixed set of platforms instead of branching on "does this key exist."
2. **Strategic information.** "No TikTok presence" is itself meaningful — for Kirchner, the Vanessa persona (mobile-first, EV-curious) consumes EV creator content on TikTok, so absence is a flagged gap.
3. **Gauntlet inputs.** The CEILING check that audits whether the site addresses the partner's actual digital gaps reads from `currentDigitalPresence.social` to identify which platforms the new site should account for in its CTAs and trust signals.

If a platform genuinely has no relevance for the partner's vertical (TikTok for a B2B industrial manufacturer, say), the parser may emit a warning but still populate the object with `status: "missing"`.

---

## Metadata.completenessScore — soft block threshold at 80

**Decision.** Every extracted A.R.C. carries a `metadata.completenessScore` from 0-100. The convention is: scores below 80 should trigger a builder review before Generation runs.

**Why.** A.R.C. templates evolve. A future template may add fields the current parser doesn't know to look for; an older template may be missing fields the current schema expects. Rather than hard-failing extraction or silently producing partial output, the parser records its completeness and the builder makes the judgment call on whether to proceed.

Why 80, specifically? The threshold should be high enough that a builder notices when extraction missed something substantive, but low enough that minor optional-field gaps don't constantly trigger reviews. 80 is the starting threshold; if it produces too many or too few reviews in practice, adjust based on observed signal.

---

## Intake form — `businessName` cross-validates against A.R.C.

**Decision.** `intake-form.partner.businessName` must exactly match `arc-extraction.businessIdentity.businessName`. The tool blocks if they diverge.

**Why.** Catches the "wrong A.R.C. linked to wrong intake" failure mode early — before Generation runs and produces a site that talks about Partner A's services but is branded for Partner B. Specifically this catches the failure where a builder copies an intake from a previous build and forgets to update the partner reference.

Exact match (not fuzzy) is intentional. If the names don't match exactly, the builder either fixes the A.R.C. or fixes the intake, but the tool doesn't guess.

---

## Intake form — `brandAssets.*.available` + `needsRecommendation` flags

**Decision.** Each brand-asset section (logo, colorTokens, typography) has an `available` boolean and a `needsRecommendation` boolean. The relationship between them:

| `available` | `needsRecommendation` | Meaning |
| --- | --- | --- |
| true | false | Partner provided assets; use as-is |
| false | true | No assets; Web WIZARDD composes recommendation from archetype defaults |
| false | false | No assets and partner doesn't want a recommendation (e.g., logo needs separate creation engagement) |

**Why.** Partners come in three states: have assets, don't have assets and want help, don't have assets and want the work scoped separately. The schema distinguishes all three rather than forcing the builder to guess what the partner means by "no logo."

For logo specifically, there's also a `needsCreation` flag that signals "this is out of Web WIZARDD scope and should trigger a separate logo creation engagement notice."

---

## Design archetype — named families, not numbered slots

**Decision.** `designDirection.archetypeFamily` is a named string (`trust-first`, `authority`, `velocity`, `editorial`, `story-driven`) rather than a number or generic label like `direction-a`.

**Why.** Named families carry strategic meaning across builds. "Trust-First" is the same concept whether it's HVAC or legal or RIA M&A — review depth, longevity, credentialing above the fold. Numbered slots would lose that conceptual continuity and force the team to re-explain the design philosophy on every build.

The Generation layer maps the archetype family to vertical-specific component compositions. For home services, Trust-First emphasizes Google reviews + years operating + Google Guaranteed badge. For legal, the same Trust-First archetype emphasizes case results + bar admissions + named partners + verdict tickers. Same archetype, different component vocabulary.

---

## Service-page selection — exact string match against A.R.C.

**Decision.** `intake-form.pageSelection.interiorServicePage.serviceName` must exactly match one of the `name` values in `arc-extraction.targetServices`. The tool cross-validates.

**Why.** Prevents the builder from selecting an interior service page that doesn't exist in the partner's actual service catalog from the A.R.C. — which would force Generation to either invent service content or fail. Exact match also catches typos and capitalization drift that would otherwise quietly break Generation prompts.

---

## What is NOT in these schemas (and why)

A few things you might expect to find but won't:

- **No `tone` field.** Partner voice is derived from the personas they're speaking to (each persona's `mindset` + `trigger` + `decisionWindow` defines the appropriate tone). A separate `tone` field would either duplicate that signal or contradict it.
- **No `wordCount` targets.** Page length is determined by the design archetype + page type, not by a fixed input. Generation's word-count targets live in the archetype configs, not the schemas.
- **No `seoKeywords` array.** Target keywords are derived from `targetServices` + `targetLocations` combinatorially. A separate keyword input would risk drift from the actual service/location commitments.
- **No `competitorWebsiteContent` field.** That data is collected by the Research layer at build time, not provided up-front. Schemas describe inputs; Research is downstream.

When you find yourself wanting to add a field to one of these schemas, the test is: **does this data exist in the partner's A.R.C. or intake conversation, or is it computed by a downstream layer?** If computed downstream, it doesn't belong in the input schema.
