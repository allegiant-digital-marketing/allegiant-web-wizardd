# Recording LLM Fixtures

Web WIZARDD uses a **record-and-replay** pattern for tests that depend on the Claude API. Real API responses are captured once into `tests/parser/llm-fixtures/`, committed to the repo, and replayed on every test run. This keeps tests fast, free, and deterministic during development while preserving the ability to verify against the live API on demand.

This document walks through the recording workflow.

---

## When you need to record

You need to (re-)record LLM fixtures in any of these cases:

1. **First setup.** Fresh clone, no fixtures yet. Recording captures the baseline.
2. **New A.R.C. added.** Adding a new partner A.R.C. fixture HTML means recording fresh LLM responses against it.
3. **Prompt change.** Editing any prompt builder in `src/layers/1-ingestion/llm-extractor.js` changes the hash → the cache misses → recording captures the new responses.
4. **Schema change that affects mergeResult or validateResult.** Same reasoning.
5. **Model upgrade.** Switching to a newer Claude model via `WIZARDD_LLM_MODEL` invalidates existing fixtures.

If none of these apply, the existing fixtures are correct and you just run `npm test` normally.

---

## One-time setup

### Step 1 — Set your Anthropic API key

Copy `.env.example` to `.env` (the `.env` file is gitignored, so it stays local):

```bash
cp .env.example .env
```

Open `.env` in your editor. Replace the placeholder with your real key from `console.anthropic.com/settings/keys`:

```
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-REAL-KEY-HERE
```

Save and close. The `.env` file is gitignored; it will never be committed.

### Step 2 — Verify the key works

Replay-mode tests do not call the API. To confirm your key is wired correctly, run a single live call first:

```bash
npm run test:parser:live
```

This calls the API but does not write fixtures. Expected output: completeness scores in the 90s for all four A.R.C.s, with LLM tasks succeeding. If you see auth errors or rate limit errors, your key isn't set correctly — re-check `.env`.

---

## Recording

To record fixtures for all four A.R.C.s:

```bash
npm run test:parser:record
```

This runs the full test suite in record mode. Every LLM task call hits the live API and writes the response to `tests/parser/llm-fixtures/{taskName}-{hash}.json`. With 4 A.R.C.s × 9 tasks, you'll capture 36 fixtures.

**Expected cost.** Roughly $0.50 to $1.00 in API spend for a full recording run. Each task is ~2-5K input tokens + 500-1500 output tokens at Sonnet pricing.

**Expected duration.** 2-4 minutes total. Tasks run sequentially per fixture.

After recording completes, you should see:

- New files in `tests/parser/llm-fixtures/` (36 files for a full run)
- Test output showing completeness scores in the 90s for every fixture
- LLM task succeeded count: 9/9 per fixture

---

## Verifying the recordings

Run replay mode to confirm the recorded fixtures replay correctly:

```bash
npm test
```

Expected: all four parser tests pass, all 9 LLM tasks succeed per fixture, completeness scores match what you saw in record mode. **No API spend** — fixtures only.

If replay mode fails after recording, something went wrong during capture. Check the fixture files in `tests/parser/llm-fixtures/` — they should be JSON objects with `data`, `raw`, `model`, `usage`, and `_meta` keys.

---

## Committing fixtures to git

Fixtures are committed to the repo. They're not gitignored — they're how the project ships passing tests.

```bash
git add tests/parser/llm-fixtures/
git commit -m "Record LLM fixtures for A.R.C. parser"
git push origin main
```

Future contributors (or future you on a different machine) get the fixtures via `git pull` and can immediately run `npm test` without needing an API key.

---

## When fixtures fall out of sync

If you change a prompt and forget to re-record, replay mode will fail loudly with a message like:

```
No fixture for task 'target-services' (hash 5dabb09016749f9d) and LLM_CACHE_MODE=replay.
Run with LLM_CACHE_MODE=record to capture this fixture against the live API.
Expected path: tests/parser/llm-fixtures/target-services-5dabb09016749f9d.json
```

The fix is always the same: run `npm run test:parser:record` and commit the new fixtures. Old fixtures with stale hashes can be deleted — `git clean -f tests/parser/llm-fixtures/` after recording will remove anything not referenced.

---

## Alternative modes

For occasional cases beyond record/replay:

```bash
# Try cached, fall through to live API if no fixture exists. Useful when adding
# a single new A.R.C. — you record only the missing fixtures without re-running
# everything.
LLM_CACHE_MODE=fallback npm run test:parser

# Always hit live API, never read or write fixtures. Use this to spot-check
# whether the live API still produces output that matches the cached fixtures.
npm run test:parser:live
```

---

## Cost discipline

To keep API spend predictable:

- **Default to `npm test`.** Replay mode is the daily development command. Zero cost.
- **Only record when actually needed** (see the trigger list at the top).
- **Use `test:live` sparingly.** It's for spot-checks, not routine development.
- **Sanity-check before recording.** A full record run is roughly $1; not catastrophic, but worth being intentional about.
