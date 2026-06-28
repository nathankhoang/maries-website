/* ── Phrasebook — fetch /api/phrases and render mobile-friendly cards ── */
(function () {
  'use strict';

  var container   = document.getElementById('phrasebook');
  var searchInput = document.getElementById('trans-search');
  var noResults   = document.getElementById('trans-noresults');

  if (!container) return;

  /* ── Category label map ── */
  var LABEL_MAP = {
    pronouns:  'Pronouns',
    greetings: 'Greetings',
    history:   'History',
    testing:   'Testing',
    diagnoses: 'Diagnoses',
    results:   'Results & Recs'
  };

  function toTitleCase(str) {
    return str.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function categoryLabel(key) {
    return LABEL_MAP[key] || toTitleCase(key);
  }

  /* ── Diacritic-insensitive normalizer ── */
  function norm(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip combining marks (tones, diacritics)
      .replace(/đ/g, 'd')         // đ → d  (U+0111 LATIN SMALL LETTER D WITH STROKE)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Whether the English field is a pronoun-category placeholder */
  function isPronounPlaceholder(en) {
    var t = (en || '').trim();
    return t === '' || t === '(pronoun)';
  }

  /* ── Build one phrase card ── */
  function makeCard(row, isPronounCat) {
    var card = document.createElement('div');
    card.className = 'pb-card';
    card.dataset.hay = norm([row.en, row.vi, row.note].join(' '));

    var showEn = !!(row.en && row.en.trim()) &&
                 !(isPronounCat && isPronounPlaceholder(row.en));

    if (showEn) {
      var en = document.createElement('p');
      en.className = 'pb-en';
      en.textContent = row.en;
      card.appendChild(en);
    }

    var vi = document.createElement('p');
    vi.className = 'pb-vi';
    vi.setAttribute('lang', 'vi');
    vi.textContent = row.vi || '';
    card.appendChild(vi);

    if (row.note) {
      var note = document.createElement('p');
      note.className = 'pb-note';
      note.textContent = row.note;
      card.appendChild(note);
    }

    return card;
  }

  /* ── Render full phrasebook from API data ── */
  function render(data) {
    var categories = (data && data.categories) || [];

    var tabsEl = document.createElement('div');
    tabsEl.className = 'pb-tabs';
    tabsEl.setAttribute('role', 'tablist');
    tabsEl.setAttribute('aria-label', 'Translation categories');

    var panelEls = [];
    var allCards = [];

    categories.forEach(function (cat, i) {
      var label        = categoryLabel(cat.key);
      var isFirst      = i === 0;
      var isPronounCat = cat.key === 'pronouns';
      var tabId        = 'pb-tab-'   + cat.key;
      var panelId      = 'pb-panel-' + cat.key;

      /* Tab button */
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'pb-tab' + (isFirst ? ' active' : '');
      tab.id = tabId;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', isFirst ? 'true' : 'false');
      tab.setAttribute('aria-controls', panelId);
      tab.textContent = label;
      tabsEl.appendChild(tab);

      /* Panel */
      var panel = document.createElement('div');
      panel.className = 'pb-panel' + (isFirst ? ' active' : '');
      panel.id = panelId;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tabId);

      var subsections = cat.subsections || [];
      subsections.forEach(function (sub) {
        var wrapper = document.createElement('div');
        wrapper.className = 'pb-sub';

        var subtitle = document.createElement('h3');
        subtitle.className = 'pb-subtitle';
        subtitle.textContent = sub.title || '';
        wrapper.appendChild(subtitle);

        var list = document.createElement('div');
        list.className = 'pb-list';
        list.setAttribute('aria-label', sub.title || '');

        (sub.rows || []).forEach(function (row) {
          var card = makeCard(row, isPronounCat);
          list.appendChild(card);
          allCards.push(card);
        });

        wrapper.appendChild(list);
        panel.appendChild(wrapper);
      });

      panelEls.push(panel);
    });

    /* Build DOM */
    container.innerHTML = '';
    container.appendChild(tabsEl);
    panelEls.forEach(function (p) { container.appendChild(p); });

    /* ── Tab switching ── */
    var tabs = tabsEl.querySelectorAll('.pb-tab');
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        /* Clear search when switching tabs */
        if (searchInput && searchInput.value) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
        }

        tabs.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        panelEls.forEach(function (p) { p.classList.remove('active'); });

        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        panelEls[i].classList.add('active');

        /* Scroll tab into horizontal view on small screens */
        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    });

    /* ── Search ── */
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var q = norm(searchInput.value);

        if (!q) {
          /* Restore tab view */
          container.classList.remove('pb--searching');
          allCards.forEach(function (c) { c.hidden = false; });
          panelEls.forEach(function (p) {
            p.querySelectorAll('.pb-sub').forEach(function (s) { s.hidden = false; });
          });
          if (noResults) noResults.hidden = true;
          return;
        }

        /* Flat filtered view */
        container.classList.add('pb--searching');
        var anyMatch = false;

        panelEls.forEach(function (p) {
          p.querySelectorAll('.pb-sub').forEach(function (sub) {
            var cards = sub.querySelectorAll('.pb-card');
            var subHasMatch = false;
            cards.forEach(function (card) {
              var match = card.dataset.hay.indexOf(q) !== -1;
              card.hidden = !match;
              if (match) { subHasMatch = true; anyMatch = true; }
            });
            sub.hidden = !subHasMatch;
          });
        });

        if (noResults) noResults.hidden = anyMatch;
      });
    }
  }

  /* ── Error / loading helpers ── */
  function showError(msg) {
    container.innerHTML = '<p class="pb-error">' + msg + '</p>';
  }

  /* Show loading state immediately */
  container.innerHTML = '<p class="pb-loading">Loading phrases…</p>';

  /* ── Fetch and render ── */
  fetch('/api/phrases')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) { render(data); })
    .catch(function () {
      showError(
        'Could not load the phrase library. Please refresh the page or try the ' +
        '<a href="translator.html">AI Translator</a>.'
      );
    });

}());
