/**
 * Web WIZARDD — Ingestion UI client
 *
 * Recursive editable form for the parsed A.R.C. record.
 * No framework — vanilla JS keeps the surface small and the deps zero.
 *
 * State model: { original, edited }
 *   original — the immutable record returned by /api/parse
 *   edited   — a deep clone that the form binds to; mutated on input
 *
 * The save endpoint receives `edited` verbatim, so the schema-valid shape
 * of the parser's output is preserved across the round trip.
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
   * State
   * ────────────────────────────────────────────────────────── */

  let state = {
    original: null,
    edited: null,
    sourceUrl: null
  };

  /* ──────────────────────────────────────────────────────────
   * DOM refs (resolved on DOMContentLoaded)
   * ────────────────────────────────────────────────────────── */

  let els = {};

  document.addEventListener('DOMContentLoaded', () => {
    els = {
      parseForm: document.getElementById('parse-form'),
      arcUrl: document.getElementById('arc-url'),
      parseButton: document.getElementById('parse-button'),
      parseStatus: document.getElementById('parse-status'),
      inputPanel: document.getElementById('input-panel'),
      reviewPanel: document.getElementById('review-panel'),
      reviewTitle: document.getElementById('review-title'),
      reviewMeta: document.getElementById('review-meta'),
      warnings: document.getElementById('warnings-block'),
      recordForm: document.getElementById('record-form'),
      saveButton: document.getElementById('save-button'),
      saveButtonBottom: document.getElementById('save-button-bottom'),
      cancelButton: document.getElementById('cancel-button'),
      cancelButtonBottom: document.getElementById('cancel-button-bottom'),
      toggleAllButton: document.getElementById('toggle-all-button'),
      editCounter: document.getElementById('edit-counter'),
      builderNotes: document.getElementById('builder-notes-input'),
      recordsList: document.getElementById('records-list'),
      toastContainer: document.getElementById('toast-container')
    };

    els.parseForm.addEventListener('submit', onParseSubmit);
    els.saveButton.addEventListener('click', onSaveClick);
    els.saveButtonBottom.addEventListener('click', onSaveClick);
    els.cancelButton.addEventListener('click', onCancelClick);
    els.cancelButtonBottom.addEventListener('click', onCancelClick);
    els.toggleAllButton.addEventListener('click', onToggleAll);
    els.builderNotes.addEventListener('input', updateEditCounter);

    // Initial state: button reads "Expand all" because everything starts collapsed
    els.toggleAllButton.dataset.mode = 'expand';
    els.toggleAllButton.textContent = 'Expand all';

    loadRecordsList();
  });

  /* ──────────────────────────────────────────────────────────
   * Parse flow
   * ────────────────────────────────────────────────────────── */

  async function onParseSubmit(e) {
    e.preventDefault();
    const url = els.arcUrl.value.trim();
    if (!url) return;

    els.parseButton.disabled = true;
    setStatus(`<span class="spinner"></span>Fetching and parsing… (may take 5–30s if not yet cached)`);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) {
        const hint = data.hint ? ` (${data.hint})` : '';
        setStatus(`Error: ${data.error}${hint}`, 'error');
        els.parseButton.disabled = false;
        return;
      }

      state.original = data.record;
      state.edited = deepClone(data.record);
      state.sourceUrl = url;
      setStatus(`Parsed in ${data.timing.parseMs}ms (fetch ${data.timing.fetchMs}ms). Completeness: ${data.record.metadata.completenessScore}`, 'success');
      renderReview();
    } catch (err) {
      setStatus(`Network error: ${err.message}`, 'error');
    } finally {
      els.parseButton.disabled = false;
    }
  }

  function setStatus(html, level) {
    els.parseStatus.innerHTML = html;
    els.parseStatus.className = 'status-line' + (level ? ' ' + level : '');
  }

  /* ──────────────────────────────────────────────────────────
   * Render: top-level layout
   * ────────────────────────────────────────────────────────── */

  function renderReview() {
    const r = state.edited;
    const partner = (r.businessIdentity && r.businessIdentity.businessName) || 'Unknown partner';
    const completeness = (r.metadata && r.metadata.completenessScore) || 0;
    const cBadge = completenessBadge(completeness);

    els.reviewTitle.innerHTML = `Review · <span style="color: var(--mint)">${escapeHtml(partner)}</span>${cBadge}`;
    els.reviewMeta.textContent = state.sourceUrl
      ? `Source: ${state.sourceUrl}`
      : 'Loaded from saved record';

    // Reset toggle-all button state (everything starts collapsed)
    els.toggleAllButton.dataset.mode = 'expand';
    els.toggleAllButton.textContent = 'Expand all';

    // Populate builder notes if loaded record has them
    const existingNotes = r.metadata && r.metadata.builderReview && r.metadata.builderReview.notes;
    els.builderNotes.value = existingNotes || '';

    renderWarnings(r.metadata && r.metadata.extractionWarnings);
    renderRecordForm(r);
    updateEditCounter();

    els.reviewPanel.classList.remove('hidden');
    els.reviewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function completenessBadge(score) {
    const cls = score >= 85 ? 'high' : score >= 65 ? 'mid' : 'low';
    return `<span class="completeness-badge ${cls}">completeness ${score}</span>`;
  }

  function renderWarnings(warnings) {
    if (!warnings || warnings.length === 0) {
      els.warnings.innerHTML = '';
      return;
    }
    const html = warnings.map(w => {
      const isInfo = w.startsWith('LLM extraction:');
      return `<div class="warning-item ${isInfo ? 'warning--info' : ''}">${escapeHtml(w)}</div>`;
    }).join('');
    els.warnings.innerHTML = html;
  }

  /* ──────────────────────────────────────────────────────────
   * Render: the record itself, recursively
   * ────────────────────────────────────────────────────────── */

  // Order top-level keys for the most useful review flow: identity first,
  // then customer audience, then services/locations, then SEO/competitive context,
  // then strategy, then metadata at the end.
  const SECTION_ORDER = [
    'businessIdentity',
    'audience',
    'targetServices',
    'targetLocations',
    'competitors',
    'aiVisibility',
    'currentDigitalPresence',
    'painPoints',
    'roadmap',
    'metadata'
  ];

  const SECTION_LABELS = {
    businessIdentity: 'Business identity',
    audience: 'Audience (personas, journey, drivers, channels)',
    targetServices: 'Target services',
    targetLocations: 'Target locations',
    competitors: 'Competitors',
    aiVisibility: 'AI visibility',
    currentDigitalPresence: 'Current digital presence',
    painPoints: 'Pain points',
    roadmap: 'Roadmap',
    metadata: 'Metadata (read-only)'
  };

  // ALL sections collapsed by default — builder opens only what they need to look at.
  // The expand-all toggle lets them flip everything open at once.
  const COLLAPSED_DEFAULT = new Set([
    'businessIdentity',
    'audience',
    'targetServices',
    'targetLocations',
    'competitors',
    'aiVisibility',
    'currentDigitalPresence',
    'painPoints',
    'roadmap',
    'metadata'
  ]);

  function renderRecordForm(record) {
    els.recordForm.innerHTML = '';
    const keys = SECTION_ORDER.filter(k => k in record).concat(
      Object.keys(record).filter(k => !SECTION_ORDER.includes(k))
    );
    for (const key of keys) {
      const isReadOnly = key === 'metadata';
      const section = renderSection(key, record[key], [key], isReadOnly);
      els.recordForm.appendChild(section);
    }
  }

  function renderSection(key, value, path, readOnly) {
    const collapsed = COLLAPSED_DEFAULT.has(key);
    const label = SECTION_LABELS[key] || titleCase(key);
    const count = Array.isArray(value) ? `${value.length} item${value.length === 1 ? '' : 's'}` : '';

    // Compute completion signal for this section (skip metadata since it's read-only)
    const issuesPill = key === 'metadata' ? '' : completionPill(value);

    const section = document.createElement('div');
    section.className = 'record-section' + (collapsed ? ' collapsed' : '');

    const header = document.createElement('div');
    header.className = 'record-section-header';
    header.innerHTML = `
      <div class="record-section-title">
        <span class="record-section-chevron">▼</span>
        <span>${escapeHtml(label)}</span>
      </div>
      <div class="record-section-meta">
        ${issuesPill}
        ${count ? `<span class="record-section-count">${count}</span>` : ''}
      </div>
    `;
    header.addEventListener('click', () => section.classList.toggle('collapsed'));
    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'record-section-body';
    body.appendChild(renderValue(value, path, readOnly));
    section.appendChild(body);

    return section;
  }

  /**
   * Render a qualitative completion pill for a section based on what fraction
   * of its primitive leaves are populated.
   *
   * We deliberately do NOT show raw counts ("27 missing"). With deeply nested
   * objects, a raw leaf count is misleading — Competitors with 27 missing fields
   * makes it sound like 27 competitors lack names, when actually it's a handful
   * of optional sub-fields across 5 competitors. Qualitative labels convey
   * severity without false precision.
   */
  function completionPill(value) {
    const stats = countLeaves(value);
    if (stats.total === 0) return '';
    if (stats.nulls === 0) return `<span class="record-section-issues clean">✓ complete</span>`;

    const pctFilled = (stats.total - stats.nulls) / stats.total;
    if (pctFilled >= 0.85) return `<span class="record-section-issues mostly-complete">mostly complete</span>`;
    if (pctFilled >= 0.50) return `<span class="record-section-issues partial">partial</span>`;
    return `<span class="record-section-issues mostly-empty">mostly empty</span>`;
  }

  /**
   * Recursively count primitive leaves and how many of them are null/empty.
   * Used by completionPill to compute the qualitative fill signal.
   */
  function countLeaves(value) {
    let total = 0;
    let nulls = 0;
    function walk(v) {
      if (v === null || v === undefined) { total++; nulls++; return; }
      if (typeof v === 'string') { total++; if (v.trim() === '') nulls++; return; }
      if (typeof v === 'number' || typeof v === 'boolean') { total++; return; }
      if (Array.isArray(v)) {
        if (v.length === 0) { total++; nulls++; return; }
        for (const item of v) walk(item);
        return;
      }
      if (typeof v === 'object') {
        for (const k of Object.keys(v)) walk(v[k]);
        return;
      }
    }
    walk(value);
    return { total, nulls };
  }

  /* ──────────────────────────────────────────────────────────
   * Recursive value rendering
   *
   * value       — the JS value at this point in the tree
   * path        — array of keys to reach this value from the root
   * readOnly    — disables all inputs (used for metadata section)
   * ────────────────────────────────────────────────────────── */

  function renderValue(value, path, readOnly) {
    if (value === null || value === undefined) {
      return renderScalar(null, path, readOnly, 'text');
    }
    if (typeof value === 'string') {
      return renderScalar(value, path, readOnly, value.length > 80 ? 'textarea' : 'text');
    }
    if (typeof value === 'number') {
      return renderScalar(value, path, readOnly, 'number');
    }
    if (typeof value === 'boolean') {
      return renderScalar(value, path, readOnly, 'boolean');
    }
    if (Array.isArray(value)) {
      return renderArray(value, path, readOnly);
    }
    if (typeof value === 'object') {
      return renderObject(value, path, readOnly);
    }
    return document.createTextNode(String(value));
  }

  function renderScalar(value, path, readOnly, type) {
    const wrap = document.createElement('div');
    wrap.className = 'field-row-value';
    let input;
    const isNullish = value === null || value === undefined || value === '';

    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'input-textarea';
      input.value = value || '';
      input.rows = Math.max(2, Math.min(8, (value || '').split('\n').length + 1));
    } else if (type === 'boolean') {
      input = document.createElement('select');
      input.className = 'input-text';
      for (const opt of [['null', '(unset)'], ['true', 'true'], ['false', 'false']]) {
        const o = document.createElement('option');
        o.value = opt[0];
        o.textContent = opt[1];
        if ((value === null && opt[0] === 'null') || String(value) === opt[0]) o.selected = true;
        input.appendChild(o);
      }
    } else {
      input = document.createElement('input');
      input.type = type === 'number' ? 'number' : 'text';
      input.className = 'input-text';
      input.value = value === null ? '' : value;
      if (type === 'number') input.step = 'any';
      input.placeholder = value === null ? '(null)' : '';
    }

    if (isNullish && !readOnly) input.classList.add('is-null');
    if (readOnly) input.disabled = true;

    input.addEventListener('input', () => {
      setAtPath(path, parseInputValue(input, type));
      input.classList.toggle('is-null', input.value === '' || input.value === 'null');
      updateEditCounter();
    });
    input.addEventListener('change', () => {
      setAtPath(path, parseInputValue(input, type));
      updateEditCounter();
    });

    wrap.appendChild(input);
    return wrap;
  }

  function parseInputValue(input, type) {
    const raw = input.value;
    if (type === 'boolean') {
      if (raw === 'null' || raw === '') return null;
      return raw === 'true';
    }
    if (type === 'number') {
      if (raw === '' || raw === null) return null;
      const n = Number(raw);
      return isNaN(n) ? null : n;
    }
    // text / textarea — empty string becomes null to keep schema honest
    return raw === '' ? null : raw;
  }

  function renderObject(value, path, readOnly) {
    const wrap = document.createElement('div');
    wrap.className = 'object-fields';

    for (const key of Object.keys(value)) {
      const childValue = value[key];
      const childPath = path.concat(key);

      if (Array.isArray(childValue) && childValue.length > 0 && typeof childValue[0] === 'object' && childValue[0] !== null) {
        // Array of objects: render each as a sub-object with full label
        const group = document.createElement('div');
        group.className = 'field-group';
        const label = document.createElement('div');
        label.className = 'field-group-label';
        label.textContent = `${titleCase(key)} (${childValue.length})`;
        group.appendChild(label);
        group.appendChild(renderArray(childValue, childPath, readOnly));
        wrap.appendChild(group);
      } else if (typeof childValue === 'object' && childValue !== null && !Array.isArray(childValue)) {
        // Nested object: render as a labeled group
        const group = document.createElement('div');
        group.className = 'field-group';
        const label = document.createElement('div');
        label.className = 'field-group-label';
        label.textContent = titleCase(key);
        group.appendChild(label);
        const sub = document.createElement('div');
        sub.className = 'sub-object';
        sub.appendChild(renderObject(childValue, childPath, readOnly));
        group.appendChild(sub);
        wrap.appendChild(group);
      } else {
        // Scalar or string array: render as a field row
        const row = document.createElement('div');
        row.className = 'field-row';

        const lbl = document.createElement('div');
        lbl.className = 'field-row-label';
        lbl.textContent = key;
        row.appendChild(lbl);

        row.appendChild(renderValue(childValue, childPath, readOnly));
        wrap.appendChild(row);
      }
    }
    return wrap;
  }

  function renderArray(arr, path, readOnly) {
    // If array of objects: render each as a sub-object
    if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
      const wrap = document.createElement('div');
      arr.forEach((item, i) => {
        const sub = document.createElement('div');
        sub.className = 'sub-object';

        const header = document.createElement('div');
        header.className = 'sub-object-header';
        const itemLabel = item.name || item.businessName || item.title || `Item ${i + 1}`;
        let extra = '';
        if (item.tier) extra = `<span class="sub-object-tier">${escapeHtml(item.tier)}</span>`;
        header.innerHTML = escapeHtml(itemLabel) + extra;
        sub.appendChild(header);

        sub.appendChild(renderObject(item, path.concat(i), readOnly));
        wrap.appendChild(sub);
      });
      return wrap;
    }

    // Array of strings (or empty): render as editable string list
    return renderStringList(arr, path, readOnly);
  }

  function renderStringList(arr, path, readOnly) {
    const wrap = document.createElement('div');
    wrap.className = 'string-list';

    function rerender() {
      wrap.innerHTML = '';
      arr.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'string-list-item';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input-text';
        input.value = item == null ? '' : String(item);
        if (input.value === '') input.classList.add('is-null');
        if (readOnly) input.disabled = true;
        input.addEventListener('input', () => {
          arr[i] = input.value;
          setAtPath(path, arr);
          input.classList.toggle('is-null', input.value === '');
          updateEditCounter();
        });
        row.appendChild(input);
        if (!readOnly) {
          const rm = document.createElement('button');
          rm.type = 'button';
          rm.className = 'string-list-remove';
          rm.textContent = 'remove';
          rm.addEventListener('click', () => {
            arr.splice(i, 1);
            setAtPath(path, arr);
            rerender();
            updateEditCounter();
          });
          row.appendChild(rm);
        }
        wrap.appendChild(row);
      });
      if (!readOnly) {
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'string-list-add';
        add.textContent = '+ add item';
        add.addEventListener('click', () => {
          arr.push('');
          setAtPath(path, arr);
          rerender();
          updateEditCounter();
        });
        wrap.appendChild(add);
      }
    }
    rerender();
    return wrap;
  }

  /* ──────────────────────────────────────────────────────────
   * State mutation: set a value at a deep path
   * ────────────────────────────────────────────────────────── */

  function setAtPath(path, value) {
    let target = state.edited;
    for (let i = 0; i < path.length - 1; i++) {
      target = target[path[i]];
    }
    target[path[path.length - 1]] = value;
  }

  /* ──────────────────────────────────────────────────────────
   * Expand / Collapse all
   * ────────────────────────────────────────────────────────── */

  function onToggleAll() {
    const allSections = els.recordForm.querySelectorAll('.record-section');
    const wantExpand = els.toggleAllButton.dataset.mode === 'expand';
    for (const section of allSections) {
      section.classList.toggle('collapsed', !wantExpand);
    }
    els.toggleAllButton.dataset.mode = wantExpand ? 'collapse' : 'expand';
    els.toggleAllButton.textContent = wantExpand ? 'Collapse all' : 'Expand all';
  }

  /* ──────────────────────────────────────────────────────────
   * Edit counter — surfaces how many fields the builder has touched
   *
   * Compares state.edited against state.original. Walks both trees and
   * counts primitive-leaf differences. Also includes the builder notes
   * field if non-empty.
   * ────────────────────────────────────────────────────────── */

  function updateEditCounter() {
    if (!state.original || !state.edited) {
      els.editCounter.classList.add('hidden');
      return;
    }
    let count = countDiffs(state.original, state.edited);
    const notes = (els.builderNotes.value || '').trim();
    const existingNotes = (state.original.metadata &&
      state.original.metadata.builderReview &&
      state.original.metadata.builderReview.notes) || '';
    if (notes !== existingNotes) count++;

    if (count === 0) {
      els.editCounter.classList.add('hidden');
    } else {
      els.editCounter.textContent = `${count} edit${count === 1 ? '' : 's'} pending`;
      els.editCounter.classList.remove('hidden');
    }
  }

  function countDiffs(a, b) {
    let count = 0;
    function walk(va, vb) {
      // null/undefined unification
      const aIsNull = va === null || va === undefined;
      const bIsNull = vb === null || vb === undefined;
      if (aIsNull && bIsNull) return;
      if (aIsNull !== bIsNull) { count++; return; }
      if (typeof va !== typeof vb) { count++; return; }
      if (Array.isArray(va) || Array.isArray(vb)) {
        if (!Array.isArray(va) || !Array.isArray(vb)) { count++; return; }
        const len = Math.max(va.length, vb.length);
        for (let i = 0; i < len; i++) walk(va[i], vb[i]);
        return;
      }
      if (typeof va === 'object') {
        const keys = new Set([...Object.keys(va), ...Object.keys(vb)]);
        for (const k of keys) walk(va[k], vb[k]);
        return;
      }
      if (va !== vb) count++;
    }
    walk(a, b);
    return count;
  }

  /* ──────────────────────────────────────────────────────────
   * Save flow
   * ────────────────────────────────────────────────────────── */

  async function onSaveClick() {
    els.saveButton.disabled = true;
    els.saveButtonBottom.disabled = true;

    // Inject builder notes into the record before save
    const notes = (els.builderNotes.value || '').trim();
    if (!state.edited.metadata) state.edited.metadata = {};
    if (!state.edited.metadata.builderReview) state.edited.metadata.builderReview = {};
    state.edited.metadata.builderReview.notes = notes || null;

    toast('Saving record…', 'info');
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: state.edited })
      });
      const data = await res.json();
      if (!res.ok) {
        toast('Save failed: ' + data.error, 'error');
        return;
      }
      toast(`Saved: ${data.filename}`, 'success');
      // Reset diff baseline so the edit counter clears after save
      state.original = deepClone(state.edited);
      updateEditCounter();
      loadRecordsList();
    } catch (err) {
      toast('Network error: ' + err.message, 'error');
    } finally {
      els.saveButton.disabled = false;
      els.saveButtonBottom.disabled = false;
    }
  }

  function onCancelClick() {
    if (!confirm('Discard your edits and return to the input panel?')) return;
    state = { original: null, edited: null, sourceUrl: null };
    els.reviewPanel.classList.add('hidden');
    els.recordForm.innerHTML = '';
    els.warnings.innerHTML = '';
    setStatus('');
    els.arcUrl.value = '';
    els.inputPanel.scrollIntoView({ behavior: 'smooth' });
  }

  /* ──────────────────────────────────────────────────────────
   * Records list (previously saved)
   * ────────────────────────────────────────────────────────── */

  async function loadRecordsList() {
    try {
      const res = await fetch('/api/records');
      const data = await res.json();
      if (!data.records || data.records.length === 0) {
        els.recordsList.innerHTML = '<div class="records-list-empty">No saved records yet.</div>';
        return;
      }
      els.recordsList.innerHTML = '';
      for (const r of data.records) {
        const item = document.createElement('div');
        item.className = 'record-item';
        const date = new Date(r.modifiedAt).toLocaleString();
        item.innerHTML = `
          <span class="record-item-filename">${escapeHtml(r.filename)}</span>
          <span class="record-item-date">${escapeHtml(date)}</span>
        `;
        item.addEventListener('click', () => loadRecord(r.filename));
        els.recordsList.appendChild(item);
      }
    } catch (err) {
      els.recordsList.innerHTML = `<div class="records-list-empty">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadRecord(filename) {
    toast(`Loading ${filename}…`, 'info');
    try {
      const res = await fetch(`/api/records/${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok) {
        toast('Load failed: ' + data.error, 'error');
        return;
      }
      state.original = data.record;
      state.edited = deepClone(data.record);
      state.sourceUrl = null;
      renderReview();
      toast(`Loaded ${filename}`, 'success');
    } catch (err) {
      toast('Network error: ' + err.message, 'error');
    }
  }

  /* ──────────────────────────────────────────────────────────
   * Toast notifications
   * ────────────────────────────────────────────────────────── */

  function toast(message, level) {
    const t = document.createElement('div');
    t.className = 'toast ' + (level || 'info');
    t.textContent = message;
    els.toastContainer.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, 3500);
  }

  /* ──────────────────────────────────────────────────────────
   * Utilities
   * ────────────────────────────────────────────────────────── */

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function titleCase(s) {
    return String(s).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
  }
})();
