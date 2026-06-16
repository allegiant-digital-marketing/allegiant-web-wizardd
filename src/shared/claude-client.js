/**
 * Anthropic SDK wrapper.
 *
 * Single entry point for every layer that calls Claude. Centralizes:
 *   - API key resolution (from ANTHROPIC_API_KEY env)
 *   - Model selection (default sonnet, override via WIZARDD_LLM_MODEL)
 *   - Retry-with-backoff on transient errors
 *   - JSON-only response parsing (strips markdown fences if model adds them)
 *   - Token usage logging for cost tracking
 *
 * Public API:
 *   complete({ system, user }, options) → Promise<{ data, raw, model, usage }>
 *
 * Throws on:
 *   - Missing API key (with clear remediation message)
 *   - Persistent API errors after retry
 *   - JSON parse failures (with the raw response in the error for debugging)
 */

const path = require('path');

// Lazy-load the SDK to keep this module light if it's required but never called
let _Anthropic = null;
function getSdk() {
  if (!_Anthropic) {
    _Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
  }
  return _Anthropic;
}

const DEFAULT_MODEL = process.env.WIZARDD_LLM_MODEL || 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0;          // structured extraction — minimize variance
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. ' +
      'For local development, create a .env file at the repo root with: ANTHROPIC_API_KEY=sk-ant-... ' +
      'For production, set it in Netlify env vars on wizardd.allegiantdigital.co.'
    );
  }
  const Anthropic = getSdk();
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Call Claude with a structured prompt expecting a JSON response.
 *
 * @param {{system: string, user: string}} prompt — system instruction + user content
 * @param {object} [options]
 * @param {string} [options.model] — override the default model
 * @param {number} [options.maxTokens]
 * @param {number} [options.temperature]
 * @param {string} [options.taskName] — for logging/debugging
 * @returns {Promise<{data: object, raw: string, model: string, usage: object}>}
 */
async function complete(prompt, options = {}) {
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const taskName = options.taskName || 'unknown';

  let lastErr = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const client = getClient();
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }]
      });

      // Extract text from the response content blocks
      const raw = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
        .trim();

      // Strip markdown fences if Claude added them despite instructions
      const cleaned = stripJsonFences(raw);

      let data;
      try {
        data = JSON.parse(cleaned);
      } catch (parseErr) {
        const err = new Error(
          `JSON parse failed for task '${taskName}': ${parseErr.message}. ` +
          `Raw response (first 500 chars): ${cleaned.substring(0, 500)}`
        );
        err.rawResponse = cleaned;
        err.parseError = parseErr;
        throw err;
      }

      return {
        data,
        raw: cleaned,
        model: response.model,
        usage: response.usage
      };
    } catch (err) {
      lastErr = err;
      // JSON parse errors don't retry (deterministic — same input → same failure)
      if (err.parseError) throw err;
      // Auth errors don't retry (no point waiting)
      if (err.status === 401 || err.status === 403) throw err;
      // Other errors back off and retry
      if (attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

function stripJsonFences(text) {
  // Sometimes models wrap JSON in ```json ... ``` even when asked not to.
  // Tolerate it.
  return text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  complete,
  DEFAULT_MODEL,
  // exposed for testing
  stripJsonFences
};
