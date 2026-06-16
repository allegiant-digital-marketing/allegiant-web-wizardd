/**
 * LLM response cache — record and replay.
 *
 * Modes (controlled by LLM_CACHE_MODE env var):
 *   - 'replay' (default): always use cached fixtures. Throws if a fixture is missing.
 *   - 'record':           always call the live API, write the response to a fixture
 *                         (overwrites any existing fixture for that prompt hash).
 *   - 'live':             always call the live API, do NOT write fixtures (used by
 *                         npm run test:live for occasional live-verification runs).
 *   - 'fallback':         try replay first, fall through to live API if no fixture.
 *
 * Cache key = SHA-256 of {system + user + model + temperature}, truncated to 16 chars.
 * Fixture path = tests/parser/llm-fixtures/{taskName}-{key}.json
 *
 * Why record-and-replay:
 *   - Tests stay fast (replay is O(file read), no network).
 *   - Tests stay free (zero API spend during dev iteration).
 *   - Tests stay deterministic (Claude has temperature-controlled non-determinism;
 *     replay eliminates flake).
 *   - Live-verification stays available via opt-in mode.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { complete: liveComplete } = require('./claude-client');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'tests', 'parser', 'llm-fixtures');
const VALID_MODES = ['replay', 'record', 'live', 'fallback'];

function getMode() {
  const m = (process.env.LLM_CACHE_MODE || 'replay').toLowerCase();
  if (!VALID_MODES.includes(m)) {
    throw new Error(`Invalid LLM_CACHE_MODE: '${m}'. Must be one of ${VALID_MODES.join(', ')}`);
  }
  return m;
}

function hashPrompt(prompt, options) {
  const h = crypto.createHash('sha256');
  h.update(prompt.system || '');
  h.update('|||');
  h.update(prompt.user || '');
  h.update('|||');
  h.update(options.model || 'default');
  h.update('|||');
  h.update(String(options.temperature ?? 0));
  return h.digest('hex').substring(0, 16);
}

function fixturePath(taskName, key) {
  if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  // Make taskName safe for filesystem
  const safeName = (taskName || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(FIXTURES_DIR, `${safeName}-${key}.json`);
}

function readFixture(filepath) {
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeFixture(filepath, payload) {
  // Defensive: ensure parent directory exists even if FIXTURES_DIR was deleted
  // between module load and this write call.
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const json = JSON.stringify(payload, null, 2);
  const buf = Buffer.from(json, 'utf8');

  // Use explicit handle management with fsync to FORCE the OS to flush
  // the write to disk before we proceed. The high-level fs.writeFileSync
  // does not always do this, and on Node v24 + Anthropic SDK we have
  // observed writes returning without the file being visible to
  // subsequent fs.existsSync calls.
  //
  // openSync(w) → writeSync(buf) → fsyncSync(handle) → closeSync(handle)
  // is the bulletproof sequence.
  let fd;
  try {
    fd = fs.openSync(filepath, 'w');
    let written = 0;
    while (written < buf.length) {
      written += fs.writeSync(fd, buf, written, buf.length - written);
    }
    fs.fsyncSync(fd);
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (_) { /* already closed or error */ }
    }
  }

  // Verify the write took effect on disk. Retry with short delays in case
  // there's a filesystem cache propagation race we haven't accounted for.
  // After 3 attempts (≈150ms total), we conclude the write genuinely failed.
  let visible = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (fs.existsSync(filepath)) {
      try {
        const stat = fs.statSync(filepath);
        if (stat.size === buf.length) {
          visible = true;
          break;
        }
      } catch (_) { /* statSync threw — file disappeared between existsSync and statSync */ }
    }
    // Tiny busy-wait so we don't yield the event loop to whoever is doing
    // the interfering. (Using setTimeout would yield to microtasks that
    // may BE the cause of the discrepancy.)
    const wait = Date.now() + 50;
    while (Date.now() < wait) { /* busy wait */ }
  }

  if (!visible) {
    throw new Error(
      `Fixture write to ${filepath} returned without error and fsync completed, ` +
      `but the file is not visible on disk after 3 verification attempts (~150ms). ` +
      `This indicates a filesystem driver or security software interaction we cannot work around in user-space. ` +
      `Try (1) downgrading to Node v22 LTS, (2) excluding the project folder from any antivirus, ` +
      `or (3) running PowerShell as Administrator.`
    );
  }

  // Light progress logging in record mode so the operator can watch fixtures land.
  if (getMode() === 'record' || getMode() === 'fallback') {
    const rel = path.relative(process.cwd(), filepath);
    process.stderr.write(`  wrote fixture: ${rel}\n`);
  }
}

/**
 * Cached LLM completion. Same signature as claude-client.complete().
 *
 * @param {{system: string, user: string}} prompt
 * @param {object} [options]
 * @returns {Promise<{data, raw, model, usage, _cached?: boolean}>}
 */
async function cachedComplete(prompt, options = {}) {
  const mode = getMode();
  const taskName = options.taskName || 'unknown';
  const key = hashPrompt(prompt, options);
  const fp = fixturePath(taskName, key);

  if (mode === 'replay') {
    const cached = readFixture(fp);
    if (cached) return { ...cached, _cached: true };
    throw new Error(
      `No fixture for task '${taskName}' (hash ${key}) and LLM_CACHE_MODE=replay. ` +
      `Run with LLM_CACHE_MODE=record to capture this fixture against the live API. ` +
      `Expected path: ${path.relative(process.cwd(), fp)}`
    );
  }

  if (mode === 'fallback') {
    const cached = readFixture(fp);
    if (cached) return { ...cached, _cached: true };
    // Fall through to live
  }

  // record or live or fallback-miss: call the live API
  const result = await liveComplete(prompt, options);

  if (mode === 'record' || mode === 'fallback') {
    writeFixture(fp, {
      data: result.data,
      raw: result.raw,
      model: result.model,
      usage: result.usage,
      _meta: {
        taskName,
        key,
        capturedAt: new Date().toISOString()
      }
    });
  }

  return { ...result, _cached: false };
}

/**
 * Inspection helper — list all currently-recorded fixtures.
 */
function listFixtures() {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(FIXTURES_DIR, f));
}

module.exports = {
  cachedComplete,
  listFixtures,
  // exposed for testing
  hashPrompt,
  getMode,
  FIXTURES_DIR
};
