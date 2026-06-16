/**
 * LLM-based extraction for the A.R.C. sections that vary in structure
 * or are prose-heavy enough that regex extraction loses fidelity.
 *
 * Strategy: produce structured prompts targeting specific schema fields,
 * route them through the LLM cache (record-and-replay), parse JSON responses,
 * merge results into the partial extraction from regex-extractors.js.
 *
 * Each task scopes the HTML to just the panels relevant to its target fields,
 * keeping prompts focused and token usage low.
 */

const cheerio = require('cheerio');
const { cachedComplete } = require('../../shared/llm-cache');

/* ─────────────────────────────────────────────────────────────────
 * normalizeForSchema — coerce LLM output quirks into schema-conforming shape.
 *
 * LLMs sometimes return "" or "null" or "N/A" or "Not provided" instead of
 * actual JSON null for unknown fields. The schema validates strictly — an
 * empty string on a URI-format field fails validation.
 *
 * This helper walks a value and rewrites:
 *   - empty strings → null
 *   - "null", "n/a", "none", "not provided", "unknown", "tbd" (case-insensitive) → null
 * Arrays and objects are recursed into.
 *
 * Apply at the top of every mergeResult before touching the schema record.
 * ───────────────────────────────────────────────────────────────── */

const NULL_LIKE_STRINGS = new Set([
  '', 'null', 'n/a', 'na', 'none', 'not provided', 'not specified',
  'unknown', 'tbd', 'tba', 'undefined', '-', '—'
]);

function normalizeForSchema(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (NULL_LIKE_STRINGS.has(trimmed.toLowerCase())) return null;
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeForSchema).filter(v => v !== null || true); // keep array shape; nulls inside arrays are fine
  }
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = normalizeForSchema(value[key]);
    }
    return out;
  }
  return value;
}

/* ─────────────────────────────────────────────────────────────────
 * Task definitions
 *
 * Each task declares:
 *   - name: identifier used for cache fixture filenames
 *   - panels: which A.R.C. tab IDs to scope HTML to
 *   - targetPath: dot-path into the schema where the result merges
 *   - promptBuilder: function(htmlContext) → {system, user}
 *   - validateResult: function(data) → {ok, error?} sanity check before merge
 *   - mergeResult: function(extractedSoFar, data) → extractedSoFar (mutates and returns)
 * ───────────────────────────────────────────────────────────────── */

const TASKS = [
  {
    name: 'vertical-and-identity',
    panels: ['panel-cover', 'panel-forward', 'panel-exec', 'panel-s10'],
    promptBuilder: buildIdentityPrompt,
    validateResult: (d) => ({
      ok: d && typeof d === 'object' && (d.vertical === null || typeof d.vertical === 'string')
    }),
    mergeResult: (out, d) => {
      const bi = out.businessIdentity;
      if (d.vertical) bi.vertical = String(d.vertical).toLowerCase();
      if (d.subVertical !== undefined) bi.subVertical = d.subVertical;
      if (d.zone !== undefined) bi.zone = d.zone;
      if (d.yearsOperating !== undefined && d.yearsOperating !== null) bi.yearsOperating = Number(d.yearsOperating);
      if (d.tagline !== undefined) bi.tagline = d.tagline;
      return out;
    }
  },
  {
    name: 'founder-narrative',
    panels: ['panel-forward'],
    promptBuilder: buildFounderPrompt,
    validateResult: (d) => ({ ok: d && typeof d === 'object' && (d.founderNarrative === null || typeof d.founderNarrative === 'string') }),
    mergeResult: (out, d) => { out.businessIdentity.founderNarrative = d.founderNarrative; return out; }
  },
  {
    name: 'target-services',
    panels: ['panel-s2', 'panel-audience', 'panel-s8'],
    promptBuilder: buildServicesPrompt,
    validateResult: (d) => ({ ok: d && Array.isArray(d.targetServices) && d.targetServices.length > 0 }),
    mergeResult: (out, d) => { out.targetServices = d.targetServices; return out; }
  },
  {
    name: 'target-locations',
    panels: ['panel-cover', 'panel-audience', 'panel-s2', 'panel-s10'],
    promptBuilder: buildLocationsPrompt,
    validateResult: (d) => ({ ok: d && Array.isArray(d.targetLocations) && d.targetLocations.length > 0 }),
    mergeResult: (out, d) => { out.targetLocations = d.targetLocations; return out; }
  },
  {
    name: 'pain-points',
    panels: ['panel-exec', 'panel-s3', 'panel-s4', 'panel-s5', 'panel-s6'],
    promptBuilder: buildPainPointsPrompt,
    validateResult: (d) => ({ ok: d && Array.isArray(d.painPoints) }),
    mergeResult: (out, d) => { out.painPoints = d.painPoints; return out; }
  },
  {
    name: 'roadmap',
    panels: ['panel-s8', 'panel-s9'],
    promptBuilder: buildRoadmapPrompt,
    validateResult: (d) => ({ ok: d && d.roadmap && typeof d.roadmap === 'object' }),
    mergeResult: (out, d) => { out.roadmap = d.roadmap; return out; }
  },
  {
    name: 'buying-journey',
    panels: ['panel-audience'],
    promptBuilder: buildJourneyPrompt,
    validateResult: (d) => ({ ok: d && d.buyingJourney && Array.isArray(d.buyingJourney.stages) }),
    mergeResult: (out, d) => { out.audience.buyingJourney = d.buyingJourney; return out; }
  },
  {
    name: 'ai-platform-detail',
    panels: ['panel-s5'],
    promptBuilder: buildAiPlatformPrompt,
    validateResult: (d) => ({ ok: d && (d.platforms || d.disciplineScores || d.citationCount !== undefined) }),
    mergeResult: (out, d) => {
      if (d.citationCount !== undefined) out.aiVisibility.citationCount = d.citationCount;
      if (d.platforms) out.aiVisibility.platforms = { ...out.aiVisibility.platforms, ...d.platforms };
      if (d.disciplineScores) out.aiVisibility.disciplineScores = { ...out.aiVisibility.disciplineScores, ...d.disciplineScores };
      return out;
    }
  },
  {
    name: 'digital-presence-detail',
    panels: ['panel-s3', 'panel-s4', 'panel-s6'],
    promptBuilder: buildDigitalPresencePrompt,
    validateResult: (d) => ({ ok: d && d.currentDigitalPresence && typeof d.currentDigitalPresence === 'object' }),
    mergeResult: (out, d) => {
      // Deep merge so we don't wipe out fields the LLM didn't return
      out.currentDigitalPresence = deepMerge(out.currentDigitalPresence, d.currentDigitalPresence);
      // Force missing-platform shape for any social platforms the LLM omitted
      const platforms = ['facebook', 'instagram', 'nextdoor', 'linkedin', 'tiktok', 'youtube'];
      out.currentDigitalPresence.social = out.currentDigitalPresence.social || {};
      for (const p of platforms) {
        if (!out.currentDigitalPresence.social[p]) {
          out.currentDigitalPresence.social[p] = {
            url: null, followers: null, reviewCount: null, recommendationPct: null,
            lastActivityDate: null, status: 'missing', knownIssues: []
          };
        }
      }
      return out;
    }
  }
];

/* ─────────────────────────────────────────────────────────────────
 * Prompt builders
 *
 * Each builder receives the HTML scoped to its relevant panels and
 * returns {system, user} for the Claude call.
 * ───────────────────────────────────────────────────────────────── */

const COMMON_SYSTEM = "You are extracting structured data from an Allegiant A.R.C. Report. The A.R.C. is an HTML report with a 13-tab structure containing business analysis, persona profiles, AI visibility scores, competitive analysis, and a recommended roadmap. Respond with valid JSON only — no preamble, no markdown fences, no commentary, no explanations. The JSON must parse cleanly with JSON.parse(). CRITICAL: when a field's value is unknown or absent, return JSON null (the literal null, not the string \"null\"). NEVER return empty strings, \"N/A\", \"Not provided\", \"Unknown\", \"TBD\", or any placeholder text for unknown fields — use null. For URL fields specifically, return null unless you have a real http:// or https:// URL.";

function buildIdentityPrompt(htmlContext) {
  return {
    system: COMMON_SYSTEM,
    user: `Extract the business identity fields from these A.R.C. HTML excerpts. Set fields to null if not present.

Required fields:
- vertical (string): partner's industry vertical, lowercase, underscores not spaces. Examples: "electrician", "hvac", "plumbing", "roofing", "med_spa_wellness", "collections_agency", "commercial_kitchen_service", "ria_ma_advisor", "legal", "medical", "franchisor", "manufacturer"
- subVertical (string|null): more specific sub-classification if clearly stated
- zone (string|null): Allegiant pricing zone if mentioned (e.g., "Houston (Zone 1)", "Z1", "Z2", "Z3")
- yearsOperating (integer|null): years in business if stated
- tagline (string|null): tagline or one-line positioning from the cover or forward, if present

HTML excerpts:
${htmlContext}

Return JSON only: {"vertical": "...", "subVertical": null, "zone": null, "yearsOperating": null, "tagline": null}`
  };
}

function buildFounderPrompt(htmlContext) {
  return {
    system: COMMON_SYSTEM,
    user: `Extract the founder narrative from the Word from Founder tab. Return the full prose as a single string preserving paragraph breaks with \\n\\n. If the section is empty, boilerplate, or contains no real founder voice content, return null.

HTML:
${htmlContext}

Return JSON only: {"founderNarrative": "..." or null}`
  };
}

function buildServicesPrompt(htmlContext) {
  return {
    system: COMMON_SYSTEM,
    user: `Extract the partner's target services from these A.R.C. excerpts. Look in the Audience Opportunity section, Target Audience section, and Roadmap section for services the partner offers or should feature.

For each service, return:
- name (string, required): the full service name as the partner would describe it
- shortName (string|null): condensed label for navigation (1-3 words)
- personaIds (array of "P1".."P6"): IDs of personas from the audience section this service primarily serves
- priority (string): one of "high", "medium", "low", "growth", "high-LTV"
- competitiveContext (string|null): brief note on competitive landscape for this service

HTML excerpts:
${htmlContext}

Return JSON only: {"targetServices": [...]}`
  };
}

function buildLocationsPrompt(htmlContext) {
  return {
    system: COMMON_SYSTEM,
    user: `Extract the partner's target locations from these A.R.C. excerpts. Look in the Cover, Audience, Audience Opportunity, and Contact sections.

For each location:
- name (string, required): city, neighborhood, or metro
- tier (string): "primary" (anchor markets the home/service pages must speak to), "secondary" (additional service-area coverage), or "tertiary" (mentioned-in-passing)
- context (string|null): why this location matters
- parentRegion (string|null): state or metro the location sits within (e.g., "Houston, TX")

HTML excerpts:
${htmlContext}

Return JSON only: {"targetLocations": [...]}`
  };
}

function buildPainPointsPrompt(htmlContext) {
  return {
    system: COMMON_SYSTEM,
    user: `Extract every specific pain point identified in these A.R.C. excerpts — issues with the partner's current digital presence, brand, technical SEO, AI visibility, social media, or reviews that the new site should resolve. Return as an array of concise strings.

HTML excerpts:
${htmlContext}

Return JSON only: {"painPoints": ["...", "..."]}`
  };
}

function buildRoadmapPrompt(htmlContext) {
  return {
    system: COMMON_SYSTEM,
    user: `Extract the roadmap and investment structure.

Required:
- phases: array of {phase: integer, title: string, description: string|null}
- packages: array of {tier: "A"|"B"|"C"|"D", name: string, services: array of strings, zoneAdjustment: string|null}

Important: if the A.R.C. uses alternative tier labels like "Good/Better/Best/Great", map them to A/B/C/D in order (Good→A, Better→B, Best→C, Great→D) and keep the original label in the 'name' field.

HTML excerpts:
${htmlContext}

Return JSON only: {"roadmap": {"phases": [...], "packages": [...]}}`
  };
}

function buildJourneyPrompt(htmlContext) {
  return {
    system: COMMON_SYSTEM,
    user: `Extract the aggregate buying journey from the Target Audience section. The journey may have 3, 4, or 5 stages.

For each stage:
- step (integer)
- name (string)
- description (string|null)
- channels (array of strings): channels personas use at this stage

HTML excerpts:
${htmlContext}

Return JSON only: {"buyingJourney": {"stages": [...]}}`
  };
}

function buildAiPlatformPrompt(htmlContext) {
  return {
    system: COMMON_SYSTEM,
    user: `Extract per-platform AI visibility from the AI Search Visibility section.

Required structure:
- citationCount (string|null): format like "2 of 6" if stated
- platforms: object with keys chatgpt, claude, gemini, perplexity, copilot. Each value: {cited: boolean|null, citationContext: string|null, score: 0-100|null}
- disciplineScores: object with keys aeo, geo, aiSeo, llmSeo. Each value: {score: 0-100|null, notes: string|null}

If a platform or discipline is not mentioned, include it with null values rather than omitting.

HTML excerpts:
${htmlContext}

Return JSON only: {"citationCount": "...", "platforms": {...}, "disciplineScores": {...}}`
  };
}

function buildDigitalPresencePrompt(htmlContext) {
  return {
    system: COMMON_SYSTEM,
    user: `Extract the partner's current digital presence from the Website Audit, Reputation, and Social & Ads sections.

Required structure (use null for unknown fields, do not omit):
{
  "currentDigitalPresence": {
    "website": {"url": null, "lcpDesktopSeconds": null, "lcpMobileSeconds": null, "knownIssues": []},
    "reviews": {
      "googleRating": null, "googleReviewCount": null,
      "yelp": {"verified": null, "visibleReviewCount": null, "knownIssues": []},
      "bbb": {"present": null, "rating": null, "knownIssues": []}
    },
    "social": {
      "facebook": {...}, "instagram": {...}, "nextdoor": {...},
      "linkedin": {...}, "tiktok": {...}, "youtube": {...}
    },
    "paidMedia": {
      "googleAds": {"active": null, "notes": null},
      "localServiceAds": {"present": null, "competitorsHoldingSlots": []}
    }
  }
}

Each social platform value: {url, followers, reviewCount, recommendationPct, lastActivityDate, status, knownIssues}.
Status must be one of "active", "dormant", "missing", "issue".
If a platform has no presence at all, use status "missing".

HTML excerpts:
${htmlContext}

Return JSON only with the structure above.`
  };
}

/* ─────────────────────────────────────────────────────────────────
 * HTML scoping — pull just the relevant panels for prompt context
 * ───────────────────────────────────────────────────────────────── */

function scopeHtmlToPanels($, panelIds) {
  const parts = [];
  for (const id of panelIds) {
    const $panel = $(`#${id}`);
    if (!$panel.length) continue;
    // Get the panel's text content. Using .text() collapses markup but
    // preserves all human-readable content — which is what the LLM needs.
    // We prefix each section so the LLM can navigate the context.
    const text = $panel.text().replace(/\s+/g, ' ').trim();
    if (text.length > 0) {
      parts.push(`---[${id}]---\n${text}`);
    }
  }
  // Cap context size to keep token cost predictable
  const joined = parts.join('\n\n');
  return joined.length > 50000 ? joined.substring(0, 50000) + '...[truncated]' : joined;
}

/* ─────────────────────────────────────────────────────────────────
 * deepMerge — for safely combining the LLM-extracted digital presence
 * with whatever the regex extractor already populated.
 * ───────────────────────────────────────────────────────────────── */

function deepMerge(target, source) {
  if (!source) return target;
  if (!target) return source;
  if (typeof source !== 'object' || Array.isArray(source)) return source;
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/* ─────────────────────────────────────────────────────────────────
 * Main entry — run all 9 LLM extraction tasks against the partial
 * regex extraction and a partner record being built.
 *
 * Called by src/layers/1-ingestion/index.js AFTER regex extraction
 * has populated the deterministic fields. The normalized output of
 * regex extraction is mutated in place as each LLM task completes.
 * ───────────────────────────────────────────────────────────────── */

async function applyLlmExtraction(normalizedRecord, html) {
  const $ = cheerio.load(html);
  const warnings = [];
  let tasksRun = 0;
  let tasksSucceeded = 0;
  let tokenUsage = { input: 0, output: 0 };

  for (const task of TASKS) {
    tasksRun++;
    const scoped = scopeHtmlToPanels($, task.panels);
    if (!scoped) {
      warnings.push(`LLM task '${task.name}' skipped — none of its source panels (${task.panels.join(', ')}) present in the A.R.C.`);
      continue;
    }
    const prompt = task.promptBuilder(scoped);
    try {
      const response = await cachedComplete(prompt, { taskName: task.name });
      if (response.usage) {
        tokenUsage.input += response.usage.input_tokens || 0;
        tokenUsage.output += response.usage.output_tokens || 0;
      }
      // Normalize empty strings, "Not provided", "N/A" etc. to actual null
      // before validation and merge. Schema validation is strict and would
      // reject an empty string on a URI-format field.
      const cleaned = normalizeForSchema(response.data);
      const validation = task.validateResult(cleaned);
      if (!validation.ok) {
        warnings.push(`LLM task '${task.name}' returned data that failed sanity check: ${validation.error || 'shape mismatch'}`);
        continue;
      }
      task.mergeResult(normalizedRecord, cleaned);
      tasksSucceeded++;
    } catch (err) {
      warnings.push(`LLM task '${task.name}' failed: ${err.message}`);
    }
  }

  // Append a summary line to the warnings so the caller can see overall LLM stats
  warnings.unshift(
    `LLM extraction: ${tasksSucceeded}/${tasksRun} tasks succeeded. ` +
    `Token usage — input: ${tokenUsage.input}, output: ${tokenUsage.output}.`
  );

  return { extracted: normalizedRecord, warnings };
}

module.exports = {
  applyLlmExtraction,
  TASKS,
  // exposed for testing
  scopeHtmlToPanels,
  deepMerge,
  normalizeForSchema,
  buildIdentityPrompt,
  buildFounderPrompt,
  buildServicesPrompt,
  buildLocationsPrompt,
  buildPainPointsPrompt,
  buildRoadmapPrompt,
  buildJourneyPrompt,
  buildAiPlatformPrompt,
  buildDigitalPresencePrompt
};
