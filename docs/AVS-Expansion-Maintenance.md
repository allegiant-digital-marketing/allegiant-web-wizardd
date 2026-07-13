# AVS Tool — Expansion & Maintenance Instructions

## Current State

The AVS (AI Visibility Score) tool is live at **https://allegiantdigital.co**. It is a single-page web application deployed on Netlify under the `allegiantdigitalmarketing` team. The Netlify site slug is `allegiantdigital-co`.

### What It Does

The AVS tool runs a free AI visibility audit for any business. The user provides their business details via a form, and the tool queries 4 AI platforms (ChatGPT, Claude, Gemini, Perplexity) with 20 prompts related to their service category and location. It then scores how often and how prominently the business appears in AI-generated responses.

### Architecture

- **Frontend:** Single HTML file with inline CSS and JavaScript. Dark theme matching Allegiant brand (violet #6d3bf7, mint #8fffce, surface #0c0a1a). Fonts: Poppins + system fallbacks.
- **Backend:** Netlify serverless function at `/api/run-audit` written in TypeScript (`run-audit.mts`). This function handles all API calls to the 4 AI platforms and returns the scored results.
- **API Keys:** Anthropic (Claude), OpenAI (ChatGPT), Google (Gemini), and Perplexity API keys are stored as Netlify environment variables.

### Form Inputs (Current)

1. First Name (required)
2. Last Name (required)
3. Work Email (required)
4. Phone (required)
5. Business Name (required)
6. Website (required)
7. City, State (required)
8. Primary Service Category (dropdown — required)
9. Describe Your Industry (text — required)
10. SMS Consent (checkbox — required)
11. Promotional Communications (checkbox — optional)

---

## Scoring Methodology

### AVS Composite Score

The overall AVS Score is a **weighted average of platform-level scores**, NOT the average of the four pillar scores:

| Platform | Weight |
|----------|--------|
| Claude | 30% |
| ChatGPT | 30% |
| Gemini | 30% |
| Perplexity | 10% |

**Formula:**
```
avsScore = Math.round((claude * 0.30 + chatgpt * 0.30 + gemini * 0.30 + perplexity * 0.10) / totalWeightOfSuccessfulPlatforms)
```

If a platform errors out, its weight is dropped from the denominator so surviving platforms aren't artificially deflated.

**Why 30/30/30/10:** This weighting was calibrated against Semrush's AI Visibility Score using 4 reference businesses. Training-data platforms (Claude, ChatGPT, Gemini) are weighted higher because "AI visibility" primarily measures training-data presence. Perplexity (real-time web search) is weighted lower at 10% because it reflects current web indexing more than true AI knowledge-base presence. Calibration achieved MAE of 3.75 points vs. Semrush across the reference set.

### Four Pillars (Separate View)

The pillar scores group the same query data by **theme**, not by platform:

| Pillar | Query Indices Used |
|--------|-------------------|
| Brand Visibility | Queries 0, 1, 3 (general category queries) |
| Local Authority | Queries 1, 2 (geo + service specific) |
| Content Authority | Queries 3, 4 (comparison + direct lookup) |
| Personal Authoritativeness | Query 4 + owner name mention bonus (+15 if owner name appears in any response) |

**Important:** The AVS composite and the pillar average will almost never match because they are two different calculations from the same underlying data. This is by design but can confuse users. A disclaimer should be displayed beneath the AVS Score explaining this.

### Tiers

| Score Range | Tier |
|-------------|------|
| 0–19 | Critical |
| 20–39 | Low |
| 40–59 | Moderate |
| 60–79 | Strong |
| 80–100 | Dominant |

### Per-Query Scoring

Each query scores 0–20 per platform based on:
- Whether the business was mentioned
- Position in the recommendation list (higher = more points)
- Strength of the mention (named directly vs. listed among many)

Platform total = sum of all 5 query scores (max 100 per platform).

---

## Pending Fix: Scoring Disclaimer

**Issue identified:** When pillar scores show 20/20/20/15 but the AVS composite shows 20, users expect the score to be the average of the pillars (18.75). The disconnect is confusing because the AVS score is actually the weighted platform composite, not the pillar average.

**Fix:** Add a disclaimer line beneath the AVS Score circle in the results section. Insert this HTML after the `score-verdict` div:

```html
<div style="text-align:center;font-size:11px;color:rgba(255,255,255,0.35);max-width:500px;margin:8px auto 0;line-height:1.5;font-family:'Poppins',sans-serif;">
  Your AVS Score is a weighted composite of platform-level performance (Claude 30%, ChatGPT 30%, Gemini 30%, Perplexity 10%) and may differ from the simple average of the four pillar scores, which group the same query data by theme rather than by platform.
</div>
```

**Status:** Not yet deployed. Needs to be applied to the source HTML and redeployed to Netlify.

---

## Report Sections (Current Output)

After the audit runs, the results page displays:

1. **AVS Score Circle** — animated SVG ring with composite score and tier badge
2. **Score Verdict** — contextual narrative based on tier (critical/low/moderate/strong/dominant)
3. **Section 01: Four Pillars** — Brand Visibility, Local Authority, Content Authority, Personal Authoritativeness (each 0–100 with progress bar)
4. **Section 02: Platform Breakdown** — individual scores for ChatGPT, Claude, Gemini, Perplexity with SVG rings and mention status
5. **Section 03: Two Self-Serve Actions** — tactical recommendations based on tier and weakest pillar
6. **CTA: A.R.C. Report** — upsell to the full $1,495 A.R.C. Report (complimentary for qualified partners doing $2M+ revenue)

---

## Integration Points

### A.R.C. Report Connection

The AVS tool is the top-of-funnel lead gen tool. The A.R.C. Report is the deeper diagnostic that follows. The CTA at the bottom of every AVS result links to:
- Calendly booking link for a strategy call
- Direct email to Chad (cmarkham@allegiantdigital.com) with pre-populated subject line and score

### SMS / Lead Capture

The form collects SMS consent (required) and promo email consent (optional). Currently the form data is submitted to the serverless function but lead routing (CRM, email notifications, SMS automation) needs to be confirmed. CallRail integration is planned.

### Compliance

The form includes disclosures for:
- CAN-SPAM Act (2003)
- TCPA (1991)
- California CCPA (2018)
- New York SHIELD Act (2019)
- Privacy policy reference at allegiantdigital.com/privacy

---

## Expansion Opportunities

### Near-Term

1. **Lead notification** — Send real-time email/SMS to Chad or the sales team when an audit is submitted, including the score and contact info
2. **Results persistence** — Save audit results to Netlify Blobs or a database so they can be retrieved via a unique URL (e.g., allegiantdigital.co/report/abc123)
3. **PDF export** — Generate a downloadable PDF version of the AVS report
4. **Comparison mode** — Allow prospects to re-run their audit over time and see score changes
5. **Query expansion** — Increase from 5 to 10+ queries per platform for more granular scoring

### Medium-Term

6. **Competitor comparison** — Add a field for "top competitor" and run the same audit on both, showing a side-by-side comparison
7. **Industry benchmarks** — Aggregate anonymous scores by service category to show "your score vs. industry average"
8. **Automated follow-up sequence** — Trigger a 3-email nurture sequence based on score tier
9. **CRM integration** — Push lead data and scores directly to Zoho CRM
10. **Salesperson assignment** — Route leads to the appropriate salesperson based on geography or service category

### Long-Term

11. **White-label version** — Allow Allegiant partners to embed the AVS tool on their own websites
12. **Ongoing monitoring** — Monthly automated re-runs with score change alerts
13. **Integration with A.R.C. Report** — Pre-populate A.R.C. Report data from AVS results to reduce duplicate research

---

## Technical Reference

### Netlify Configuration

- **Team:** allegiantdigitalmarketing
- **Site:** allegiantdigital-co
- **URL:** https://allegiantdigital.co
- **Function endpoint:** /api/run-audit
- **Runtime:** Node.js (Netlify Functions v2)
- **Source language:** TypeScript (.mts)

### Environment Variables (Netlify)

- `ANTHROPIC_API_KEY` — Claude API access
- `OPENAI_API_KEY` — ChatGPT API access
- `GOOGLE_AI_API_KEY` — Gemini API access
- `PERPLEXITY_API_KEY` — Perplexity API access

### Key Functions in run-audit.mts

- `handler()` — main entry point, orchestrates parallel platform queries
- `queryPlatform()` — sends queries to a specific AI platform and scores responses
- `calculatePillars()` — maps query results to 4 pillar scores
- `getTier()` — maps composite score to tier label
- `getRecommendations()` — generates 2 tactical recommendations based on tier and weakest pillar

### Platform Query Structure

5 queries per platform, each targeting a different signal:
- Q0: "Best [service] in [city]" — general category visibility
- Q1: "Top rated [service] near [city]" — local + rating signal
- Q2: "Who should I hire for [service] in [city]" — intent-to-hire signal
- Q3: "Compare [service] companies in [city]" — competitive comparison
- Q4: "[Business Name] reviews [city]" — direct brand lookup

---

## Brand & Design Reference

- **Colors:** Violet #6d3bf7, Deep Purple #361e5e, Mint #8fffce, Navy #001423, Surface #0c0a1a
- **Score colors:** Green #66bb6a (good), Amber #ffa726 (moderate), Red #ff4d6a (poor)
- **Fonts:** Poppins (primary), system fallbacks
- **Voice:** Cinematic, authoritative, legacy-driven. Same Allegiant brand voice used across all properties.
- **Logo:** Official Allegiant registered mark only. Never recreate or approximate.

---

## Contact

**Chad Markham** — President & CEO
cmarkham@allegiantdigital.com
(512) 520-4001
