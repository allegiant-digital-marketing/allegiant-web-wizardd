#!/usr/bin/env node
/**
 * Dump parsed output of every A.R.C. fixture to disk for reference.
 * Used to inspect what the parser actually produces and to seed examples.
 *
 * Run: node tests/parser/dump-parsed.js
 * Output: tests/parser/parsed-output/{fixture}.json
 */

const fs = require('fs');
const path = require('path');
const { parseArcHtml } = require('../../src/layers/1-ingestion');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const OUTPUT_DIR = path.join(__dirname, 'parsed-output');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const FIXTURES = [
  { file: 'kirchner.html',     url: 'https://kirchner-arc-report.netlify.app/' },
  { file: 'evolve-cryo.html',  url: 'https://evolve-cryo-wellness-arc-report.netlify.app/' },
  { file: 'tucker-albin.html', url: 'https://tucker-albin-arc.netlify.app/' },
  { file: 'armstrong.html',    url: 'https://armstrong-repair-arc-report.netlify.app/' }
];

async function main() {
  for (const { file, url } of FIXTURES) {
    const inPath = path.join(FIXTURES_DIR, file);
    const outPath = path.join(OUTPUT_DIR, file.replace('.html', '.parsed.json'));
    const html = fs.readFileSync(inPath, 'utf8');
    const result = await parseArcHtml(html, url);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`✓ ${file} → ${path.relative(process.cwd(), outPath)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
