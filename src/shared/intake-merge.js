/**
 * Intake-JSON failsafe merge.
 *
 * Merges builder-supplied intake-form JSON into a parsed A.R.C. record.
 * Rules (per docs/WEB_WIZARDD_UI_PATCH_SPEC.md):
 *
 *   1. Parser wins on conflict. A non-empty parser value is never overwritten.
 *   2. Intake fills gaps: null / undefined / empty-string / empty-array
 *      parser values, and keys the parsed record doesn't have at all.
 *   3. The top-level `metadata` key in intake JSON is ignored by design —
 *      metadata is parser-owned (completeness, warnings, provenance itself).
 *   4. Arrays merge wholesale, never per-element: an empty parser array is
 *      replaced by the intake array; a non-empty parser array wins entirely.
 *   5. Every field the intake supplies is recorded in a flat provenance map
 *      of dotted paths → "intake", so the UI can badge intake-sourced fields
 *      and the saved record carries a full audit trail.
 *
 * Numbers 0 and boolean false are real parser values — they are NOT empty
 * and are never overwritten.
 */

'use strict';

function isEmpty(v) {
  return v === null
    || v === undefined
    || (typeof v === 'string' && v.trim() === '')
    || (Array.isArray(v) && v.length === 0);
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

/**
 * @param {object} record  — the parsed A.R.C. record (not mutated)
 * @param {object} intake  — the builder-supplied intake JSON
 * @returns {{ merged: object, provenance: Object<string,string>, skippedMetadata: boolean }}
 */
function mergeIntakeIntoRecord(record, intake) {
  const merged = clone(record);
  const provenance = {};
  let skippedMetadata = false;

  // Record provenance for every primitive leaf under a newly-added subtree,
  // and for whole arrays at the array's own path.
  function markLeaves(v, path) {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      provenance[path.join('.')] = 'intake';
      return;
    }
    for (const k of Object.keys(v)) markLeaves(v[k], path.concat(k));
  }

  function walk(target, src, path) {
    for (const key of Object.keys(src)) {
      if (path.length === 0 && key === 'metadata') {
        skippedMetadata = true;
        continue;
      }
      const sVal = src[key];
      if (sVal === null || sVal === undefined) continue; // intake nulls add nothing

      const p = path.concat(key);
      const tHas = Object.prototype.hasOwnProperty.call(target, key);
      const tVal = tHas ? target[key] : undefined;

      const sIsPlainObj = typeof sVal === 'object' && !Array.isArray(sVal);
      const tIsPlainObj = typeof tVal === 'object' && tVal !== null && !Array.isArray(tVal);

      // Both sides plain objects → recurse (fill gaps inside)
      if (sIsPlainObj && tIsPlainObj) {
        walk(tVal, sVal, p);
        continue;
      }

      // Target missing or empty → intake fills (whole value)
      if (!tHas || isEmpty(tVal)) {
        if (sIsPlainObj) {
          target[key] = clone(sVal);
          markLeaves(target[key], p);
        } else if (Array.isArray(sVal)) {
          target[key] = clone(sVal);
          provenance[p.join('.')] = 'intake'; // whole-array fill, one entry
        } else {
          target[key] = sVal;
          provenance[p.join('.')] = 'intake';
        }
        continue;
      }

      // Target has a non-empty value (including 0 / false) → parser wins; skip.
    }
  }

  walk(merged, intake, []);
  return { merged, provenance, skippedMetadata };
}

module.exports = { mergeIntakeIntoRecord };
