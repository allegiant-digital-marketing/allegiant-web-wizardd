# A.R.C. Report — Expansion Instructions v1.2

**Purpose:** Baseline update to the A.R.C. Report template so every partner report going forward surfaces the fields Web WIZARDD needs to ingest cleanly. Derived from the Webb Pest Service ingestion (2026-07-01) which surfaced six missing/incomplete field classes.

**Governing standard:** Allegiant Gauntlet Master Verification Standard v2.1. This instruction set is a partner-facing deliverable spec; §III-B (A.R.C. Report module) governs the P2/P5 verification when the report is built.

**Deliver this document to:** a **new** conversation in the A.R.C. Report generator project (attach as a file; do not paste as text). Also attach the Master Verification Standard v2.1 so §III-B is present in that project's knowledge.

**Changelog v1.0 → v1.1 (2026-07-05):** §5 platform set corrected against the live AVS tool documentation — the AVS tool queries ChatGPT, Claude, Gemini, and Perplexity (not Google AI Overviews); Microsoft Copilot is a pending decision, not a settled fifth platform. The `citationContext` enum is staged: `at_risk` is reserved until the AVS tool gains competitor detection. v1.0 was drafted against an assumed platform set and was never committed or applied.

---

## Why this exists

Web WIZARDD parses the A.R.C. Report into a structured JSON record that feeds the routing SOP and, eventually, the generation layer. During the Webb Pest Service ingestion, six field classes came through as null despite the underlying data being visible in the report. The parser cannot extract fields the A.R.C. doesn't surface in a parseable form. This spec fixes the upstream so the parser has something clean to catch.

---

## Fields to add or fix in the A.R.C. Report template

### 1. Social profiles — Facebook and Instagram URLs

**Current state:** report acknowledges Facebook and Instagram presence in prose, but the URLs are not surfaced in a standalone parseable element.

**Required change:** every partner social profile referenced in the report must appear as an explicit clickable link in a dedicated Social Profiles panel or list. Each entry must contain:

- Platform name (Facebook, Instagram, LinkedIn, YouTube, TikTok, X/Twitter, Threads — expand set as needed)
- Full URL to the partner's profile on that platform
- Whether the profile is active, dormant, or unclaimed (three-state, not boolean)
- Follower/subscriber count if available (integer or "not available")
- Last post date if available (ISO date or "not available")

**Placement:** dedicated Social panel in the report. Not inline in Executive Summary prose.

### 2. Review platforms — Yelp and Nextdoor (and full set)

**Current state:** report covers Google reviews. Yelp and Nextdoor are absent or inconsistently surfaced.

**Required change:** dedicated Review Platforms panel covering the full set. Each entry must contain:

- Platform (Google Business Profile, Yelp, Nextdoor, BBB, Facebook Reviews, Angi, HomeAdvisor, TrustPilot — expand per vertical)
- Rating (decimal to one place: `4.7`) or "no reviews"
- Review count (integer) or "no reviews"
- Response rate (percentage) if the platform surfaces it, or "not tracked"
- Last review date (ISO date) or "not available"
- Profile URL

**Placement:** dedicated Review Platforms panel. Google Business Profile still gets its own detailed treatment (see §4).

### 3. Competitors — structured extraction, not prose

**Current state:** competitors are described in prose narrative, forcing manual extraction in WIZARDD.

**Required change:** dedicated Competitors panel presenting each competitor as a structured entry (table row or repeating card). Each entry must contain:

- Competitor name (business name)
- Website URL
- Vertical / classification (one of: direct competitor · adjacent competitor · aspirational competitor · national chain competitor)
- Primary market overlap with the partner (which cities/regions they compete in)
- Estimated organic ranking strength (Domain Authority, referring domains, or Semrush organic keyword count — whatever the report captures elsewhere)
- Notes field for anything not captured above (free text)

**Volume expectation:** 3–7 competitors per report. Fewer is fine if the partner's market is narrow; more is fine if the analysis warrants it. Never omit the panel entirely.

### 4. Google Business Profile — full field surface

**Current state:** rating and review count are visible in the report but sometimes narrative, sometimes not surfaced.

**Required change:** dedicated GBP panel containing at minimum:

- Rating (decimal to one place)
- Review count (integer)
- Response rate (percentage or "not tracked")
- Categories (primary + secondary)
- Completeness percentage (per Google's own signal, if surfaced)
- Photos count
- Q&A count
- Posts count in last 90 days
- Verified status (yes / no / unclaimed)
- Profile URL

Every field is a discrete data point in a table or key-value layout — not a paragraph.

### 5. AI Visibility — per-platform structured fields (mirrors live AVS coverage)

**Current state:** AI Visibility Score (AVS) is reported. Per-platform data is inconsistent; discipline scores absent.

**Required change:** the AI Visibility panel must surface per-platform data that **mirrors what the AVS tool actually measures.** The live AVS tool queries **ChatGPT, Claude, Gemini, and Perplexity.** Microsoft Copilot is a pending expansion decision (see `AVS_TOOL_EXPANSION_INSTRUCTIONS.md` v2.0, Change 2): if approved, the panel lists five platforms; if declined, four. Do not list platforms the AVS tool does not measure — a listed platform with no data source behind it is exactly the gap that produced null fields in the Webb ingestion.

For each platform, structured fields:

- `cited` — true / false (was the partner mentioned in this platform's responses?)
- `citationContext` — enum: `cited` · `not_cited` · `not_evaluated`. The value `at_risk` (competitors appear, partner doesn't) is **reserved** until the AVS tool gains competitor detection; do not emit it before that capability exists.
- `score` — 0–100 integer per platform, from the AVS tool's per-platform scoring
- `queryDate` — ISO date the AVS audit was run

**citationContext definitions:**
- `cited` — the partner is mentioned in at least one of the platform's query responses
- `not_cited` — the partner appears in none of the platform's query responses
- `not_evaluated` — the platform errored or was not queried for this partner
- `at_risk` — RESERVED (requires competitor detection; not yet emittable)

The source of record for this panel is the AVS tool's machine-readable export block (`avsExport`, per AVS expansion v2.0 Change 1). The report embeds those values verbatim — no manual transcription.

Additionally, the AI Visibility panel must surface **four discipline scores** when the AVS deep-audit mode has run:

- **AEO** (Answer Engine Optimization) — score 0–100 + notes field
- **GEO** (Generative Engine Optimization) — score 0–100 + notes field
- **AI SEO** — score 0–100 + notes field
- **LLM SEO** — score 0–100 + notes field

Each discipline gets a score and a notes field. Notes are free text explaining the score's basis and specific improvement opportunities. If the deep-audit mode has not run for this partner, the panel states "Discipline audit not yet run" explicitly rather than showing blanks.

### 6. Website Audit — every technical field structured

**Current state:** Website Audit tab occasionally produces null values for URL, LCP desktop, and Google Ads status.

**Required change:** every field on the Website Audit tab must be either populated with a discrete value or explicitly marked "not measured." Blank fields are unacceptable — they force the parser to guess between "genuinely not measured" and "extraction failure." Fields at minimum:

- Website URL (canonical)
- HTTPS status
- Mobile-friendly (per Google's Mobile-Friendly Test)
- LCP mobile (seconds)
- LCP desktop (seconds)
- INP mobile (milliseconds)
- INP desktop (milliseconds)
- CLS mobile
- CLS desktop
- Indexation status (indexed / not indexed / partial)
- Sitemap present (yes / no)
- Robots.txt present (yes / no)
- Schema present (yes / no / partial)
- Known issues (structured list, not prose — each issue is a discrete item)

---

## Report structure discipline

Every field above should render in the A.R.C. Report using **structured HTML elements** — tables, definition lists, or key-value pairs — not embedded in prose paragraphs. The parser reads DOM structure. Prose descriptions of the same facts do not parse cleanly.

Panel-level structure:

```html
<div class="panel" data-panel-id="social-profiles">
  <h2>Social Profiles</h2>
  <table class="social-profiles-table">
    <thead>
      <tr>
        <th>Platform</th>
        <th>URL</th>
        <th>Status</th>
        <th>Followers</th>
        <th>Last Post</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Facebook</td>
        <td><a href="https://facebook.com/..." rel="noopener">https://facebook.com/...</a></td>
        <td>Active</td>
        <td>1,247</td>
        <td>2026-06-15</td>
      </tr>
      <!-- ... -->
    </tbody>
  </table>
</div>
```

The `data-panel-id` attribute is load-bearing — the parser uses it to identify which panel it's reading. New panels added to the report must carry a `data-panel-id` attribute with a stable, lowercase-hyphenated identifier.

---

## Verification (this document's own §III-B pass)

Per Master Standard §III-B, when this expanded template is applied to a live A.R.C. Report:

- **P2 — per-dimension verification:** every metric above traces to a live, dated capture. AVS scores trace to the AVS export block with timestamps. GBP data traces to the actual Google Business Profile. Rankings trace to Semrush/live SERP with dates. No metric asserted from memory, inference, or stale run.
- **P5 — external validation:** 13 tabs render · every link 200 · deployed to Netlify team `allegiantdigitalmarketing` · every computed figure recomputed and traceable · figures consistent tab-to-tab.

Per §II.B (sales-artifact integrity, when the report is prospect-facing): findings are true or cut. A sharper, scarier, or more flattering finding that isn't verified does not ship. Overstatement to close a deal is both an integrity violation and a deal-killer the moment the prospect catches it.

Per §I.A.6 (third-party-claims rule): every claim about the recipient's own business is verified against their actual data or flagged as unverified in the report itself.

---

## Rollout

- Apply this expansion to the A.R.C. Report template.
- Every A.R.C. Report generated **on or after** the template update conforms to this spec.
- Existing A.R.C. Reports (Kirchner, Evolve Cryo, Tucker Albin, Armstrong, Webb) are not retrofit — they served their calibration purpose.
- Web WIZARDD's calibration window (5 first-pass clean ingestions) begins counting from the first report built under this expanded template.

## Change control

- Version 1.2 — 2026-07-11. Citation fix: §I-B corrected to §III-B (the A.R.C. Report module) throughout — Part I §B is the 5-Pass Protocol, not the A.R.C. module. Flagged by the A.R.C. generator during template-update restatement.
- Version 1.1 — 2026-07-05. Platform set in §5 corrected against live AVS tool documentation; `citationContext` enum staged; AVS export block named as source of record for the AI Visibility panel.
- Version 1.0 — 2026-07-01. Initial expansion instruction set derived from Webb Pest Service ingestion escapes. Never committed or applied; retired.
- Future revisions triggered by additional escapes surfaced during the WIZARDD calibration window per Standing Instructions §7 calibration loop.
