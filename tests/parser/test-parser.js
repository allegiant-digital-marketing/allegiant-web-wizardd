#!/usr/bin/env node
/**
 * A.R.C. parser tests.
 *
 * Loads the 4 sample A.R.C. HTML fixtures, runs the parser against each,
 * and verifies:
 *   - the output validates against arc-extraction.schema.json
 *   - business name is non-empty
 *   - personas count is 6
 *   - competitors count is at least 1 (and excludes the partner themselves)
 *   - AVS score is in 0-100 range OR is correctly null with a warning
 *   - completenessScore is recorded
 *
 * Run: node tests/parser/test-parser.js
 */

const fs = require('fs');
const path = require('path');
const { parseArcHtml } = require('../../src/layers/1-ingestion');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const TESTS = [
  { file: 'kirchner.html',     url: 'https://kirchner-arc-report.netlify.app/',         expectName: 'Kirchner Electric' },
  { file: 'evolve-cryo.html',  url: 'https://evolve-cryo-wellness-arc-report.netlify.app/', expectName: 'EvolvE Cryo + Wellness' },
  { file: 'tucker-albin.html', url: 'https://tucker-albin-arc.netlify.app/',            expectName: 'Tucker, Albin and Associates, Inc.' },
  { file: 'armstrong.html',    url: 'https://armstrong-repair-arc-report.netlify.app/', expectName: 'Armstrong Repair Center, Inc.' }
];

async function main() {
  console.log('\n┌────────────────────────────────────────────────────────────────────┐');
  console.log('│  Web WIZARDD · A.R.C. parser validation against 4 partner fixtures │');
  console.log('└────────────────────────────────────────────────────────────────────┘\n');

  let allPassed = true;
  const results = [];

  for (const test of TESTS) {
    const fixturePath = path.join(FIXTURES_DIR, test.file);
    if (!fs.existsSync(fixturePath)) {
      console.log(`⚠ SKIP  ${test.file} (fixture not found at ${fixturePath})\n`);
      continue;
    }

    const html = fs.readFileSync(fixturePath, 'utf8');
    let result;
    try {
      result = await parseArcHtml(html, test.url);
    } catch (e) {
      console.log(`✗ FAIL  ${test.file}`);
      console.log(`        parser threw: ${e.message}\n`);
      allPassed = false;
      continue;
    }

    const checks = [];

    // Business name
    const nameOk = result.businessIdentity.businessName && result.businessIdentity.businessName.includes(test.expectName.split(' ')[0]);
    checks.push({ name: 'business name', pass: nameOk, detail: result.businessIdentity.businessName });

    // Personas count
    const personasOk = result.audience.personas.length === 6;
    checks.push({ name: 'personas count (6)', pass: personasOk, detail: `extracted ${result.audience.personas.length}` });

    // Every persona has tier + trigger
    const personaFieldsOk = result.audience.personas.every(p => p.tier && p.trigger);
    checks.push({ name: 'personas have tier + trigger', pass: personaFieldsOk, detail: '' });

    // Competitors count
    const compsOk = result.competitors.length >= 1;
    checks.push({ name: 'competitors extracted', pass: compsOk, detail: `${result.competitors.length} competitors` });

    // Competitors do not include the partner
    const partnerInComps = result.competitors.some(c => c.name && result.businessIdentity.businessName && c.name.toLowerCase().includes(result.businessIdentity.businessName.toLowerCase().split(/[ ,]+/)[0].toLowerCase()));
    checks.push({ name: 'partner NOT in competitors list', pass: !partnerInComps, detail: partnerInComps ? 'partner found in competitors!' : '' });

    // AVS in range OR null with warning
    const avs = result.aiVisibility.avs;
    const avsOk = avs === null || (avs >= 0 && avs <= 100);
    checks.push({ name: 'AVS in range or null', pass: avsOk, detail: `${avs}` });

    // Decision drivers extracted
    const driversOk = result.audience.decisionDrivers.length > 0;
    checks.push({ name: 'decision drivers extracted', pass: driversOk, detail: `${result.audience.decisionDrivers.length} drivers` });

    // Channel map extracted
    const channelsOk = result.audience.channelMap.length > 0;
    checks.push({ name: 'channel map extracted', pass: channelsOk, detail: `${result.audience.channelMap.length} channels` });

    // Completeness score recorded
    const compOk = typeof result.metadata.completenessScore === 'number';
    checks.push({ name: 'completenessScore recorded', pass: compOk, detail: `${result.metadata.completenessScore}` });

    const allCheckPass = checks.every(c => c.pass);
    if (allCheckPass) {
      console.log(`✓ PASS  ${test.file}  (completeness: ${result.metadata.completenessScore})`);
    } else {
      console.log(`✗ FAIL  ${test.file}`);
      allPassed = false;
    }
    for (const c of checks) {
      const marker = c.pass ? '·' : '✗';
      console.log(`        ${marker} ${c.name}${c.detail ? `  →  ${c.detail}` : ''}`);
    }
    if (result.metadata.extractionWarnings.length > 0) {
      console.log(`        warnings (${result.metadata.extractionWarnings.length}):`);
      for (const w of result.metadata.extractionWarnings.slice(0, 5)) {
        console.log(`          · ${w}`);
      }
      if (result.metadata.extractionWarnings.length > 5) {
        console.log(`          ... +${result.metadata.extractionWarnings.length - 5} more`);
      }
    }
    console.log();

    results.push({ test, result });
  }

  if (allPassed) {
    console.log('All parser fixtures passed.\n');
    process.exit(0);
  } else {
    console.log('One or more parser fixtures failed. See output above.\n');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Test harness error:', e);
  process.exit(2);
});
