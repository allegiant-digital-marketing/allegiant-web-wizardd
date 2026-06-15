/**
 * A.R.C. parser — orchestrates extraction + normalization for one A.R.C. URL.
 *
 * Pipeline:
 *   1. Fetch HTML from sourceUrl
 *   2. Run regex/cheerio extractors for deterministic fields
 *   3. Run LLM extractors for variant/prose fields (stubbed in v0.1)
 *   4. Normalize into schema-conforming output
 *   5. Validate against arc-extraction.schema.json
 *   6. Compute completenessScore
 *   7. Return the partner record (or throw on validation failure)
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

  // Pass 2 — LLM enrichment (stubbed in v0.1)
  const { extracted: enriched, warnings: llmWarnings } = await llm.applyLlmExtraction(raw, html);

  // Pass 3 — normalize to schema shape
  const normalized = normalize(enriched, sourceUrl, llmWarnings);

  // Pass 4 — schema validation
  const valid = validate(normalized);
  if (!valid) {
    const errMsg = ajv.errorsText(validate.errors);
    throw new Error(`A.R.C. extraction failed schema validation: ${errMsg}`);
  }

  return normalized;
}

/* ─────────────────────────────────────────────────────────────────
 * Normalization — turn raw extraction into schema-conforming output
 * ───────────────────────────────────────────────────────────────── */

function normalize(raw, sourceUrl, llmWarnings = []) {
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

  // Normalize weighting hints to sum to ~1.0
  const weightSum = personas.reduce((s, p) => s + (p.weightingHint || 0), 0);
  if (weightSum > 0 && Math.abs(weightSum - 1.0) > 0.05) {
    personas.forEach(p => {
      if (p.weightingHint !== null) {
        p.weightingHint = Math.round((p.weightingHint / weightSum) * 100) / 100;
      }
    });
  }

  const warnings = [...llmWarnings];
  const fieldsExtracted = countExtractedFields(raw);
  const completenessScore = computeCompleteness(fieldsExtracted);

  if (completenessScore < 80) {
    warnings.push(`Completeness score ${completenessScore} is below the 80 threshold — builder review recommended before Generation runs.`);
  }
  if (personas.length === 0) {
    warnings.push('No personas extracted — audience section may be missing or in an unrecognized format');
  }
  if (personas.length > 0 && personas.length !== 6) {
    warnings.push(`Extracted ${personas.length} personas — A.R.C. template normally has exactly 6`);
  }
  if (raw.competitors.length === 0) {
    warnings.push('No competitors extracted from panel-s7 — competitive section may be missing');
  }
  if (raw.avs === null) {
    warnings.push('AVS score not extracted — AI Visibility tab presentation may be in an unrecognized format');
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
      social: {},
      paidMedia: {
        googleAds: { active: null, notes: null },
        localServiceAds: { present: null, competitorsHoldingSlots: [] }
      }
    },
    aiVisibility: {
      avs: raw.avs,
      citationCount: null,
      platforms: {
        chatgpt: { cited: null, citationContext: null, score: null },
        claude: { cited: null, citationContext: null, score: null },
        gemini: { cited: null, citationContext: null, score: null },
        perplexity: { cited: null, citationContext: null, score: null },
        copilot: { cited: null, citationContext: null, score: null }
      },
      disciplineScores: {
        aeo: { score: null, notes: null },
        geo: { score: null, notes: null },
        aiSeo: { score: null, notes: null },
        llmSeo: { score: null, notes: null }
      }
    },
    targetServices: [{ name: 'PENDING_LLM_EXTRACTION', shortName: null, personaIds: [], priority: 'medium', competitiveContext: null }],
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
      arcTemplateVersion: detectTemplateVersion(raw.panelInventory),
      completenessScore,
      extractionWarnings: warnings
    }
  };
}

/* ─────────────────────────────────────────────────────────────────
 * Completeness scoring
 *
 * Counts schema-relevant fields that the regex extractor populated.
 * This is a coarse signal — a 100 score does not guarantee correctness,
 * only that fields were extracted. The LLM extractor passes do not yet
 * contribute (they are stubbed); when they wire up, this calculation
 * grows to include LLM-extracted fields.
 * ───────────────────────────────────────────────────────────────── */

function countExtractedFields(raw) {
  let count = 0;
  let possible = 0;

  // Business identity: 1 deterministic field (businessName)
  possible += 1;
  if (raw.businessIdentity.businessName) count += 1;

  // Personas: 6 expected, ~9 fields per persona that are extractable from cards+modals
  possible += 6 * 9;
  for (const p of raw.personas) {
    if (p.name) count++;
    if (p.tier) count++;
    if (p.subTier !== null) count++;
    if (p.ageRange) count++;
    if (p.locationContext) count++;
    if (p.situation) count++;
    if (p.trigger) count++;
    if (p.mindset) count++;
    if (p.device) count++;
  }

  // Competitors: expecting ~5 with name (other fields require regex hits that may not always fire)
  possible += 5;
  count += Math.min(raw.competitors.length, 5);

  // AVS: 1 field
  possible += 1;
  if (raw.avs !== null) count += 1;

  // Decision drivers: expecting ~6
  possible += 6;
  count += Math.min(raw.decisionDrivers.length, 6);

  // Channel map: expecting ~8-10
  possible += 8;
  count += Math.min(raw.channelMap.length, 8);

  // Panels: expecting 13
  possible += 13;
  count += Math.min(raw.panelInventory.length, 13);

  return { count, possible };
}

function computeCompleteness({ count, possible }) {
  if (possible === 0) return 0;
  return Math.round((count / possible) * 100);
}

function detectTemplateVersion(panelInventory) {
  const expected = ['panel-cover', 'panel-forward', 'panel-exec', 'panel-s2', 'panel-audience', 'panel-s3', 'panel-s4', 'panel-s5', 'panel-s6', 'panel-s7', 'panel-s8', 'panel-s9', 'panel-s10'];
  const matches = expected.filter(p => panelInventory.includes(p)).length;
  if (matches === 13) return 'current-2026-06';
  if (matches >= 10) return 'current-2026-06-partial';
  return 'unknown';
}

module.exports = { parseArcUrl, parseArcHtml };
