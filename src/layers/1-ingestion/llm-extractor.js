/**
 * LLM-based extraction for the A.R.C. sections that vary in structure
 * or are prose-heavy enough that regex extraction loses fidelity.
 *
 * Strategy: this module produces structured prompts targeting specific schema
 * fields, sends them to the Claude API, parses the JSON response, and merges
 * the extracted values into the partial extraction from regex-extractors.js.
 *
 * The transport in this file is STUBBED for v0.1. The actual API wiring
 * happens once ANTHROPIC_API_KEY is configured in the Netlify environment.
 * In the stub state, this module returns the input partial unchanged but
 * populates `extractionWarnings` with the fields that would have been
 * LLM-extracted.
 *
 * When the transport is wired:
 *   - Each LLM extraction targets a specific section of the A.R.C. (not the
 *     whole document) to keep context usage focused and the response schema
 *     tight.
 *   - The model is given the exact JSON schema fragment it must produce.
 *   - Responses are validated against the schema before merging.
 *   - Any LLM extraction that fails to validate is logged to extractionWarnings
 *     and the field is left null.
 */

/**
 * Configuration for each LLM extraction task.
 * Each entry defines: which schema fields it produces, what HTML section to
 * scope to, and a prompt that targets those specific fields.
 */
const LLM_EXTRACTION_TASKS = [
  {
    name: 'vertical-and-identity',
    panels: ['panel-cover', 'panel-forward', 'panel-exec'],
    targetFields: ['businessIdentity.vertical', 'businessIdentity.subVertical', 'businessIdentity.zone', 'businessIdentity.yearsOperating', 'businessIdentity.tagline'],
    promptTemplate: buildIdentityPrompt
  },
  {
    name: 'founder-narrative',
    panels: ['panel-forward'],
    targetFields: ['businessIdentity.founderNarrative'],
    promptTemplate: buildFounderPrompt
  },
  {
    name: 'target-services',
    panels: ['panel-s2', 'panel-audience', 'panel-s8'],
    targetFields: ['targetServices'],
    promptTemplate: buildServicesPrompt
  },
  {
    name: 'target-locations',
    panels: ['panel-cover', 'panel-audience', 'panel-s2'],
    targetFields: ['targetLocations'],
    promptTemplate: buildLocationsPrompt
  },
  {
    name: 'pain-points',
    panels: ['panel-exec', 'panel-s3', 'panel-s4', 'panel-s5'],
    targetFields: ['painPoints'],
    promptTemplate: buildPainPointsPrompt
  },
  {
    name: 'roadmap',
    panels: ['panel-s8', 'panel-s9'],
    targetFields: ['roadmap'],
    promptTemplate: buildRoadmapPrompt
  },
  {
    name: 'buying-journey',
    panels: ['panel-audience'],
    targetFields: ['audience.buyingJourney'],
    promptTemplate: buildJourneyPrompt
  },
  {
    name: 'ai-platform-detail',
    panels: ['panel-s5'],
    targetFields: ['aiVisibility.platforms', 'aiVisibility.disciplineScores', 'aiVisibility.citationCount'],
    promptTemplate: buildAiPlatformPrompt
  },
  {
    name: 'digital-presence-detail',
    panels: ['panel-s3', 'panel-s4', 'panel-s6'],
    targetFields: ['currentDigitalPresence'],
    promptTemplate: buildDigitalPresencePrompt
  }
];

/* ─────────────────────────────────────────────────────────────────
 * Prompt builders — each returns a Claude API messages payload
 * targeting specific schema fields. Prompts are intentionally
 * focused (one logical concept per call) so responses stay tight.
 * ───────────────────────────────────────────────────────────────── */

function buildIdentityPrompt(htmlContext) {
  return {
    system: "You are extracting structured data from an Allegiant A.R.C. Report. Respond with valid JSON only — no preamble, no markdown, no commentary.",
    user: `From the following A.R.C. Report HTML excerpts, extract the following business identity fields. If a field is not present or cannot be inferred, set it to null.

Required fields:
- vertical (string): The partner's industry vertical, lowercase (e.g., "electrician", "hvac", "plumbing", "ria m&a advisor")
- subVertical (string|null): More specific sub-classification if mentioned
- zone (string|null): Allegiant pricing zone designation if mentioned (e.g., "Houston (Zone 1)", "Z1", "Z2")
- yearsOperating (integer|null): Years the partner has been in business
- tagline (string|null): Tagline or one-line positioning from the cover or forward

HTML excerpts:
${htmlContext}

Return JSON only: {"vertical": "...", "subVertical": "...", "zone": "...", "yearsOperating": 0, "tagline": "..."}`
  };
}

function buildFounderPrompt(htmlContext) {
  return {
    system: "You are extracting structured data from an Allegiant A.R.C. Report. Respond with valid JSON only — no preamble, no markdown, no commentary.",
    user: `From the Word from Founder tab content below, extract the full founder narrative as a single string preserving paragraph structure. If the founder section is empty or boilerplate, return null.

Content:
${htmlContext}

Return JSON only: {"founderNarrative": "..." or null}`
  };
}

function buildServicesPrompt(htmlContext) {
  return {
    system: "You are extracting structured data from an Allegiant A.R.C. Report. Respond with valid JSON only — no preamble, no markdown, no commentary.",
    user: `From the following A.R.C. Report HTML excerpts, extract the partner's target services. Each service should include:
- name (string, required): full service name as the partner would describe it
- shortName (string|null): condensed label for navigation
- personaIds (array of "P1".."P6"): persona IDs this service primarily serves (cross-referenced from the audience section)
- priority (string): one of "high", "medium", "low", "growth", "high-LTV"
- competitiveContext (string|null): notes on competitive landscape

HTML excerpts:
${htmlContext}

Return JSON only: {"targetServices": [{...}, {...}]}`
  };
}

function buildLocationsPrompt(htmlContext) {
  return {
    system: "You are extracting structured data from an Allegiant A.R.C. Report. Respond with valid JSON only — no preamble, no markdown, no commentary.",
    user: `From the following A.R.C. Report HTML excerpts, extract the partner's target locations. Each should include:
- name (string, required): city, neighborhood, or metro name
- tier (string): one of "primary", "secondary", "tertiary"
- context (string|null): why this location matters
- parentRegion (string|null): state or metro

HTML excerpts:
${htmlContext}

Return JSON only: {"targetLocations": [{...}, {...}]}`
  };
}

function buildPainPointsPrompt(htmlContext) {
  return {
    system: "You are extracting structured data from an Allegiant A.R.C. Report. Respond with valid JSON only — no preamble, no markdown, no commentary.",
    user: `From the following A.R.C. Report HTML excerpts, extract every specific pain point identified — issues with the partner's current digital presence that the new site should resolve. Return as an array of strings, each a discrete pain point.

HTML excerpts:
${htmlContext}

Return JSON only: {"painPoints": ["...", "..."]}`
  };
}

function buildRoadmapPrompt(htmlContext) {
  return {
    system: "You are extracting structured data from an Allegiant A.R.C. Report. Respond with valid JSON only — no preamble, no markdown, no commentary.",
    user: `Extract the roadmap structure:
- phases: array of {phase: integer, title: string, description: string|null}
- packages: array of {tier: "A"|"B"|"C"|"D", name: string, services: array of strings, zoneAdjustment: string|null}

HTML excerpts:
${htmlContext}

Return JSON only: {"roadmap": {"phases": [...], "packages": [...]}}`
  };
}

function buildJourneyPrompt(htmlContext) {
  return {
    system: "You are extracting structured data from an Allegiant A.R.C. Report. Respond with valid JSON only — no preamble, no markdown, no commentary.",
    user: `Extract the aggregate buying journey from the audience section. The journey may have 3, 4, or 5 stages. Each stage should include:
- step (integer)
- name (string)
- description (string|null)
- channels (array of strings)

HTML excerpts:
${htmlContext}

Return JSON only: {"buyingJourney": {"stages": [...]}}`
  };
}

function buildAiPlatformPrompt(htmlContext) {
  return {
    system: "You are extracting structured data from an Allegiant A.R.C. Report. Respond with valid JSON only — no preamble, no markdown, no commentary.",
    user: `Extract per-platform AI visibility details from the AI Visibility tab.

Required structure:
- citationCount (string): format like "2 of 6"
- platforms: object with keys chatgpt, claude, gemini, perplexity, copilot. Each value: {cited: boolean|null, citationContext: string|null, score: 0-100|null}
- disciplineScores: object with keys aeo, geo, aiSeo, llmSeo. Each value: {score: 0-100|null, notes: string|null}

HTML excerpts:
${htmlContext}

Return JSON only.`
  };
}

function buildDigitalPresencePrompt(htmlContext) {
  return {
    system: "You are extracting structured data from an Allegiant A.R.C. Report. Respond with valid JSON only — no preamble, no markdown, no commentary.",
    user: `Extract the partner's current digital presence from the Website Audit, Reputation, and Social & Ads tabs.

Required structure:
- website: {url, lcpDesktopSeconds, lcpMobileSeconds, knownIssues: []}
- reviews: {googleRating, googleReviewCount, yelp: {verified, visibleReviewCount, knownIssues: []}, bbb: {present, rating, knownIssues: []}}
- social: {facebook, instagram, nextdoor, linkedin, tiktok, youtube} — each {url, followers, reviewCount, recommendationPct, lastActivityDate, status: "active"|"dormant"|"missing"|"issue", knownIssues: []}
- paidMedia: {googleAds: {active, notes}, localServiceAds: {present, competitorsHoldingSlots: []}}

Use null for fields not present. Use status "missing" for platforms with no presence rather than omitting them.

HTML excerpts:
${htmlContext}

Return JSON only: {"currentDigitalPresence": {...}}`
  };
}

/* ─────────────────────────────────────────────────────────────────
 * Transport — STUBBED in v0.1
 *
 * The real implementation calls Anthropic API with the constructed
 * prompt and returns parsed JSON. The stub returns null and records
 * which fields would have been extracted.
 * ───────────────────────────────────────────────────────────────── */

async function callClaude(prompt, options = {}) {
  // STUB: real implementation calls Anthropic API.
  // Returning a tombstone value signals to the caller that LLM extraction
  // was attempted but not yet wired up.
  return { __stub__: true, __reason__: 'LLM transport not wired in v0.1' };
}

/**
 * Apply all LLM extraction tasks to a partial extraction result.
 *
 * @param {object} partialExtraction — output from regex-extractors.extractAll()
 * @param {string} html — full A.R.C. HTML
 * @returns {Promise<{extracted: object, warnings: string[]}>}
 */
async function applyLlmExtraction(partialExtraction, html) {
  const warnings = [];
  const extracted = { ...partialExtraction };

  for (const task of LLM_EXTRACTION_TASKS) {
    // In production, scope HTML to the relevant panels before passing to the prompt
    // For the stub, we just record what would have happened
    const scopedHtml = scopeHtmlToPanels(html, task.panels);
    const prompt = task.promptTemplate(scopedHtml);
    const result = await callClaude(prompt);

    if (result.__stub__) {
      warnings.push(`LLM task '${task.name}' stubbed — fields pending: ${task.targetFields.join(', ')}`);
      continue;
    }

    // When wired: merge result into extracted using task.targetFields as the
    // dot-path map. Validate against schema before committing the merge.
  }

  return { extracted, warnings };
}

function scopeHtmlToPanels(html, panelIds) {
  // Lightweight HTML scoping for prompt context.
  // For each panel ID, extract the panel's outer HTML and concatenate.
  // Stub returns a placeholder; real implementation uses cheerio.
  return `[scoped HTML for panels: ${panelIds.join(', ')}]`;
}

module.exports = {
  applyLlmExtraction,
  LLM_EXTRACTION_TASKS,
  // exposed for testing
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
