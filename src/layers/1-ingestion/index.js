/**
 * A.R.C. parser — orchestrates extraction + normalization for one A.R.C. URL.
 *
 * Pipeline:
 *   1. Fetch HTML from sourceUrl (or accept as direct input)
 *   2. Run regex/cheerio extractors for deterministic fields
 *   3. Normalize into schema-conforming output (with PENDING placeholders for
 *      the LLM-pending fields)
 *   4. Run LLM extractors for variant/prose fields (routed through llm-cache
 *      so test runs are fast/free and production runs hit the live API)
 *   5. Recompute completenessScore based on what actually landed
 *   6. Validate against arc-extraction.schema.json
 *   7. Return the extracted record (or throw on validation failure)
 *
 * Public API:
 *   parseArcUrl(url) → Promise<arcExtraction>
 *   parseArcHtml(html, sourceUrl) → Promise<arcExtraction>
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const regex = require('./regex-extractors');
const llm = require('./llm-extractor');

const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'schemas', 'arc-extraction.schema.json');
const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

/* ─────────────────────────────────────────────────────────────────
 * Public API
 * ───────────────────────────────────────────────────────────────── */

async function parseArcUrl(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Web WIZARDD parser)' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch A.R.C. URL ${url}: HTTP ${response.status}`);
  }
  const html = await response.text();
  return parseArcHtml(html, url);
}

async function parseArcHtml(html, sourceUrl) {
  // Pass 1 — deterministic regex/cheerio extraction
  const raw = regex.extractAll(html);

  // Pass 2 — normalize to schema shape (with placeholders for LLM-pending fields)
  const normalized = normalize(raw, sourceUrl);

  // Pass 3 — LLM enrichment. Mutates `normalized` in place by merging task results.
  const { warnings: llmWarnings } = await llm.applyLlmExtraction(normalized, html);
  normalized.metadata.extractionWarnings.push(...llmWarnings);

  // Pass 4 — recompute completeness now that LLM has populated more fields
  normalized.metadata.completenessScore = computeFinalCompleteness(normalized);

  // Pass 5 — schema validation. This catches any LLM extraction that produced
  // shape that doesn't match the schema (e.g., invalid enum value).
  const valid = validate(normalized);
  if (!valid) {
    const errMsg = ajv.errorsText(validate.errors);
    throw new Error(`A.R.C. extraction failed schema validation: ${errMsg}`);
  }

  return normalized;
}

/* ─────────────────────────────────────────────────────────────────
 * Normalization — turn raw regex extraction into schema-conforming output
 * with placeholders where LLM extraction will fill in.
 * ───────────────────────────────────────────────────────────────── */

function normalize(raw, sourceUrl) {
  const personas = raw.personas.map(p => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    subTier: p.subTier,
    ageRange: p.ageRange,
    locationContext: p.locationContext,
    situation: p.situation,
    trigger: p.trigger,
    mindset: p.mindset,
    device: p.device,
    decisionWindow: p.decisionWindow,
    primaryServiceIds: p.primaryServiceIds || [],
    weightingHint: p.weightingHint,
    fullProfileNotes: p.fullProfileNotes
  }));

  // Normalize weighting hints to sum to ~1.0 across the persona roster
  const weightSum = personas.reduce((s, p) => s + (p.weightingHint || 0), 0);
  if (weightSum > 0 && Math.abs(weightSum - 1.0) > 0.05) {
    personas.forEach(p => {
      if (p.weightingHint !== null) {
        p.weightingHint = Math.round((p.weightingHint / weightSum) * 100) / 100;
      }
    });
  }

  const warnings = [];
  if (personas.length === 0) {
    warnings.push('No personas extracted — audience section may be missing or in an unrecognized format');
  } else if (personas.length !== 6) {
    warnings.push(`Extracted ${personas.length} personas — A.R.C. template normally has exactly 6`);
  }
  if (raw.competitors.length === 0) {
    warnings.push('No competitors extracted from panel-s7 — competitive section may be missing');
  }
  if (raw.avs === null) {
    warnings.push('AVS score not extracted from regex — AI Visibility tab presentation may be in an unrecognized format (LLM may fill in)');
  }

  return {
    businessIdentity: raw.businessIdentity,
    currentDigitalPresence: {
      website: { url: null, lcpDesktopSeconds: null, lcpMobileSeconds: null, knownIssues: [] },
      reviews: {
        googleRating: null,
        googleReviewCount: null,
        yelp: { verified: null, visibleReviewCount: null, knownIssues: [] },
        bbb: { present: null, rating: null, knownIssues: [] }
      },
      social: {
        facebook:  emptySocial(), instagram: emptySocial(), nextdoor:  emptySocial(),
        linkedin:  emptySocial(), tiktok:    emptySocial(), youtube:   emptySocial()
      },
      paidMedia: {
        googleAds: { active: null, notes: null },
        localServiceAds: { present: null, competitorsHoldingSlots: [] }
      }
    },
    aiVisibility: {
      avs: raw.avs,
      citationCount: null,
      platforms: {
        chatgpt:    emptyPlatform(),
        claude:     emptyPlatform(),
        gemini:     emptyPlatform(),
        perplexity: emptyPlatform(),
        copilot:    emptyPlatform()
      },
      disciplineScores: {
        aeo:    { score: null, notes: null },
        geo:    { score: null, notes: null },
        aiSeo:  { score: null, notes: null },
        llmSeo: { score: null, notes: null }
      }
    },
    targetServices:  [{ name: 'PENDING_LLM_EXTRACTION', shortName: null, personaIds: [], priority: 'medium', competitiveContext: null }],
    targetLocations: [{ name: 'PENDING_LLM_EXTRACTION', tier: 'primary', context: null, parentRegion: null }],
    competitors: raw.competitors,
    audience: {
      totalCoveragePct: null,
      personas,
      buyingJourney: { stages: [] },
      decisionDrivers: raw.decisionDrivers,
      channelMap: raw.channelMap
    },
    painPoints: [],
    roadmap: { phases: [], packages: [] },
    metadata: {
      sourceUrl,
      extractedAt: new Date().toISOString(),
      // Panel IDs alone can't see card-level template drift — the tagline-card
      // template era (present in fixtures since at least 2026-06-15) kept all 13 panel IDs but changed the persona-card anatomy.
      // Card anatomy is therefore the primary era signal.
      arcTemplateVersion: raw.personaCardAnatomy === 'tagline'
        ? 'current-tagline-cards'
        : detectTemplateVersion(raw.panelInventory),
      completenessScore: 0,  // placeholder; recomputed after LLM pass
      extractionWarnings: warnings
    }
  };
}

function emptySocial() {
  return { url: null, followers: null, reviewCount: null, recommendationPct: null, lastActivityDate: null, status: 'missing', knownIssues: [] };
}

function emptyPlatform() {
  return { cited: null, citationContext: null, score: null };
}

/* ─────────────────────────────────────────────────────────────────
 * Final completeness scoring
 *
 * Counts the high-leverage fields that should be populated after the
 * full regex + LLM pipeline runs. This is the score builders see in
 * the Gauntlet Evidence and use to decide whether to proceed to
 * Generation.
 * ───────────────────────────────────────────────────────────────── */

function computeFinalCompleteness(record) {
  let count = 0;
  let possible = 0;

  // Identity (5 fields)
  const bi = record.businessIdentity;
  possible += 5;
  if (bi.businessName) count++;
  if (bi.vertical && bi.vertical !== 'unknown') count++;
  if (bi.zone) count++;
  if (bi.yearsOperating) count++;
  if (bi.founderNarrative) count++;

  // Personas — June-2026 cards carry 9 extractable fields; the tagline-card
  // anatomy (tagline cards) dropped subTier from the badge, so tagline-era
  // reports are scored on 8 fields rather than penalized for a field the
  // template no longer contains.
  const taglineEra = record.metadata.arcTemplateVersion === 'current-tagline-cards';
  possible += 6 * (taglineEra ? 8 : 9);
  for (const p of record.audience.personas) {
    if (p.name) count++;
    if (p.tier) count++;
    if (!taglineEra && p.subTier !== null) count++;
    if (p.ageRange) count++;
    if (p.locationContext) count++;
    if (p.situation) count++;
    if (p.trigger) count++;
    if (p.mindset) count++;
    if (p.device) count++;
  }

  // Competitors (5 expected)
  possible += 5;
  count += Math.min(record.competitors.length, 5);

  // AVS (1)
  possible += 1;
  if (record.aiVisibility.avs !== null) count++;

  // Decision drivers (6 expected)
  possible += 6;
  count += Math.min(record.audience.decisionDrivers.length, 6);

  // Channel map (7 expected — common floor across A.R.C.s)
  possible += 7;
  count += Math.min(record.audience.channelMap.length, 7);

  // Target services & locations (LLM-extracted; expect 4+ each)
  possible += 4;
  const realServices = record.targetServices.filter(s => s.name !== 'PENDING_LLM_EXTRACTION').length;
  count += Math.min(realServices, 4);

  possible += 4;
  const realLocations = record.targetLocations.filter(l => l.name !== 'PENDING_LLM_EXTRACTION').length;
  count += Math.min(realLocations, 4);

  // Pain points (LLM-extracted; expect 5+)
  possible += 5;
  count += Math.min(record.painPoints.length, 5);

  // Roadmap phases (3 expected) + packages (4 expected)
  possible += 3;
  count += Math.min(record.roadmap.phases.length, 3);
  possible += 4;
  count += Math.min(record.roadmap.packages.length, 4);

  // Buying journey stages (3 expected)
  possible += 3;
  count += Math.min(record.audience.buyingJourney.stages.length, 3);

  return Math.round((count / possible) * 100);
}

function detectTemplateVersion(panelInventory) {
  const expected = ['panel-cover', 'panel-forward', 'panel-exec', 'panel-s2', 'panel-audience', 'panel-s3', 'panel-s4', 'panel-s5', 'panel-s6', 'panel-s7', 'panel-s8', 'panel-s9', 'panel-s10'];
  const matches = expected.filter(p => panelInventory.includes(p)).length;
  if (matches === 13) return 'current-2026-06';
  if (matches >= 10) return 'current-2026-06-partial';
  return 'unknown';
}

module.exports = { parseArcUrl, parseArcHtml, computeFinalCompleteness };
