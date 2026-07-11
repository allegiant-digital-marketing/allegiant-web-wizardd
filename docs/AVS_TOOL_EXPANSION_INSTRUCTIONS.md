# AVS Tool — Expansion Instructions v2.0

**Supersedes:** v1.0 (2026-07-01) — **v1.0 was drafted against an assumed architecture and is retired.** It listed Google AI Overviews as a queried platform (the live tool queries Claude, not AI Overviews), treated Copilot as mandated (it is an open decision), and specified changes without reference to the live tool's actual scoring methodology. v2.0 is grounded in the live tool documentation ("AVS Tool — Expansion & Maintenance Instructions," provided by Chad Markham 2026-07-05).

**Governing standard:** Allegiant Gauntlet Master Verification Standard v2.1 + Standing Instructions v1.1.

**Deliver this document to:** a **new** Claude conversation for the AVS tool (attach as a file; do not paste as text).

---

## Ground truth (from the live tool documentation)

The AVS tool is live at **allegiantdigital.co** (Netlify team `allegiantdigitalmarketing`, site `allegiantdigital-co`). Frontend is a single HTML file; backend is the Netlify serverless function `run-audit.mts` at `/api/run-audit`. It queries **four platforms — ChatGPT, Claude, Gemini, Perplexity** — with 5 queries each (20 total) and computes:

- **AVS composite:** weighted platform average — Claude 30% · ChatGPT 30% · Gemini 30% · Perplexity 10%, calibrated against Semrush's AI Visibility Score (MAE 3.75 across 4 reference businesses). Failed platforms drop out of the denominator.
- **Four pillars** (Brand Visibility, Local Authority, Content Authority, Personal Authoritativeness) — the same query data grouped by theme, deliberately distinct from the composite.
- **Tiers:** Critical / Low / Moderate / Strong / Dominant.
- **Per-query scoring:** 0–20 per platform per query, based on mention presence, list position, and mention strength.

Nothing in this expansion changes that methodology. The calibrated 30/30/30/10 weighting is preserved untouched unless a recalibration event (Change 2) is explicitly executed.

---

## Rollout order (deliberate — do not reorder)

**Change 4 runs first.** Chad has observed output that "seems like it's giving a default answer to every person I run through it." Expanding a tool whose baseline accuracy is in doubt compounds the problem. Diagnose first, expand second.

Then: Change 1 (export block) → Change 2 (Copilot decision) → Change 3 (discipline scores, deep-audit mode).

---

## Change 4 — Default-answer diagnostic protocol (RUN FIRST)

Verify, in order, storing evidence at each step:

1. **Raw-response storage (prerequisite).** If the tool does not currently persist the raw AI responses per audit, add that first — write each platform's raw response per query to Netlify Blobs keyed by audit ID. Every subsequent step depends on being able to inspect what the platforms actually returned. This also satisfies the Gauntlet §3.6 third-party-claims rule: any claim the tool makes about a business's citation status must be auditable against the actual query result.
2. **Query interpolation check.** Log the exact 20 prompts sent for one real submission. Confirm each contains the submitted business name, city/state, and service category — not template placeholders, not a prior submission's values.
3. **Live-call check.** Confirm each audit run produces fresh API calls (timestamps in function logs) — no caching layer or fallback template returning canned responses on error paths. Pay specific attention to error handling: if a platform call fails and the code substitutes a default score instead of dropping the platform from the denominator, every failed-platform audit looks identical.
4. **Discrimination check.** Run two contrived audits: one for a well-known, heavily-reviewed local business (should register mentions on at least some queries) and one for a fabricated business name in the same city/category (should register ~zero mentions). If both produce similar scores, mention detection is broken.
5. **End-to-end math check.** For one audit, recompute the composite and pillar scores by hand from the stored raw responses and confirm they match the displayed output.

Report findings per step with evidence (per Gauntlet P2 discipline: claim → verification method → result). Fix what fails before proceeding to Changes 1–3.

---

## Change 1 — Machine-readable export block for A.R.C. ingestion

**The problem this solves:** today, AVS results move into the A.R.C. Report by manual transcription (Chad reads the results page and re-keys values). That is the step where Web WIZARDD's ingestion found gaps. The fix is a structured JSON handoff.

Add to the results output (and persist alongside the raw responses) a machine-readable block:

```json
{
  "avsExport": {
    "version": "1.0",
    "auditId": "abc123",
    "queryDate": "2026-07-05",
    "business": { "name": "...", "city": "...", "state": "...", "category": "..." },
    "composite": { "score": 44, "tier": "moderate" },
    "perPlatform": [
      {
        "platform": "chatgpt",
        "cited": true,
        "citationContext": "cited",
        "score": 52,
        "queriesRun": 5,
        "queriesWithMention": 3
      }
      // ... claude, gemini, perplexity (+ copilot if Change 2 approved)
    ],
    "pillars": {
      "brandVisibility": 20,
      "localAuthority": 20,
      "contentAuthority": 20,
      "personalAuthoritativeness": 15
    },
    "disciplineScores": null
  }
}
```

**`citationContext` enum (staged):** `cited` (business mentioned in at least one response on this platform) · `not_cited` (no mentions) · `not_evaluated` (platform errored or skipped). The value `at_risk` (competitors appear, business doesn't) is **reserved** — it requires competitor detection, which is the tool's own roadmap item #6 (competitor comparison) and is not built yet. Do not emit `at_risk` until that capability exists.

`disciplineScores` is `null` unless the deep-audit mode (Change 3) ran.

This export block is what the A.R.C. Report will embed (per `ARC_REPORT_EXPANSION_INSTRUCTIONS.md` v1.1 §5) and what Web WIZARDD will ultimately parse. It is the keystone of the AVS → A.R.C. → WIZARDD data flow.

---

## Change 2 — Microsoft Copilot as fifth platform [DECISION GATE — Chad]

**Status: open decision.** Chad is considering adding Copilot and has not committed. This section specifies what "yes" entails so the decision is informed; do not implement until Chad confirms.

**Recommendation: add it.** Reasoning: (a) the A.R.C. Report's AI Visibility panel already contemplates a five-platform view that includes Copilot; (b) Semrush's AI Visibility Toolkit — the calibration reference — tracks Copilot, so parity supports future recalibration; (c) Copilot's enterprise footprint makes it a real surface for B2B partners specifically.

**What "yes" entails:**

- +5 queries per audit (25 total, +25% API call volume per submission — cost per free lead-gen audit rises accordingly)
- An implementation path for querying Copilot (the AVS thread determines the viable API route; this is a real technical question, not assumed trivial)
- **Weighting recalibration.** Adding a fifth platform changes the composite formula. Do not invent weights. Re-run the existing calibration method: score the same reference businesses against Semrush's AVS and adjust weights to minimize MAE, as was done for the original 30/30/30/10. Until recalibration completes, Copilot data can be collected and exported (Change 1 block) **without** entering the composite — collect-but-don't-weight is the safe intermediate state.

**What "no" entails:** the A.R.C. Report's AI Visibility panel lists four platforms, and the WIZARDD schema extension mirrors four. Both downstream documents are written to accommodate either outcome.

---

## Change 3 — Discipline scores (deep-audit mode, not the public path)

**Design decision baked in:** the four OMNIVIZ discipline scores serve the A.R.C. Report and Web WIZARDD pipeline — internal diagnostic depth. They do **not** belong on the free public lead-gen audit, which should stay fast and cheap. Implement them as a **gated deep-audit mode** (triggered internally when building an A.R.C. for a prospect or partner), not as an addition to every public submission.

The discipline scores require **new signal collection** — they are not derivable from the existing 20 visibility queries. They analyze the business's own web presence:

- **Answer Engine Optimization (AEO)** — readiness to be surfaced as a direct answer. Signals: FAQ schema presence, direct-answer formatting on money pages, question-format headings, self-contained answer passages.
- **Generative Engine Optimization (GEO)** — readiness to be cited inside synthesized responses. Signals: fact density, source-attribution structure, chunk-optimized passages, entity clarity.
- **AI SEO** — traditional SEO foundation as it applies to AI crawler access. Signals: crawler access for GPTBot / ClaudeBot / PerplexityBot (robots.txt rules), server-side rendering vs. JS-only content, sitemap configuration, structured-data coverage.
- **LLM SEO** — citation-worthiness across LLM-specific mechanisms. Signals: knowledge-graph/Wikidata presence, branded search volume, cross-source citation network, freshness of authoritative mentions.

**Output schema per discipline** (fills the `disciplineScores` field of the Change 1 export):

```json
{
  "aeo": { "score": 51, "notes": "At least two sentences citing the specific observed signals that set the score, plus 2-3 concrete improvement opportunities." },
  "geo": { "score": 38, "notes": "..." },
  "aiSeo": { "score": 62, "notes": "..." },
  "llmSeo": { "score": 29, "notes": "..." }
}
```

Notes are load-bearing — a bare number without observable-signal justification fails the Gauntlet's verify-or-omit rule. Every note must reference signals actually observed on the business's site or presence, with URLs stored for audit.

---

## Preserve (do not touch)

- The 30/30/30/10 composite weighting and its Semrush calibration — unchanged unless Change 2's recalibration event runs.
- The four-pillar mapping and per-query 0–20 scoring.
- The pending **scoring disclaimer fix** already specified in the live tool documentation (the composite-vs-pillar-average confusion) — ship it as part of this work; it is small and already written.
- Lead-capture, compliance disclosures, and the A.R.C. Report CTA flow.

## Verification (per Standing Instructions §5, tool-build row)

- **P2 — data round-trip integrity:** every score traces to a stored, timestamped raw response. Discipline scores trace to observable signals with named URLs. Export block validates against its schema. No silently-defaulted values — a failed platform emits `not_evaluated`, never a substituted score.
- **P5 — functional test on the deployed build:** one full audit end-to-end on the live site returns the complete export block; the diagnostic protocol (Change 4) results are documented with evidence; the disclaimer renders.

## Change control

- v2.0 — 2026-07-05. Full rewrite against live tool documentation. Platform set corrected (Claude in, Google AI Overviews out); Copilot moved to decision gate; discipline scores scoped to deep-audit mode; default-answer diagnostic protocol added and sequenced first.
- v1.0 — 2026-07-01. Retired. Drafted against assumed architecture; never applied.
