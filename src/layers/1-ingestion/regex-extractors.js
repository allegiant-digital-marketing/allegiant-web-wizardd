/**
 * Deterministic extractors for the structurally-stable parts of an A.R.C. Report.
 *
 * Each extractor takes a cheerio $ object (the loaded A.R.C. document) and returns
 * a normalized JS object matching the corresponding section of the arc-extraction
 * schema.
 *
 * Extractors here MUST be deterministic — same input HTML → same output JSON every
 * time. Non-deterministic prose extraction lives in `llm-extractor.js` and is layered
 * on top of these results.
 *
 * Variance handling: where a field can appear in two known shapes (e.g., AVS score
 * presentation), extractors try shapes in order of frequency and fall through to
 * the LLM extractor if all known shapes fail.
 */

const cheerio = require('cheerio');

/* ─────────────────────────────────────────────────────────────────
 * Cover / Business identity
 * ───────────────────────────────────────────────────────────────── */

function extractBusinessIdentity($) {
  const businessName = $('.cover-company').first().text().trim();

  // Vertical inference fallback: A.R.C.s don't label the vertical in a fixed
  // field. The LLM extractor produces a high-quality inference; this keyword
  // heuristic provides a deterministic fallback so the parser can produce a
  // valid output even when the LLM transport is unwired (v0.1).
  //
  // The heuristic scans the cover, exec, and competitive panels for vertical
  // keyword signals and picks the highest-scoring match. When LLM extraction
  // is wired, it overrides this fallback.
  const vertical = inferVerticalFromKeywords($);

  return {
    businessName: businessName || null,
    vertical: vertical || 'unknown',
    subVertical: null,
    zone: null,
    yearsOperating: null,
    tagline: null,
    founderNarrative: null
  };
}

/**
 * Vertical inference fallback. Scans key panels for keyword signals.
 * Returns the highest-scoring known vertical, or null if no signal exceeds threshold.
 *
 * Verticals can be added here as new partners surface — the goal is coverage of
 * Allegiant's 7 named ICP verticals (Home Services subdivided + Franchisor + PE +
 * Mid-Market + Medical + Legal + Manufacturing) plus the partner-specific
 * verticals we have on file.
 */
const VERTICAL_KEYWORDS = {
  electrician:                  ['electrician', 'electrical', 'panel upgrade', 'wiring', 'circuit', 'breaker'],
  hvac:                         ['hvac', 'air conditioning', 'heating', 'furnace', 'a/c repair', 'a/c install'],
  plumbing:                     ['plumber', 'plumbing', 'drain cleaning', 'water heater', 'leak repair'],
  roofing:                      ['roofing', 'roofer', 'roof repair', 'shingle', 'storm damage'],
  pest_control:                 ['pest control', 'exterminator', 'termite', 'rodent'],
  appliance_repair:             ['appliance repair', 'refrigerator repair', 'washer repair'],
  commercial_kitchen_service:   ['commercial kitchen', 'kitchen equipment', 'foodservice equipment', 'refrigeration service'],
  med_spa_wellness:             ['cryo', 'cryotherapy', 'wellness studio', 'red light therapy', 'med spa', 'iv therapy'],
  collections_agency:           ['collections', 'debt recovery', 'receivables', 'accounts receivable', 'commercial collection'],
  ria_ma_advisor:               ['ria', 'wealth management', 'aum', 'm&a advisor', 'sell-side'],
  legal:                        ['law firm', 'attorney', 'personal injury', 'criminal defense', 'family law'],
  medical:                      ['practice', 'physician', 'patient', 'clinic', 'dermatology', 'orthodontic'],
  franchisor:                   ['franchisor', 'franchise system', 'franchisee', 'royalty'],
  manufacturer:                 ['manufacturer', 'manufacturing', 'industrial', 'b2b industrial', 'oem']
};

function inferVerticalFromKeywords($) {
  const haystack = [
    $('#panel-cover').text(),
    $('#panel-exec').text(),
    $('#panel-s7').text().substring(0, 4000),
    $('#panel-audience').text().substring(0, 4000)
  ].join(' ').toLowerCase();

  let best = { vertical: null, score: 0 };
  for (const [vertical, keywords] of Object.entries(VERTICAL_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const matches = haystack.split(kw).length - 1;
      score += matches;
    }
    if (score > best.score) best = { vertical, score };
  }

  return best.score >= 3 ? best.vertical : null;
}

/* ─────────────────────────────────────────────────────────────────
 * Persona cards (card preview — trigger / mindset / device)
 * ───────────────────────────────────────────────────────────────── */

function extractPersonaCards($) {
  const personas = [];

  $('.persona-card').each((idx, el) => {
    const $card = $(el);
    const id = `P${idx + 1}`;
    const isPrimary = $card.hasClass('pri');

    const badge = $card.find('.pc-badge').first().text().trim();
    const name = $card.find('.pc-title').first().text().trim();
    const role = $card.find('.pc-role').first().text().trim();

    // Parse the .pc-stat rows. Each contains <strong>Label:</strong> Value
    const stats = {};
    $card.find('.pc-stat').each((_, stat) => {
      const $stat = $(stat);
      const label = $stat.find('strong').first().text().trim().replace(/:$/, '');
      // Get the text after the strong tag
      const fullText = $stat.text().trim();
      const value = fullText.substring(fullText.indexOf(':') + 1).trim();
      if (label) stats[label.toLowerCase()] = value;
    });

    // Parse tier + sub-tier from badge text
    // Examples: "Primary · Highest Value", "Primary", "Secondary · Emergency Capture"
    const tierMatch = badge.match(/^(Primary|Secondary)/i);
    const tier = tierMatch ? tierMatch[1].toLowerCase() : (isPrimary ? 'primary' : 'secondary');
    let subTier = null;
    if (badge.includes('·')) {
      subTier = badge.split('·').slice(1).join('·').trim();
    } else if (badge.toLowerCase() !== tier) {
      // Sub-tier sometimes appears without the · separator (e.g. "Primary audience")
      const remaining = badge.replace(new RegExp(`^${tier}\\s*`, 'i'), '').trim();
      if (remaining && remaining.toLowerCase() !== 'audience') subTier = remaining;
    }

    // Parse age range from role text
    // Role pattern: "38–55 · Cypress / Bridgeland / Towne Lake homeowner · planning a generator before hurricane season"
    const roleSegments = role.split(/\s*[·•]\s*/);
    const ageRange = roleSegments[0] || null;
    const locationContext = roleSegments[1] || null;
    const situation = roleSegments.slice(2).join(' · ') || null;

    personas.push({
      id,
      name,
      tier,
      subTier,
      ageRange,
      locationContext,
      situation,
      trigger: stats.trigger || null,
      mindset: stats.mindset || null,
      device: stats.device || null,
      decisionWindow: null,         // not present in card preview; filled from modal or LLM
      primaryServiceIds: [],        // requires cross-reference with targetServices (post-extraction)
      weightingHint: inferWeighting(tier, subTier),
      fullProfileNotes: null        // filled from modal extraction below
    });
  });

  return personas;
}

/**
 * Inference table for weightingHint when the A.R.C. does not provide explicit weights.
 * Matches the table documented in docs/SCHEMAS.md.
 */
function inferWeighting(tier, subTier) {
  const t = (tier || '').toLowerCase();
  const s = (subTier || '').toLowerCase();
  if (t === 'primary' && s.includes('highest value')) return 0.25;
  if (t === 'primary' && s.includes('growth')) return 0.15;
  if (t === 'primary') return 0.20;
  if (t === 'secondary' && s.includes('highest ltv')) return 0.10;
  if (t === 'secondary' && s.includes('emergency')) return 0.15;
  if (t === 'secondary') return 0.10;
  return null;
}

/* ─────────────────────────────────────────────────────────────────
 * Persona modals (full profile) — extends the card data with richer fields
 * ───────────────────────────────────────────────────────────────── */

function enrichPersonasFromModals($, personas) {
  personas.forEach((persona, idx) => {
    const $modal = $(`#${persona.id.toLowerCase()}`).first();
    if (!$modal.length) return;

    // Modal title can override the card title with a richer label
    // (e.g., card shows real name "Sarah Thornton", modal shows archetype "The Safety-First Suburban Family")
    const modalTitle = $modal.find('.m-title').first().text().trim();
    const modalRole = $modal.find('.m-role').first().text().trim();

    // Collect every m-section into a labeled object
    const sections = {};
    $modal.find('.m-section').each((_, sec) => {
      const $sec = $(sec);
      const title = $sec.find('.m-section-title').first().text().trim();
      if (!title) return;
      sections[title.toLowerCase()] = $sec;
    });

    // Demographics — extract labeled fields
    const demographics = {};
    if (sections.demographics) {
      sections.demographics.find('.m-demo').each((_, d) => {
        const $d = $(d);
        const label = $d.find('strong').first().text().trim().replace(/:$/, '').toLowerCase();
        const text = $d.text().trim();
        const value = text.substring(text.indexOf(':') + 1).trim();
        if (label) demographics[label] = value;
      });
    }

    // Customer journey — sometimes 3 stages, sometimes 4 or 5
    const journeyStages = [];
    if (sections['customer journey']) {
      sections['customer journey'].find('.m-journey-step').each((stepIdx, step) => {
        const $step = $(step);
        const name = $step.find('.m-journey-label').first().text().trim();
        const description = $step.find('.m-journey-desc').first().text().trim();
        if (name) journeyStages.push({ step: stepIdx + 1, name, description });
      });
    }

    // Key search terms
    const searchTerms = [];
    if (sections['key search terms']) {
      sections['key search terms'].find('.m-search-tag').each((_, t) => {
        searchTerms.push($(t).text().trim());
      });
    }

    // Bundle the rich modal data into fullProfileNotes as structured JSON string
    // The downstream LLM extractor and Generation layer parse this for messaging.
    persona.fullProfileNotes = JSON.stringify({
      modalTitle,
      modalRole,
      demographics,
      psychographics: extractLabeledItems($, sections.psychographics, '.m-psycho-item', '.m-psycho-label', '.m-psycho-val'),
      onlineBehavior: extractBehaviorList($, sections['online behavior']),
      journeyStages,
      keySearchTerms: searchTerms
    });

    // If the card lacked a decisionWindow but it can be inferred from journey, leave null
    // — LLM extractor handles this fallback.
  });

  return personas;
}

function extractLabeledItems($, $section, itemSelector, labelSelector, valueSelector) {
  if (!$section || !$section.length) return {};
  const result = {};
  $section.find(itemSelector).each((_, item) => {
    const $item = $(item);
    const label = $item.find(labelSelector).first().text().trim().toLowerCase();
    const value = $item.find(valueSelector).first().text().trim();
    if (label) result[label] = value;
  });
  return result;
}

function extractBehaviorList($, $section) {
  if (!$section || !$section.length) return [];
  const behaviors = [];
  $section.find('.m-behavior').each((_, b) => {
    const $b = $(b);
    const iconClasses = $b.find('.m-behavior-icon').attr('class') || '';
    const channel = iconClasses.replace('m-behavior-icon', '').trim();
    const text = $b.find('.m-behavior-text').first().text().trim();
    behaviors.push({ channel, text });
  });
  return behaviors;
}

/* ─────────────────────────────────────────────────────────────────
 * Competitors (Competitive panel — s7)
 *
 * IMPORTANT: The first .comp-name entry is always the partner themselves
 * (their own benchmark row). Drop the first entry; remaining entries are
 * actual competitors.
 * ───────────────────────────────────────────────────────────────── */

function extractCompetitors($) {
  const $panel = $('#panel-s7');
  if (!$panel.length) return [];

  const allCompNames = [];
  $panel.find('.comp-name').each((_, el) => {
    allCompNames.push($(el));
  });

  if (allCompNames.length <= 1) return [];

  // Drop first (partner's own row), keep the rest as competitors
  const competitors = [];
  for (let i = 1; i < allCompNames.length; i++) {
    const $name = allCompNames[i];
    const nameText = $name.text().trim();

    // Names sometimes carry parenthetical notes inline:
    // e.g., "A1 Plus Electrical (LSA #1)"
    let cleanName = nameText;
    let inlineNote = null;
    const parenMatch = nameText.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (parenMatch) {
      cleanName = parenMatch[1].trim();
      inlineNote = parenMatch[2].trim();
    }

    // Look for the parent .comp-row or .competitor element to find associated stats
    const $row = $name.closest('[class*="comp"]').first();
    const stats = extractCompetitorStats($, $row);

    competitors.push({
      name: cleanName,
      url: null,
      domainRating: stats.domainRating,
      backlinks: stats.backlinks,
      referringDomains: stats.referringDomains,
      notes: inlineNote,
      type: null
    });
  }

  return competitors;
}

function extractCompetitorStats($, $row) {
  const result = { domainRating: null, backlinks: null, referringDomains: null };
  if (!$row.length) return result;

  // The pattern in the Kirchner sample: .comp-stat-val + .comp-stat-label adjacent.
  // Walk the row looking for label/value pairs.
  const statLabels = [];
  const statValues = [];
  $row.find('.comp-stat-val').each((_, v) => statValues.push($(v).text().trim()));
  $row.find('.comp-stat-label').each((_, l) => statLabels.push($(l).text().trim().toLowerCase()));

  for (let i = 0; i < statLabels.length && i < statValues.length; i++) {
    const label = statLabels[i];
    const value = parseInt(statValues[i], 10);
    if (isNaN(value)) continue;
    if (label.includes('domain rating')) result.domainRating = value;
    else if (label.includes('backlink')) result.backlinks = value;
    else if (label.includes('ref') && label.includes('domain')) result.referringDomains = value;
  }

  return result;
}

/* ─────────────────────────────────────────────────────────────────
 * AI Visibility — AVS score
 *
 * Two known display patterns:
 *   1) <div class="ai-hero-score">38</div>  (3 of 4 sampled A.R.C.s)
 *   2) <svg class="gauge">...<div>16</div>... (Kirchner-style gauge)
 *
 * Both produce a numeric 0-100 value. The parser tries pattern 1 first.
 * ───────────────────────────────────────────────────────────────── */

function extractAvs($) {
  const $panel = $('#panel-s5');
  if (!$panel.length) return null;

  // Pattern 1: .ai-hero-score
  const heroScore = $panel.find('.ai-hero-score').first().text().trim();
  if (heroScore) {
    const n = parseInt(heroScore, 10);
    if (!isNaN(n) && n >= 0 && n <= 100) return n;
  }

  // Pattern 2: gauge with score inside
  const $gauge = $panel.find('.gauge').first();
  if ($gauge.length) {
    // The score is typically rendered in the first numeric-only div near the gauge
    const $gaugeContainer = $gauge.closest('.speed-card, .gauge-container, div').first();
    const candidate = $gaugeContainer.find('div').filter((_, el) => {
      const t = $(el).text().trim();
      return /^\d{1,3}$/.test(t);
    }).first().text().trim();
    if (candidate) {
      const n = parseInt(candidate, 10);
      if (!isNaN(n) && n >= 0 && n <= 100) return n;
    }
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────────
 * Decision drivers — ranked factors that win or lose the booking
 * ───────────────────────────────────────────────────────────────── */

function extractDecisionDrivers($) {
  const drivers = [];
  $('.driver').each((_, el) => {
    const $d = $(el);
    const rank = parseInt($d.find('.driver-rank').first().text().trim(), 10);
    const title = $d.find('.driver-title').first().text().trim();
    const description = $d.find('.driver-desc').first().text().trim();
    if (!isNaN(rank) && title) {
      drivers.push({ rank, title, description: description || null });
    }
  });
  return drivers;
}

/* ─────────────────────────────────────────────────────────────────
 * Channel map — per-channel priority and usage
 * ───────────────────────────────────────────────────────────────── */

function extractChannelMap($) {
  const channels = [];
  const validPriorities = new Set(['Critical', 'High', 'Rising', 'Supporting', 'Low']);

  $('.channel-row').each((_, el) => {
    const $row = $(el);
    const channel = $row.find('.channel-name').first().text().trim();
    const usageNotes = $row.find('.channel-use').first().text().trim();
    const rawPriority = $row.find('.channel-priority').first().text().trim();

    // Priority may include nuance like "Low (high for Carla)" — split base + notes
    let priority = rawPriority;
    let priorityNotes = null;
    const parenMatch = rawPriority.match(/^(\w+)\s*\(([^)]+)\)$/);
    if (parenMatch) {
      priority = parenMatch[1];
      priorityNotes = parenMatch[2];
    }
    // Map common synonyms / drop trailing words
    priority = priority.split(/\s+/)[0];
    if (!validPriorities.has(priority)) priority = 'Supporting';

    if (channel) {
      channels.push({ channel, priority, priorityNotes, usageNotes: usageNotes || null });
    }
  });

  return channels;
}

/* ─────────────────────────────────────────────────────────────────
 * Tab inventory — which panels exist in the document
 *
 * Used by the orchestrator to know which sections to delegate to LLM
 * extraction for prose-heavy data the regex extractors don't fully cover.
 * ───────────────────────────────────────────────────────────────── */

function extractPanelInventory($) {
  const panels = [];
  $('[id^="panel-"]').each((_, el) => {
    panels.push($(el).attr('id'));
  });
  return panels;
}

/* ─────────────────────────────────────────────────────────────────
 * Main entry — extract everything deterministic
 * ───────────────────────────────────────────────────────────────── */

function extractAll(html) {
  const $ = cheerio.load(html);

  const businessIdentity = extractBusinessIdentity($);
  let personas = extractPersonaCards($);
  personas = enrichPersonasFromModals($, personas);
  const competitors = extractCompetitors($);
  const avs = extractAvs($);
  const decisionDrivers = extractDecisionDrivers($);
  const channelMap = extractChannelMap($);
  const panelInventory = extractPanelInventory($);

  return {
    businessIdentity,
    personas,
    competitors,
    avs,
    decisionDrivers,
    channelMap,
    panelInventory,
    // Fields that require LLM extraction or downstream layer enrichment:
    needsLlm: {
      vertical: businessIdentity.vertical === null,
      yearsOperating: true,
      tagline: true,
      founderNarrative: true,
      targetServices: true,
      targetLocations: true,
      painPoints: true,
      roadmap: true,
      buyingJourney: true,
      perPlatformAi: true
    }
  };
}

module.exports = {
  extractAll,
  extractBusinessIdentity,
  extractPersonaCards,
  enrichPersonasFromModals,
  extractCompetitors,
  extractAvs,
  extractDecisionDrivers,
  extractChannelMap,
  extractPanelInventory,
  inferWeighting
};
