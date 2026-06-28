/* ── AI Translator page ─────────────────────────────
 * Talks to /api/translate (Vercel function: holds the Anthropic key,
 * Marie's validated glossary, domain primer, reference terms).
 *
 * Adds, with no extra clinical input needed:
 *  - auto language detection
 *  - a trust badge (clinician-validated vs AI-assisted)
 *  - one-tap "bạn" → age/relationship pronoun substitution (Marie's table)
 *  - copy button + in-session history
 */
import {
  detectDirection,
  applyPronoun as subPronoun,
  hasBan,
} from './lib/text-utils.js';

(function () {
  const API = '/api/translate';
  const REQUEST_TIMEOUT_MS = 25000;
  const $ = (id) => document.getElementById(id);

  const els = {
    input: $('input'),
    translate: $('translate'),
    status: $('status'),
    error: $('error'),
    result: $('result'),
    resultLabel: $('resultLabel'),
    resultText: $('resultText'),
    trustBadge: $('trustBadge'),
    pronounRow: $('pronounRow'),
    pronounSel: $('pronounSel'),
    copy: $('copy'),
    copyHint: $('copyHint'),
    dirBtns: document.querySelectorAll('.dir-btn'),
    historyWrap: $('historyWrap'),
    historyList: $('historyList'),
    clearHistory: $('clearHistory'),
    suggestionWrap: $('suggestionWrap'),
    suggestionSrc: $('suggestionSrc'),
    suggestionOut: $('suggestionOut'),
    suggestionUse: $('suggestionUse'),
  };

  const LANG = {
    en2vi: { src: 'en', target: 'vi', label: 'Vietnamese' },
    vi2en: { src: 'vi', target: 'en', label: 'English' },
  };
  const PLACEHOLDERS = {
    auto:  'Type a phrase in English or Vietnamese…',
    en2vi: 'Type an English phrase to translate…',
    vi2en: 'Nhập một câu tiếng Việt để dịch…',
  };

  let mode = 'auto';        // user-selected: auto | en2vi | vi2en
  let effDir = 'en2vi';     // resolved direction of the last translation
  let rawOut = '';          // translation as returned (Vietnamese keeps "bạn")

  /* ── Language detection (shared, tested logic) ── */
  function resolveDir(text) {
    return mode === 'auto' ? detectDirection(text) : mode;
  }

  /* ── Direction toggle ─────────────────────────── */
  els.dirBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.dir;
      els.dirBtns.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      els.input.placeholder = PLACEHOLDERS[mode];
    });
  });

  /* ── Helpers ──────────────────────────────────── */
  const show = (el) => (el.hidden = false);
  const hide = (el) => (el.hidden = true);

  function setBusy(busy) {
    els.translate.disabled = busy;
    els.translate.textContent = busy ? 'Translating…' : 'Translate';
    busy ? show(els.status) : hide(els.status);
  }
  function showError(msg) {
    els.error.textContent = msg;
    show(els.error);
  }

  // Substitute the chosen pronoun for the "bạn" placeholder (shared logic).
  function applyPronoun(text) {
    const opt = els.pronounSel.options[els.pronounSel.selectedIndex];
    return subPronoun(text, opt.value, opt.dataset.cap || opt.value);
  }

  // The text currently shown (with any pronoun substitution applied).
  function displayed() {
    return els.resultText.textContent;
  }

  function renderResult() {
    const out = applyPronoun(rawOut);
    els.resultText.textContent = out;
    els.resultText.lang = LANG[effDir].target; // a11y + correct language hinting
    if (effDir === 'en2vi' && hasBan(rawOut)) show(els.pronounRow);
    else hide(els.pronounRow);
  }

  // Trust badge for a given source ('validated' | 'ai' | 'demo').
  function setBadge(source) {
    const map = {
      validated: ['✓ Clinician-validated phrase', 'trust-badge--ok'],
      ai: ['⚠ AI-assisted — verify before clinical use', 'trust-badge--ai'],
      demo: ['● Demo mode — not a real translation', 'trust-badge--demo'],
    };
    const [txt, cls] = map[source] || map.ai;
    els.trustBadge.textContent = txt;
    els.trustBadge.className = 'trust-badge ' + cls;
    show(els.trustBadge);
  }

  let suggestion = null; // { phrase, translation } in {src→target} of effDir
  function renderSuggestion() {
    if (!suggestion) {
      hide(els.suggestionWrap);
      return;
    }
    els.suggestionSrc.textContent = suggestion.phrase;
    els.suggestionSrc.lang = LANG[effDir].src;
    els.suggestionOut.textContent = suggestion.translation;
    els.suggestionOut.lang = LANG[effDir].target;
    show(els.suggestionWrap);
  }

  /* ── Translate ────────────────────────────────── */
  async function translate() {
    const text = els.input.value.trim();
    hide(els.error);
    hide(els.result);
    hide(els.suggestionWrap);
    if (!text) {
      showError('Please enter a phrase to translate.');
      return;
    }
    effDir = resolveDir(text);

    setBusy(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, direction: effDir }),
        signal: ctrl.signal,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        showError(data.error || 'Translation failed. Please try again.');
        return;
      }

      rawOut = data.translation;
      suggestion = data.suggestion || null;
      els.resultLabel.textContent =
        LANG[effDir].label + (mode === 'auto' ? '  ·  auto-detected' : '');
      setBadge(data.source);

      els.pronounSel.selectedIndex = 0; // reset to "bạn"
      renderResult();
      renderSuggestion();
      show(els.result);
      addHistory(text, rawOut, data.source, effDir, suggestion);
    } catch (e) {
      showError(
        e && e.name === 'AbortError'
          ? 'The translation took too long. Check your connection and try again.'
          : 'Network error. Check your connection and try again.'
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  // Use the validated suggestion as the answer (becomes trusted/green).
  els.suggestionUse.addEventListener('click', () => {
    if (!suggestion) return;
    rawOut = suggestion.translation;
    setBadge('validated');
    els.pronounSel.selectedIndex = 0;
    renderResult();
    hide(els.suggestionWrap);
  });

  els.translate.addEventListener('click', translate);
  els.input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') translate();
  });
  els.pronounSel.addEventListener('change', renderResult);

  /* ── Copy ─────────────────────────────────────── */
  els.copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(displayed());
      const prev = els.copy.textContent;
      els.copy.textContent = 'Copied ✓';
      setTimeout(() => (els.copy.textContent = prev), 1400);
    } catch {
      if (els.copyHint) els.copyHint.textContent = 'Copy not available — select the text manually.';
    }
  });

  /* ── In-session history (not persisted) ───────── */
  const history = [];
  function addHistory(src, out, source, dir, sugg) {
    history.unshift({ src, out, source, dir, sugg: sugg || null });
    if (history.length > 8) history.pop();
    renderHistory();
  }
  function renderHistory() {
    if (!history.length) {
      hide(els.historyWrap);
      return;
    }
    els.historyList.innerHTML = '';
    history.forEach((h) => {
      const li = document.createElement('li');
      const dot =
        h.source === 'validated' ? 'ok' : h.source === 'demo' ? 'demo' : 'ai';
      li.innerHTML =
        `<span class="hist-dot hist-dot--${dot}"></span>` +
        `<span class="hist-src"></span><span class="hist-arrow">→</span><span class="hist-out"></span>`;
      li.querySelector('.hist-src').textContent = h.src;
      li.querySelector('.hist-out').textContent = h.out;
      li.addEventListener('click', () => {
        els.input.value = h.src;
        rawOut = h.out;
        effDir = h.dir;
        suggestion = h.sugg;
        els.resultLabel.textContent = LANG[h.dir].label;
        setBadge(h.source);
        els.pronounSel.selectedIndex = 0;
        renderResult();
        renderSuggestion();
        show(els.result);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      els.historyList.appendChild(li);
    });
    show(els.historyWrap);
  }
  els.clearHistory.addEventListener('click', () => {
    history.length = 0;
    renderHistory();
  });
})();
