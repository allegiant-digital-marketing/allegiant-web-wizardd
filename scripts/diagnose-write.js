#!/usr/bin/env node
/**
 * Diagnose the writeFileSync vs existsSync inconsistency seen during
 * LLM fixture recording. Does NOT call the Claude API — zero cost.
 *
 * What it tests:
 *   1. Can we writeFileSync a small file and immediately read it back?
 *   2. Can we writeFileSync a fixture-sized payload and immediately read it back?
 *   3. After writes, does Get-ChildItem (PowerShell-equivalent) see the files?
 *   4. Does node see the files via fs.readdirSync?
 *
 * Run: node scripts/diagnose-write.js
 * (or: node tests/parser/diagnose-write.js if you put it there)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'parser', 'llm-fixtures');

console.log('================================================================');
console.log('Web WIZARDD — write diagnostic');
console.log('================================================================');
console.log('Node version:    ', process.version);
console.log('Platform:        ', process.platform, os.release());
console.log('CWD:             ', process.cwd());
console.log('Script __dirname:', __dirname);
console.log('Target dir:      ', FIXTURES_DIR);
console.log('Dir exists:      ', fs.existsSync(FIXTURES_DIR));

// Test 1: tiny string write + immediate read
console.log('\n--- Test 1: tiny string ---');
const test1Path = path.join(FIXTURES_DIR, 'diag-test-1.json');
try {
  fs.writeFileSync(test1Path, '{"ok":true}');
  console.log('writeFileSync: returned without error');
  console.log('existsSync immediately after:', fs.existsSync(test1Path));
  // Read back the content
  if (fs.existsSync(test1Path)) {
    const content = fs.readFileSync(test1Path, 'utf8');
    console.log('readFileSync got:', content);
  }
} catch (e) {
  console.log('writeFileSync THREW:', e.message);
}

// Test 2: fixture-sized payload (~3KB) like the real fixtures
console.log('\n--- Test 2: ~3KB payload ---');
const test2Path = path.join(FIXTURES_DIR, 'diag-test-2.json');
const bigPayload = JSON.stringify({
  data: { vertical: 'electrician', personas: Array(6).fill({ name: 'test', tier: 'primary' }) },
  raw: 'a'.repeat(2000),
  model: 'claude-sonnet-4-6',
  usage: { input_tokens: 1000, output_tokens: 500 },
  _meta: { taskName: 'diag', key: 'abc123', capturedAt: new Date().toISOString() }
}, null, 2);
console.log('Payload size:', bigPayload.length, 'bytes');
try {
  fs.writeFileSync(test2Path, bigPayload);
  console.log('writeFileSync: returned without error');
  console.log('existsSync immediately after:', fs.existsSync(test2Path));
  if (fs.existsSync(test2Path)) {
    const stat = fs.statSync(test2Path);
    console.log('File size on disk:', stat.size, 'bytes (expected', bigPayload.length, ')');
  }
} catch (e) {
  console.log('writeFileSync THREW:', e.message);
}

// Test 3: list directory contents from Node
console.log('\n--- Test 3: Node fs.readdirSync ---');
try {
  const files = fs.readdirSync(FIXTURES_DIR);
  console.log('Node sees', files.length, 'file(s) in dir:');
  for (const f of files) console.log('  -', f);
} catch (e) {
  console.log('readdirSync THREW:', e.message);
}

// Cleanup
console.log('\n--- Cleanup ---');
for (const p of [test1Path, test2Path]) {
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); console.log('Removed:', path.basename(p)); }
    catch (e) { console.log('Could not remove', p, ':', e.message); }
  } else {
    console.log('Not present, nothing to remove:', path.basename(p));
  }
}

console.log('\n================================================================');
console.log('Diagnostic complete.');
console.log('================================================================');
