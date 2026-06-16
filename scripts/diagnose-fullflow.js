#!/usr/bin/env node
/**
 * Full-flow diagnostic — runs the EXACT same code path as
 * `npm run test:parser:record` but with the Anthropic SDK call faked.
 *
 * Zero API spend.
 *
 * If this reproduces the "fixture write returned without error but file does
 * not exist" bug → the bug is in the test harness path (not the SDK).
 * If this does NOT reproduce → the live Anthropic SDK is doing something
 * specific that breaks the writes, and we need to look there.
 *
 * Run: node scripts/diagnose-fullflow.js
 */

const path = require('path');
const fs = require('fs');

// Match the test harness setup exactly
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}
process.env.LLM_CACHE_MODE = 'record';

console.log('================================================================');
console.log('Web WIZARDD — full-flow diagnostic (faked Anthropic SDK)');
console.log('================================================================');
console.log('Node version:    ', process.version);
console.log('CWD:             ', process.cwd());

// Fake the Anthropic SDK BEFORE anything else loads it.
// We need to intercept claude-client's `complete` function.
const claudeClient = require('../src/shared/claude-client');
let fakeCallCount = 0;
claudeClient.complete = async function fakeComplete(prompt, options) {
  fakeCallCount++;
  // Return responses tailored to each task name so validators don't reject
  const taskName = options.taskName;
  const fakeData = {
    'vertical-and-identity': { vertical: 'electrician', subVertical: null, zone: null, yearsOperating: 40, tagline: null },
    'founder-narrative': { founderNarrative: 'Fake founder narrative for diagnostic purposes.' },
    'target-services': { targetServices: [{ name: 'Diagnostic Service', shortName: 'Test', personaIds: ['P1'], priority: 'high', competitiveContext: null }] },
    'target-locations': { targetLocations: [{ name: 'Diagnostic City', tier: 'primary', context: null, parentRegion: null }] },
    'pain-points': { painPoints: ['Diagnostic pain point 1', 'Diagnostic pain point 2'] },
    'roadmap': { roadmap: { phases: [{ phase: 1, title: 'Diagnostic Phase', description: null }], packages: [{ tier: 'A', name: 'Pkg A', services: ['test'], zoneAdjustment: null }] } },
    'buying-journey': { buyingJourney: { stages: [{ step: 1, name: 'Diagnostic stage', description: null, channels: ['Test'] }] } },
    'ai-platform-detail': { citationCount: '2 of 6', platforms: { chatgpt: { cited: true, citationContext: null, score: null }, claude: { cited: false, citationContext: null, score: null }, gemini: { cited: false, citationContext: null, score: null }, perplexity: { cited: false, citationContext: null, score: null }, copilot: { cited: false, citationContext: null, score: null } }, disciplineScores: { aeo: { score: null, notes: null }, geo: { score: null, notes: null }, aiSeo: { score: null, notes: null }, llmSeo: { score: null, notes: null } } },
    'digital-presence-detail': { currentDigitalPresence: { website: { url: null, lcpDesktopSeconds: null, lcpMobileSeconds: null, knownIssues: [] }, reviews: { googleRating: null, googleReviewCount: null, yelp: { verified: null, visibleReviewCount: null, knownIssues: [] }, bbb: { present: null, rating: null, knownIssues: [] } }, social: {}, paidMedia: { googleAds: { active: null, notes: null }, localServiceAds: { present: null, competitorsHoldingSlots: [] } } } }
  };
  return {
    data: fakeData[taskName] || {},
    raw: JSON.stringify(fakeData[taskName] || {}),
    model: 'claude-sonnet-4-6-fake',
    usage: { input_tokens: 100, output_tokens: 50 }
  };
};

// Now load the parser modules — claude-client is already cached so they get the fake
const { parseArcHtml } = require('../src/layers/1-ingestion');

const FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'parser', 'fixtures');
const LLM_FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'parser', 'llm-fixtures');

const TESTS = [
  { file: 'kirchner.html',     url: 'https://kirchner-arc-report.netlify.app/' },
  { file: 'evolve-cryo.html',  url: 'https://evolve-cryo-wellness-arc-report.netlify.app/' },
  { file: 'tucker-albin.html', url: 'https://tucker-albin-arc.netlify.app/' },
  { file: 'armstrong.html',    url: 'https://armstrong-repair-arc-report.netlify.app/' }
];

(async () => {
  console.log('\n--- Running parseArcHtml against all 4 fixtures ---\n');
  let fixturesAfter = 0;
  let llmFailures = 0;
  let llmSuccesses = 0;

  for (const test of TESTS) {
    const fixturePath = path.join(FIXTURES_DIR, test.file);
    if (!fs.existsSync(fixturePath)) {
      console.log('SKIP', test.file, '— not found');
      continue;
    }
    const html = fs.readFileSync(fixturePath, 'utf8');
    try {
      const result = await parseArcHtml(html, test.url);
      // Inspect the LLM warnings to see if any tasks reported failures
      const llmWarnings = result.metadata.extractionWarnings.filter(w =>
        w.includes('LLM task') && w.includes('failed')
      );
      const successSummary = result.metadata.extractionWarnings.find(w => w.startsWith('LLM extraction:'));
      console.log(`${test.file}:`);
      console.log(`  ${successSummary || '(no summary)'}`);
      if (llmWarnings.length > 0) {
        llmFailures += llmWarnings.length;
        console.log(`  ${llmWarnings.length} task failures:`);
        for (const w of llmWarnings.slice(0, 3)) console.log(`    - ${w.substring(0, 150)}...`);
      } else {
        llmSuccesses += 9;
      }
    } catch (e) {
      console.log(`${test.file}: parseArcHtml THREW: ${e.message.substring(0, 200)}`);
    }
  }

  // Final directory count
  console.log('\n--- Final llm-fixtures directory contents ---');
  try {
    const files = fs.readdirSync(LLM_FIXTURES_DIR);
    console.log('File count:', files.length);
    for (const f of files.slice(0, 5)) console.log('  -', f);
    if (files.length > 5) console.log(`  ... + ${files.length - 5} more`);
    fixturesAfter = files.length;
  } catch (e) {
    console.log('readdir error:', e.message);
  }

  console.log('\n--- Summary ---');
  console.log('Fake claude calls made:', fakeCallCount);
  console.log('Expected fixtures:     ', fakeCallCount);
  console.log('Actual fixtures on disk:', fixturesAfter);
  console.log('LLM task failures:     ', llmFailures);
  console.log('LLM task successes:    ', llmSuccesses);

  // Cleanup fixtures we wrote so we don't pollute the repo
  console.log('\n--- Cleanup ---');
  if (fixturesAfter > 0) {
    const files = fs.readdirSync(LLM_FIXTURES_DIR);
    for (const f of files) {
      try { fs.unlinkSync(path.join(LLM_FIXTURES_DIR, f)); }
      catch (_) {}
    }
    console.log('Cleaned up', files.length, 'fixtures');
  }

  console.log('\n================================================================');
  console.log('Diagnostic complete.');
  console.log('================================================================');
})();
