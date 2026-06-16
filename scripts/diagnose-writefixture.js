#!/usr/bin/env node
/**
 * Targeted diagnostic: call writeFixture directly from llm-cache,
 * with a fake LLM response, and report what happens.
 *
 * If writeFixture works here but fails during recording, the bug is in
 * how the test harness calls it (timing, module load order, something else).
 * If writeFixture fails here too, we've reproduced the bug without
 * spending any API credits.
 *
 * Run: node scripts/diagnose-writefixture.js
 */

const fs = require('fs');
const path = require('path');

// Force record mode so we hit the same code path as the recording test
process.env.LLM_CACHE_MODE = 'record';

console.log('================================================================');
console.log('Web WIZARDD — writeFixture isolation diagnostic');
console.log('================================================================');
console.log('Node version:    ', process.version);
console.log('Platform:        ', process.platform);
console.log('CWD:             ', process.cwd());
console.log('LLM_CACHE_MODE:  ', process.env.LLM_CACHE_MODE);

// Load llm-cache. The cachedComplete function will call writeFixture,
// but we'll need to monkey-patch claude-client to avoid hitting the API.
//
// Approach: require claude-client first, then replace its `complete` with
// a fake that returns a hardcoded response. Then require llm-cache, which
// closures over the (now-faked) claude-client.

const claudeClient = require('../src/shared/claude-client');
const originalComplete = claudeClient.complete;
claudeClient.complete = async function fakeComplete(prompt, options) {
  console.log('  [fake claude-client.complete called for task:', options.taskName, ']');
  return {
    data: { vertical: 'electrician', subVertical: null, zone: null, yearsOperating: 40, tagline: null },
    raw: '{"vertical": "electrician", "subVertical": null, "zone": null, "yearsOperating": 40, "tagline": null}',
    model: 'claude-sonnet-4-6-fake',
    usage: { input_tokens: 100, output_tokens: 50 }
  };
};

const cache = require('../src/shared/llm-cache');
console.log('FIXTURES_DIR:    ', cache.FIXTURES_DIR);
console.log('Dir exists:      ', fs.existsSync(cache.FIXTURES_DIR));

console.log('\n--- Test: cachedComplete with fake claude-client (record mode) ---');
(async () => {
  const prompt = {
    system: 'fake system',
    user: 'fake user prompt for diagnostic'
  };
  try {
    const result = await cache.cachedComplete(prompt, { taskName: 'diagnostic-task' });
    console.log('cachedComplete returned successfully.');
    console.log('Result _cached:', result._cached);

    // Now check whether the fixture file actually exists on disk
    console.log('\n--- Directory listing immediately after ---');
    const files = fs.readdirSync(cache.FIXTURES_DIR);
    console.log('Files in', cache.FIXTURES_DIR + ':');
    for (const f of files) {
      const stat = fs.statSync(path.join(cache.FIXTURES_DIR, f));
      console.log('  -', f, '(' + stat.size, 'bytes)');
    }

    if (files.length === 0) {
      console.log('  (none)');
      console.log('\n!!! cachedComplete returned successfully but no files exist !!!');
      console.log('!!! This means writeFixture\'s existsSync check is wrong, OR something is deleting writes !!!');
    }

    // Cleanup
    for (const f of files) {
      if (f.startsWith('diagnostic-task-')) {
        fs.unlinkSync(path.join(cache.FIXTURES_DIR, f));
        console.log('Cleaned up:', f);
      }
    }
  } catch (e) {
    console.log('cachedComplete THREW:', e.message);
    console.log('\n--- Directory listing after throw ---');
    try {
      const files = fs.readdirSync(cache.FIXTURES_DIR);
      console.log('Files in dir:', files.length);
      for (const f of files) console.log('  -', f);
      // Cleanup
      for (const f of files) {
        if (f.startsWith('diagnostic-task-')) {
          fs.unlinkSync(path.join(cache.FIXTURES_DIR, f));
          console.log('Cleaned up:', f);
        }
      }
    } catch (err2) {
      console.log('readdir failed:', err2.message);
    }
  }

  console.log('\n================================================================');
  console.log('Diagnostic complete.');
  console.log('================================================================');
})();
