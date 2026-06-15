# Architecture

The Web WIZARDD codebase is structured around the **seven-layer architecture** specified in the SOP. Each layer has a clear responsibility, a clear input contract, and a clear output contract. Layers communicate via normalized data structures, not direct function calls — this keeps each layer testable in isolation and replaceable without cascading rewrites.

This document describes the layers, their data flow, and the phased build plan.

---

## The seven layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         INPUTS                                   │
│   A.R.C. Report URL     +     Web WIZARDD intake form           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 · INGESTION                                             │
│  Parse + validate both inputs into normalized partner record.    │
│  Block if either input fails validation (or invoke Override).    │
└─────────────────────────────────────────────────────────────────┘
                              │  partnerRecord
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2 · RESEARCH                                              │
│  Crawl SERPs for every service × location.                       │
│  Analyze top-ranking competitor sites for structure,             │
│  content depth, UX patterns, CTAs, schema, conversion.           │
└─────────────────────────────────────────────────────────────────┘
                              │  researchPack
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3 · KNOWLEDGE BASE                                        │
│  Reference Allegiant-curated KB synthesized from named           │
│  industry experts. Vertical-specific tactical knowledge.         │
│  Plus the Allegiant SOW deliverable floor.                       │
└─────────────────────────────────────────────────────────────────┘
                              │  kbContext
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4 · GENERATION                                            │
│  Write per-persona page copy weighted by audience weighting.     │
│  Compose 3 design archetype mockups across 2 pages = 6 mockups.  │
│  Produce per-page artifacts (HTML, CSS, schema, image specs,     │
│  Avada notes, SEO meta, build manifest).                         │
└─────────────────────────────────────────────────────────────────┘
                              │  generatedPackage
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 5 · GAUNTLET                                              │
│  FLOOR gates (automated, hard-block):                            │
│    Pass 6 v2.1 · W3C · header bands · voice metrics ·            │
│    schema integrity · pixel parity · link liveness ·             │
│    robots / indexability · AI-search readiness                   │
│  CEILING checks (team-mediated, advisory):                       │
│    Four hostile reads · ICP-fit audit · brand-fit audit ·        │
│    brand-sensitive term audit                                    │
│  Failure cascade dependency engine encoded per Gauntlet SOP.     │
└─────────────────────────────────────────────────────────────────┘
                              │  gauntletedPackage
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 6 · REVIEW / SIGNOFF                                      │
│  Generate partner-facing preview with condensed export panel     │
│  across all 6 mockups. Capture partner's design selection.       │
│  One-time signed preview URLs with configurable expiry.          │
└─────────────────────────────────────────────────────────────────┘
                              │  selectedDirection
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 7 · EXPORT / TRANSFER                                     │
│  Activate full 7-tab export package on selected direction.       │
│  Hand off to Avada team for WordPress implementation.            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       AVADA / WORDPRESS
```

---

## Layer 1 — Ingestion

**Responsibility.** Take the two raw inputs (A.R.C. URL + intake form), validate them against their respective schemas, and produce a normalized `partnerRecord` that every downstream layer reads from.

**Inputs.**
- `arcUrl` (string, URL)
- `intakeForm` (object conforming to `schemas/intake-form.schema.json`)

**Outputs.**
- `partnerRecord` (object containing the parsed A.R.C. + intake, plus metadata)

**Behavior.**
1. Validate intake form against schema. Block if invalid.
2. Fetch A.R.C. HTML from the URL.
3. Parse A.R.C. into the structure defined by `schemas/arc-extraction.schema.json`.
4. Validate parsed A.R.C. against schema. Block if `completenessScore < 80` without builder override.
5. Cross-validate `intakeForm.partner.businessName === arc.businessIdentity.businessName`. Block on mismatch.
6. Cross-validate `intakeForm.pageSelection.interiorServicePage.serviceName ∈ arc.targetServices[].name`. Block on mismatch.
7. If any check fails, surface to Manual Override Mode workflow (per SOP Section 8).

**Implementation notes.**
- The A.R.C. parser is template-aware. As A.R.C. templates evolve, the parser should be versioned to handle both current and recent past templates.
- Parser warnings (non-blocking issues like "field present but empty") go into `metadata.extractionWarnings` for builder visibility.

---

## Layer 2 — Research

**Responsibility.** Crawl live search results for every target service × target location combination from the partner record. Analyze the top-ranking competitor sites for structure, content depth, UX patterns, CTAs, schema markup, and conversion elements.

**Inputs.**
- `partnerRecord` from Layer 1

**Outputs.**
- `researchPack` (object containing SERP analysis per service × location pair, competitor site structural analysis, identified content gaps and opportunities)

**External dependencies.**
- SERP API (Serper.dev for v1, evaluated upgrade to DataForSEO if needed)
- Optional: web scraping for competitor site analysis (headless browser pattern)

**Behavior.**
1. Enumerate the service × location matrix from the partner record.
2. For each pair, query SERPs (Google primarily; Bing as secondary signal).
3. Identify the top 3-5 organic results per query.
4. Crawl each competitor result for structural data (section types, word counts, CTA placement, schema blocks, page speed, trust signals).
5. Aggregate findings into `researchPack` keyed by service × location.
6. Surface a summary to the builder for sanity-check before Generation runs.

**Caching.** Same service × location pair across multiple partners in the same market should hit cache, not re-crawl. Cache TTL: 7 days for SERPs, 30 days for competitor structural data.

---

## Layer 3 — Knowledge Base

**Responsibility.** Provide Generation with current best-practice tactical knowledge across content writing, traditional SEO, technical SEO, AEO, and GEO, synthesized from named industry experts and refreshed quarterly. Plus the Allegiant SOW deliverable floor (the minimum quality bar from the Partner-facing SEO SOW).

**Inputs.**
- `partnerRecord.vertical` (for vertical-specific KB selection)
- `partnerRecord.audience.personas[].decisionDrivers` (for persona-tactical relevance)

**Outputs.**
- `kbContext` (object containing the relevant KB sections for this build, with citations)

**Named expert source list** (v1, quarterly refresh):
- Aleyda Solis (international SEO, technical SEO)
- Lily Ray (E-E-A-T, content quality)
- Marie Haynes (E-E-A-T, medical/YMYL)
- Mike King (content strategy, technical SEO)
- Brian Dean / Backlinko (link building, content frameworks)
- Search Engine Journal, Search Engine Land (current updates)
- Ahrefs blog, Semrush blog (tactical research)
- Google Search Central docs (canonical guidance)
- OpenAI/Anthropic developer docs and AEO/GEO guidance (AI search behavior)

**Refresh cadence.** Quarterly review. Any major algorithmic shift triggers an off-cadence update.

---

## Layer 4 — Generation

**Responsibility.** Produce the six mockups (3 design archetypes × 2 pages each — home + selected interior service page), populated with per-persona page copy weighted by audience weighting, plus all per-page artifacts for the export panel.

**Inputs.**
- `partnerRecord` from Layer 1
- `researchPack` from Layer 2
- `kbContext` from Layer 3

**Outputs.**
- `generatedPackage` (object containing 6 mockups + per-mockup artifact sets: HTML, CSS, JSON-LD schema, SEO meta, image specs with prompts, partner-specific Avada notes, build manifest)

**Behavior.**
1. For each design archetype (e.g., for home services: trust-first, authority, velocity):
   - Compose home page from archetype components, populated with partner data, weighted by persona composition guidance.
   - Compose interior service page from archetype components, for the service specified in `intakeForm.pageSelection.interiorServicePage.serviceName`.
2. For each generated page, produce:
   - Full HTML (Fusion Code Block ready)
   - Page CSS with placement notes
   - JSON-LD schema with valid @id chains
   - SEO meta (title 50-60 chars, description 150-160 chars), live-editable downstream
   - Image specs (filename, dimensions, ALT text, image prompt for ChatGPT/DALL-E/Midjourney)
   - Partner-specific Avada implementation notes
   - Build manifest

---

## Layer 5 — Gauntlet

**Responsibility.** Validate every generated page against The Allegiant Gauntlet™. No page advances to Export until FLOOR gates are clean. CEILING findings surface to the team but do not block.

**Inputs.**
- `generatedPackage` from Layer 4

**Outputs.**
- `gauntletedPackage` (the generated package plus per-page Gauntlet Evidence: pass results, hostile-read findings, cascade dependencies)

**FLOOR gates** (automated, hard-block on failure):
- Pass 6 v2.1 (9-gate semantic validator, including G5 schema field length under 250 chars)
- W3C HTML validation (0 errors required, info notes permitted)
- Header band check (H1: 30-70 chars, H2-H6: 20-70 chars)
- Voice metrics (your/Allegiant/client/AI-tell counts within target bands)
- Schema integrity (@id chains valid, JSON-LD parses, Rich Results compatible)
- Pixel-parity (desktop + mobile render match source MD5)
- Cite-link liveness (every external link HTTP 200)
- Robots / indexability
- AI-search readiness (FAQ schema where applicable, answer.text under threshold)

**CEILING checks** (team-mediated, advisory):
- Four hostile reads: Hostile CFO, Competitor, Fact-Checker, Lawyer (using diverse LLM prompts per the Gauntlet SOP v1.0 character descriptions)
- ICP-fit audit (does the copy speak to the personas in their actual language?)
- Brand-fit audit (does the design reflect the partner's intake?)
- Brand-sensitive term audit (Partners not clients, Web WIZARDD double-D, ASCENT not Business SMARTS, OMNIVIZ™, A.R.C. Report, AEO/GEO/AI SEO/LLM SEO, EAB/ACA/MCN/TAR/AVM)

**Failure cascade** (encoded per Gauntlet SOP v1.0 Section 6):
- P2 fail → re-run P2, then P3
- P3 fail → re-run P3 (and re-run P2 on newly-identified claims)
- P4 fail → re-run P2 and P3 on affected claim, then re-run P4 from relevant hostile reader
- P5 fail → re-deploy + re-run P5; if claim-level, also re-run P2/P3/P4

**Tier 1 peer review.** Every Web WIZARDD output is Tier 1 by definition. P4 hostile reads must be either (a) reviewed by a second human team member, or (b) executed via two diverse model/prompt combinations (the v1 LLM-cross-check substitute, which may be tightened in v1.1 based on quality observations).

---

## Layer 6 — Review / Signoff

**Responsibility.** Generate partner-facing preview with condensed export panel. Capture partner's design archetype selection and any section-level annotations.

**Inputs.**
- `gauntletedPackage` from Layer 5

**Outputs.**
- `selectedDirection` (the partner-approved design direction + annotations, plus signoff record)

**Behavior.**
1. Generate one-time signed preview URL (default 7-day expiry, extendable to 21 days).
2. Surface 6 mockups in archetype-comparison view with condensed export panel (Build Manifest + SEO Meta visible; full HTML/CSS/Schema/Images/Avada Notes hidden until selection).
3. Capture partner selection of one design direction.
4. Capture any section-level annotations the partner provides.
5. Hand off to Layer 7 with the selection and annotations.

**Security.** Preview URLs are signed with `PREVIEW_TOKEN_SECRET` (Netlify env var). Each URL is single-build-scoped — a partner viewing their preview cannot pivot to any other build's preview or to the tool itself.

---

## Layer 7 — Export / Transfer

**Responsibility.** Activate the full seven-tab export package on the selected design direction. Refine the selection based on partner annotations. Hand off to the Avada team for WordPress implementation.

**Inputs.**
- `gauntletedPackage` from Layer 5
- `selectedDirection` from Layer 6

**Outputs.**
- `avadaHandoffPackage` (the full implementation-ready bundle: 7-tab export panel per page, Gauntlet Evidence, build manifest, link to live preview)

**The seven tabs** (per page):
1. Build Manifest
2. SEO Meta (editable, server-persisted)
3. Page HTML
4. CSS
5. JSON-LD Schema
6. Image Assets (filename + dimensions + ALT text + AI image prompt)
7. Avada Notes (partner-specific)

Plus a Gauntlet Evidence tab showing the full P1-P5 chain.

---

## Build phases — dependency map

| Phase | Builds | Depends on |
| --- | --- | --- |
| Phase 1 — Thinnest end-to-end | Repo skeleton, auth, basic Ingestion (parse 1 A.R.C. → 1 home page mockup) + export panel | Nothing |
| Phase 2 — Three design directions | Layer 4 expansion to 6 mockups + Layer 6 preview/selection | Phase 1 |
| Phase 3 — Gauntlet | Layer 5 full implementation (FLOOR + CEILING + cascade) | Phase 2 (needs mockups to validate) |
| Phase 4 — Research | Layer 2 implementation | Phase 1 (Ingestion provides the service × location matrix); independent of Phases 2 + 3 |
| Phase 5 — Override + KB | Manual Override Mode in Layer 1 + Layer 3 KB population | Phase 1 for Override; Layer 3 can be populated in parallel with anything |
| Phase 6 — Fusion Builder JSON | Layer 7 upgrade from HTML-paste to full Avada JSON | Phases 1-5 stable + real Avada team feedback on bottlenecks |

Phases 1-5 are required for v1. Phase 6 is the v2 upgrade.
