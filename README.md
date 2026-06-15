# Allegiant Web WIZARDD

**Website Intelligence · Zero-to-launch · AI-Powered · Ranking-Ready · Design & Development**

Allegiant's turnkey website production engine. Takes a Partner's A.R.C. Report URL and a Web WIZARDD intake form, produces three design directions with launch-ready content, AI/traditional/technical SEO artifacts, schema markup, image prompts, and Avada implementation notes ready for the WordPress development team.

**Live URL** (gated, Allegiant employees only): `https://wizardd.allegiantdigital.co`
**Authoritative SOP**: `Web_WIZARDD_SOP_v1_0.docx` (delivered separately; canonical operating procedure)
**Companion SOP**: The Allegiant Gauntlet™ v1.0 / v1.1 (governs the validation layer)

---

## Why this repo exists

Allegiant's traditional website delivery timeline is 10-12 weeks. Web WIZARDD compresses that to 3-4 weeks while raising the floor on quality by automating Gauntlet validation on every page that leaves the tool. The tool is internal — it is not partner-facing and not shared externally. Partners interact with the tool only through one-time signed preview URLs.

This repo is the codebase. The SOP is the operating procedure. Both are required reading before contributing.

---

## Architecture — 7 layers

| Layer | Name | Responsibility | Code lives in |
| --- | --- | --- | --- |
| 1 | Ingestion | Validates A.R.C. URL + intake form, parses both into normalized partner record | `src/layers/1-ingestion/` |
| 2 | Research | Crawls SERPs for every target service × target location combination | `src/layers/2-research/` |
| 3 | Knowledge Base | References Allegiant-curated best-practice library from named industry experts | `src/layers/3-knowledge-base/` |
| 4 | Generation | Writes per-ICP page content + composes three design archetype mockups | `src/layers/4-generation/` |
| 5 | Gauntlet | Runs FLOOR gates (auto-block) + CEILING checks (team-mediated) | `src/layers/5-gauntlet/` |
| 6 | Review / Signoff | Partner-facing preview, signed URLs, design selection capture | `src/layers/6-review-signoff/` |
| 7 | Export / Transfer | Seven-tab Avada handoff package generation | `src/layers/7-export-transfer/` |

See `docs/ARCHITECTURE.md` for the full layer-by-layer breakdown.

---

## Two-input model

As of June 2026, the tool requires exactly **two inputs** to start a build:

1. **A.R.C. Report URL** — partner's A.R.C., deployed and accessible. A.R.C. Reports now contain the partner's personas inline (formerly delivered as a standalone ICP Strategy doc), so the previous three-input model collapsed to two.
2. **Web WIZARDD intake form** — completed by the Allegiant team member during partner onboarding. Captures brand assets, design archetype direction, page selection, CTAs, differentiators, and out-of-scope flags.

If either input is genuinely unavailable, see **Manual Override Mode** in the SOP. Override requires Chad Markham's explicit approval and is intentionally not the path of least resistance.

---

## Repo layout

```
allegiant-web-wizardd/
├── README.md                 ← you are here
├── package.json
├── netlify.toml              ← deploy config + noindex + auth headers
├── _headers                  ← X-Robots-Tag enforcement
├── docs/
│   ├── ARCHITECTURE.md       ← 7-layer detail
│   └── SCHEMAS.md            ← schema decisions log
├── schemas/
│   ├── arc-extraction.schema.json
│   ├── intake-form.schema.json
│   └── examples/
│       ├── kirchner-arc.example.json
│       └── kirchner-intake.example.json
├── src/
│   ├── layers/               ← one folder per architectural layer
│   ├── shared/               ← cross-layer utilities (brand tokens, constants)
│   └── functions/            ← Netlify serverless functions
├── public/                   ← static frontend assets (gated UI)
└── tests/
    └── schemas/
        └── validate.js       ← Ajv-driven schema/example validator
```

---

## Getting started

### Prerequisites

- Node.js 18+
- A Netlify account with access to the `allegiantdigitalmarketing` team
- An Anthropic API key (committed to Netlify env vars, never to the repo)
- A SERP API key (Serper.dev recommended for v1; committed to Netlify env vars)

### Install dependencies

```bash
npm install
```

### Validate schemas

The validator must pass before any schema or example change is committed:

```bash
npm run validate:schemas
```

Expected output:

```
✓ PASS  A.R.C. extraction · Kirchner Electric
✓ PASS  Intake form · Kirchner Electric
All schemas + examples passed validation.
```

### Environment variables (set in Netlify, never committed)

```
ANTHROPIC_API_KEY=...
SERPER_API_KEY=...
NETLIFY_IDENTITY_ALLOWED_DOMAIN=allegiantdigital.com
PREVIEW_TOKEN_SECRET=...      # for signing one-time partner preview URLs
```

---

## Build phases

| Phase | Scope | Status |
| --- | --- | --- |
| Phase 1 — Thinnest end-to-end | Repo + auth + ingestion + parser + 1 mockup + export panel | In progress |
| Phase 2 — Three design directions | 3 archetypes × 2 pages, preview links, selection capture | Not started |
| Phase 3 — Gauntlet layer | FLOOR gates + CEILING checks + failure cascade | Not started |
| Phase 4 — Research layer | SERP crawling + competitor analysis | Not started |
| Phase 5 — Override + KB | Manual Override Mode + named-expert KB | Not started |
| Phase 6 — Fusion Builder JSON | Full Avada drop-in export | Deferred to v2 |

See `docs/ARCHITECTURE.md` for the full phased build plan and dependencies.

---

## Security posture

- **Subdomain**: `wizardd.allegiantdigital.co` only. The tool is not exposed on the main marketing domain.
- **Authentication**: Netlify Identity gated to `@allegiantdigital.com` email addresses only. External contractors do not get access.
- **Indexing**: `X-Robots-Tag: noindex, nofollow` enforced at the HTTP header level (see `_headers`), with `robots.txt` blocking AI crawlers (`GPTBot`, `Claude-Web`, `PerplexityBot`, `CCBot`, etc.) and standard search engines.
- **Partner previews**: One-time signed URLs generated per build. Default 7-day expiry, extendable to 21 days. Partners see only their assigned preview, never the tool itself.
- **Secrets**: All API keys and signing secrets live in Netlify environment variables. None committed to the repo.

---

## Contributing

Web WIZARDD is internal to Allegiant Digital Marketing. Contribution is restricted to Allegiant employees with credentialed access. External pull requests will not be reviewed.

Every change to a schema requires the validator to pass. Every change to a layer requires its own tests. Every change of any kind passes the Allegiant Gauntlet™ before it merges.

---

**Built by Allegiant Digital Marketing · Internal · v0.1.0**
