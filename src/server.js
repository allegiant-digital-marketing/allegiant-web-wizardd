/**
 * Web WIZARDD — Ingestion UI server.
 *
 * Hosts the builder-facing review interface at http://localhost:3000.
 * Wraps the existing A.R.C. parser (regex + LLM extraction) behind two endpoints:
 *
 *   POST /api/parse  { url }      → fetches A.R.C. HTML, parses, returns normalized record
 *   POST /api/save   { record }   → persists builder-reviewed record to data/reviewed-records/
 *   GET  /api/records             → lists all saved reviewed records
 *   GET  /api/records/:id         → loads one saved reviewed record
 *
 * The builder workflow:
 *   1. Paste A.R.C. URL → click Parse → see normalized output
 *   2. Edit any field inline (copy/layout-shuffle scope, per locked decision 2 from session)
 *   3. Click Save → record persists to data/ for the generator (Phase 2) to pick up later
 *
 * The LLM cache mode is REPLAY by default — if the A.R.C. has been parsed before,
 * cached fixtures are used (free, instant). If it's a new A.R.C., set
 * LLM_CACHE_MODE=fallback when starting the server so misses fall through to live API.
 *
 *   npm start                   → replay mode (cached fixtures only, no API spend)
 *   npm run start:live          → fallback mode (cached when available, live API for misses)
 *
 * SAFETY: This server is local-only (binds to 127.0.0.1). Do NOT expose it on a
 * public interface — it has no auth and could leak partner data and API spend.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const { parseArcHtml, computeFinalCompleteness } = require('./layers/1-ingestion');
const { mergeIntakeIntoRecord } = require('./shared/intake-merge');

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';
const DATA_DIR = path.join(__dirname, '..', 'data', 'reviewed-records');
const UI_DIR = path.join(__dirname, 'ingestion-ui');

// Ensure the data directory exists at startup so saves never fail on first run
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '10mb' }));

// Disable browser caching of the UI assets. This is a local-only dev tool,
// and aggressive browser caching has bitten us during iteration — fixes that
// landed on disk wouldn't show in the browser until a forced Ctrl+Shift+R.
// Setting Cache-Control: no-store ensures every reload pulls the latest HTML,
// CSS, and JS from disk.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

app.use(express.static(UI_DIR));

/* ────────────────────────────────────────────────────────────────────
 * Parse endpoint
 *
 * Fetches the A.R.C. HTML from the provided URL, runs it through the
 * parser (regex + LLM enrichment), and returns the normalized record.
 *
 * Heavy lifting happens here, not in the browser — CORS would block
 * direct netlify.app fetches from a different origin, and we want a
 * single canonical place to handle URL → HTML conversion.
 * ──────────────────────────────────────────────────────────────────── */
app.post('/api/parse', async (req, res) => {
  const { url, intakeJson } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid `url` in request body' });
  }
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return res.status(400).json({ error: 'URL must start with http:// or https://' });
  }
  if (intakeJson != null && (typeof intakeJson !== 'object' || Array.isArray(intakeJson))) {
    return res.status(400).json({ error: 'intakeJson, when provided, must be a single JSON object' });
  }

  try {
    console.log(`[parse] Fetching ${url}`);
    const fetchStart = Date.now();
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Web-WIZARDD-Ingestion/0.1)' }
    });
    if (!response.ok) {
      return res.status(502).json({
        error: `Upstream A.R.C. URL returned ${response.status} ${response.statusText}`
      });
    }
    const html = await response.text();
    const fetchMs = Date.now() - fetchStart;
    console.log(`[parse] Fetched ${html.length} bytes in ${fetchMs}ms — parsing...`);

    const parseStart = Date.now();
    let record = await parseArcHtml(html, url);
    const parseMs = Date.now() - parseStart;
    console.log(`[parse] Parsed in ${parseMs}ms — completeness ${record.metadata.completenessScore}`);

    // ── Intake-JSON failsafe merge (docs/WEB_WIZARDD_UI_PATCH_SPEC.md) ──
    // Parser wins on conflict; intake fills gaps. The parser-only score is
    // preserved as parserCompletenessScore — that number, NOT the merged
    // score, is the first-pass calibration metric per Routing SOP §11.1.
    const parserCompleteness = record.metadata.completenessScore;
    if (intakeJson && Object.keys(intakeJson).length > 0) {
      const parserSnapshot = JSON.parse(JSON.stringify(record));
      const { merged, provenance, skippedMetadata } = mergeIntakeIntoRecord(record, intakeJson);
      merged.metadata.parserCompletenessScore = parserCompleteness;
      merged.metadata.completenessScore = computeFinalCompleteness(merged);
      merged.metadata.mergeSource = 'parser+intake';
      merged.metadata.fieldProvenance = provenance;
      merged.metadata.sources = { parser: parserSnapshot, intake: intakeJson };
      if (skippedMetadata) {
        merged.metadata.extractionWarnings.push(
          'Intake JSON contained a `metadata` key — ignored by design (metadata is parser-owned).'
        );
      }
      console.log(
        `[parse] Intake merge applied — ${Object.keys(provenance).length} field(s) from intake; ` +
        `completeness ${parserCompleteness} → ${merged.metadata.completenessScore}`
      );
      record = merged;
    } else {
      record.metadata.mergeSource = 'parser-only';
    }

    return res.json({
      record,
      timing: { fetchMs, parseMs, totalMs: fetchMs + parseMs }
    });
  } catch (err) {
    console.error('[parse] Error:', err.message);
    return res.status(500).json({
      error: `Parse failed: ${err.message}`,
      hint: err.message.includes('fixture') ?
        'This A.R.C. has not been parsed before. Restart server with: npm run start:live' : null
    });
  }
});

/* ────────────────────────────────────────────────────────────────────
 * Save endpoint
 *
 * Persists a builder-reviewed/edited record to disk. Filename is derived
 * from the partner's business name + ISO date, so saves don't collide
 * even when re-saving the same partner on different days.
 * ──────────────────────────────────────────────────────────────────── */
app.post('/api/save', (req, res) => {
  const { record } = req.body || {};
  if (!record || typeof record !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid `record` in request body' });
  }
  const businessName = (record.businessIdentity && record.businessIdentity.businessName) || 'unknown';
  const safeName = businessName.toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
  const date = new Date().toISOString().substring(0, 10);
  const filename = `${safeName}--${date}.json`;
  const filepath = path.join(DATA_DIR, filename);

  // Annotate with review metadata so we know when the builder approved
  const enriched = {
    ...record,
    metadata: {
      ...(record.metadata || {}),
      builderReview: {
        // Preserve anything the UI already put here (e.g. builder notes) —
        // clobbering this object silently dropped notes prior to this fix.
        ...((record.metadata && record.metadata.builderReview) || {}),
        reviewedAt: new Date().toISOString(),
        savedTo: filename
      }
    }
  };

  try {
    fs.writeFileSync(filepath, JSON.stringify(enriched, null, 2));
    console.log(`[save] Wrote ${filepath} (${(fs.statSync(filepath).size / 1024).toFixed(1)} KB)`);
    return res.json({ ok: true, filename, path: filepath });
  } catch (err) {
    console.error('[save] Write failed:', err.message);
    return res.status(500).json({ error: `Save failed: ${err.message}` });
  }
});

/* ────────────────────────────────────────────────────────────────────
 * Records list/load endpoints
 *
 * Builder can return to a previously saved record and continue editing.
 * Useful when partner review happens asynchronously over multiple sessions.
 * ──────────────────────────────────────────────────────────────────── */
app.get('/api/records', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(DATA_DIR, f));
        return {
          filename: f,
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return res.json({ records: files });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/records/:filename', (req, res) => {
  // Strict filename validation — only allow saved record filenames, not path traversal
  if (!/^[a-z0-9-]+--\d{4}-\d{2}-\d{2}\.json$/.test(req.params.filename)) {
    return res.status(400).json({ error: 'Invalid filename format' });
  }
  const filepath = path.join(DATA_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Record not found' });
  }
  try {
    const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    return res.json({ record: content, filename: req.params.filename });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────────────────────────────────────────
 * Start server
 * ──────────────────────────────────────────────────────────────────── */
app.listen(PORT, HOST, () => {
  const mode = process.env.LLM_CACHE_MODE || 'replay';
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Web WIZARDD — Ingestion UI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`  Open in browser:   http://${HOST}:${PORT}`);
  console.log(`  LLM cache mode:    ${mode}`);
  console.log(`  Records saved to:  ${DATA_DIR}`);
  console.log('');
  console.log('  Press Ctrl+C to stop the server.');
  console.log('');
});
