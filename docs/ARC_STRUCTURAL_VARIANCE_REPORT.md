# A.R.C. Structural Variance Report

**Sample.** Four production A.R.C. Reports across four verticals: Kirchner Electric (electrician), EvolvE Cryo + Wellness (med spa / wellness), Tucker, Albin and Associates (collections agency), Armstrong Repair Center (commercial kitchen appliance repair).

**Purpose.** Document which parts of the A.R.C. structure are reliable for deterministic regex/cheerio extraction, which parts vary in ways that require LLM-based extraction, and which parts have edge cases the parser must handle gracefully.

**Generated.** June 15, 2026 (Phase 1 of Web WIZARDD build).

---

## Stability tiers

The 4-sample sweep grouped every structural element into one of three reliability tiers.

### Tier 1 — Identical across all 4 samples (100% reliable)

The parser keys off these without fallback. If they ever break, the source template has changed and the parser should refuse to process rather than guess.

| Element                            | Selector / pattern                                     |
| ---------------------------------- | ------------------------------------------------------ |
| Panel structure (13 tabs)          | `[id^="panel-"]` with consistent IDs across all 4      |
| Business name                      | `.cover-company` (always single instance, always populated) |
| Persona card container             | `.persona-card` (primary variant: `.persona-card.pri`) |
| Persona card title                 | `.pc-title`                                            |
| Persona card role / context        | `.pc-role`                                             |
| Persona card stats (trigger/mindset/device) | `.pc-stat` with `<strong>Label:</strong>` pattern  |
| Persona tier badge                 | `.pc-badge` (with `.pri` / `.sec` modifier)            |
| Persona modal id pattern           | `#p1` through `#p6`                                    |
| Persona modal sections             | `.m-section` with `.m-section-title` labels            |
| Persona modal demographics         | `.m-demo` with `<strong>Label:</strong>` pattern       |
| Persona modal psychographics       | `.m-psycho-item` → `.m-psycho-label` + `.m-psycho-val` |
| Persona modal online behavior      | `.m-behavior` → `.m-behavior-icon` + `.m-behavior-text` |
| Persona modal customer journey     | `.m-journey-step` → `.m-journey-label` + `.m-journey-desc` |
| Persona modal search terms         | `.m-search-tag`                                        |
| Competitor entries                 | `.comp-name` within `#panel-s7` (first = partner, drop) |
| Competitor stats                   | `.comp-stat-val` + `.comp-stat-label` adjacency        |
| Decision drivers                   | `.driver` → `.driver-rank`, `.driver-title`, `.driver-desc` |
| Channel map rows                   | `.channel-row` → `.channel-name`, `.channel-use`, `.channel-priority` |

### Tier 2 — Multiple known patterns (handle with fallback chain)

The parser tries patterns in order of frequency. If all known patterns fail, the field becomes an extraction warning and routes to the LLM extractor.

| Element             | Patterns found                                                      | Parser behavior                                       |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| AVS score display   | (a) `.ai-hero-score` text (3 of 4 samples), (b) `.gauge` + numeric div nearby (Kirchner) | Try (a), fall back to (b), fall back to LLM           |
| Channel priority    | (a) clean enum text "Critical"/"High"/etc., (b) enum + parenthetical nuance like "Low (high for Carla)" | Strip parenthetical to `priorityNotes`, keep base in `priority` enum |
| Tab nav wiring      | (a) `onclick="switchTab(...)"`, (b) `data-target=...` + onclick (Kirchner), (c) neither (Evolve/Tucker — panels only) | Parser keys off panel IDs, ignores tab buttons entirely |
| Persona naming      | (a) Real-name personas (Kirchner: "Heather & Mark Thompson"), (b) archetype labels (others: "The Multi-Unit Restaurant Operator") | Same `.pc-title` selector captures both. Generation layer adapts copy treatment |

### Tier 3 — Prose-heavy / variant fields (LLM extraction required)

These are not reliably extractable with selectors. The LLM extractor (when wired) reads scoped HTML and produces structured output.

| Field                                    | Why LLM                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `businessIdentity.vertical`              | Not labeled directly; inferred from context. Regex fallback uses keyword heuristics that handle the common cases; LLM provides better coverage on edge verticals. |
| `businessIdentity.subVertical`           | Same as above                                                           |
| `businessIdentity.zone`                  | Sometimes in Cover, sometimes in Investment tab, sometimes absent       |
| `businessIdentity.yearsOperating`        | Free-text mention in Word from Founder or Audience prose                |
| `businessIdentity.tagline`               | Variable position; sometimes absent                                     |
| `businessIdentity.founderNarrative`      | Full prose section that should be preserved with paragraph structure    |
| `targetServices[]`                       | Sourced from a combination of Audience Opportunity + Audience + Roadmap; the names vary in format and the service-to-persona mapping is implicit |
| `targetLocations[]`                      | Mentioned across Cover, Audience, Audience Opportunity; not in a single structured list |
| `painPoints[]`                           | Spread across Website Audit + Reputation + AI Visibility + Social & Ads; no single source |
| `roadmap.phases[]`                       | Structure (titles, count) varies                                        |
| `roadmap.packages[]`                     | Tier labels (A/B/C/D vs Good/Better/Best/Great — Tucker Albin uses the latter) and contained services vary |
| `audience.buyingJourney`                 | Aggregate journey has 3, 4, or 5 stages depending on vertical           |
| `aiVisibility.platforms.*`               | Per-platform details are buried in prose, not in structured fields      |
| `aiVisibility.disciplineScores.*`        | Same                                                                    |
| `currentDigitalPresence.*`               | Spread across Website Audit, Reputation, Social & Ads; no single map    |

---

## Cross-sample data spot-check

The four parsed outputs, key extractions:

| Partner                        | Vertical (inferred)        | Personas | Competitors | AVS  | Decision drivers | Channels |
| ------------------------------ | -------------------------- | -------- | ----------- | ---- | ---------------- | -------- |
| Kirchner Electric              | electrician                | 6        | 5           | 16   | 6                | 10       |
| EvolvE Cryo + Wellness         | med_spa_wellness           | 6        | 5           | 32   | 6                | 7        |
| Tucker, Albin and Associates   | collections_agency         | 6        | 5           | 22   | 6                | 7        |
| Armstrong Repair Center        | commercial_kitchen_service | 6        | 5           | 38   | 6                | 7        |

Consistent across all four:
- Exactly 6 personas in every A.R.C.
- Exactly 5 competitors (after dropping the partner's own row from `.comp-name`)
- AVS score in 0-100 range
- 6 decision drivers
- At least 7 channels in the channel map

---

## Edge cases the parser handles

**Partner appears first in the competitor list.** Every A.R.C. lists the partner themselves in the `.comp-name` row at the top of the Competitive panel as their own benchmark. The parser drops the first `.comp-name` entry and treats positions 2 through N as actual competitors.

**Inline parenthetical notes on competitor names.** Some competitors appear as `Mister Sparky Cypress / Houston` or `A1 Plus Electrical (LSA #1)`. The parser strips the parenthetical to a `notes` field and keeps the clean name in `name`.

**Persona naming convention varies.** Some A.R.C.s use real human names ("Heather & Mark Thompson"), others use archetype labels ("The Multi-Unit Restaurant Operator"). Both populate `name` cleanly via the same selector. The Generation layer needs to know which convention is in use and adapt copy treatment — first-name references work for Kirchner but not for Armstrong.

**Channel priority with persona-specific nuance.** Strings like `Low (high for Carla)` are split: `priority` gets the base enum value (`Low`), `priorityNotes` gets the modifier (`high for Carla`).

**AVS displayed two ways.** Three of four A.R.C.s use `.ai-hero-score` for the AVS display. Kirchner uses a circular gauge with the value in an unlabeled div. Parser tries the common pattern first and falls through.

**Customer journey stage count varies.** Persona modals show 5 stages (Problem → Search → Evaluate → Call → Hire on Tucker Albin), aggregate journeys show 3 (Search & discover → Evaluate & compare → Validate & decide on Kirchner). Schema allows any stage count via open array.

**Roadmap package labels vary.** Standard tiers are A/B/C/D. Tucker Albin uses Good/Better/Best/Great. The schema enforces `tier ∈ {A, B, C, D}` for stable downstream behavior — the LLM extractor will need to map alternative labels into the canonical tier letters when building the `roadmap.packages` array.

---

## Things to flag for the SOP v1.1 revision

Two items from this sweep that should reach the post-build SOP review:

1. **Package tier mapping.** The SOP and `intake-form.schema.json` reference packages A/B/C/D, but Tucker Albin's A.R.C. uses Good/Better/Best/Great. Either A.R.C. templates should standardize on A/B/C/D (preferred — keeps the schema strict) or the schema should support the alternate labeling. Recommend the former; alternate labels can map to canonical tiers in the LLM extractor.

2. **Persona naming convention.** Real-name personas convey warmth and specificity; archetype-label personas convey clean B2B segmentation. Both are valid and serve their verticals well. Document this as a *deliberate choice* per partner in the SOP rather than something to standardize away.

---

## What the parser does NOT yet do

Honest accounting of what's still ahead, beyond the LLM transport wiring:

1. **HTTP fetch error handling.** `parseArcUrl()` uses `fetch()` with no retry, no timeout, no rate limiting. Production version should wrap in retry-with-backoff.
2. **HTML caching.** Re-running the parser on the same URL re-fetches every time. Worth caching responses for development and CI.
3. **Schema-version detection.** `detectTemplateVersion()` returns coarse buckets (`current-2026-06` / `current-2026-06-partial` / `unknown`). When the A.R.C. template evolves, this should detect specific versions and route to appropriate extractors.
4. **Per-persona service mapping.** `personas[].primaryServiceIds` is currently an empty array — populating it requires cross-referencing personas with `targetServices` (which is LLM-extracted). Wire this up after LLM extraction lands.
5. **Internal consistency cross-checks.** The schema enforces some cross-references (intake `businessName` must match A.R.C. `businessName`), but cross-page consistency within multi-page generated output is a Layer 5 (Gauntlet) concern, not parser.
