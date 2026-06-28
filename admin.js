/* ══════════════════════════════════════════════════════
   AuD Viet Translations — Admin CMS
   Plain vanilla JS. No frameworks, no build step.
   All phrase text injected via .textContent only.
   ══════════════════════════════════════════════════════ */

'use strict';

/* ── Category display labels ───────────────────────── */
const CATEGORY_LABELS = {
  pronouns:  'Pronouns',
  greetings: 'Greetings',
  history:   'History',
  testing:   'Testing',
  diagnoses: 'Diagnoses',
  results:   'Results & Recs',
};

function displayCategory(cat) {
  if (!cat) return '(Uncategorized)';
  return CATEGORY_LABELS[cat] ||
    cat.replace(/\b\w/g, c => c.toUpperCase()).replace(/-/g, ' ');
}

/* ── State ─────────────────────────────────────────── */
let phrases     = [];
let searchQuery = '';
let editingId   = null;
let deletingId  = null;

/* ── DOM refs ──────────────────────────────────────── */
const loginView   = document.getElementById('login-view');
const editorView  = document.getElementById('editor-view');
const loginForm   = document.getElementById('login-form');
const loginError  = document.getElementById('login-error');
const loginBtn    = document.getElementById('login-btn');
const logoutBtn   = document.getElementById('logout-btn');
const addForm     = document.getElementById('add-form');
const addStatus   = document.getElementById('add-status');
const listStatus  = document.getElementById('list-status');
const phraseList  = document.getElementById('phrase-list');
const searchInput = document.getElementById('search');
const catDatalist = document.getElementById('category-list');
const subDatalist = document.getElementById('subsection-list');

/* ══════════════════════════════════════════════════════
   STATUS HELPER
   Per-element auto-clear timer stored as _timer property.
   ══════════════════════════════════════════════════════ */
function showStatus(el, msg, isError) {
  if (el._timer) { clearTimeout(el._timer); el._timer = null; }
  el.textContent = msg;
  el.className = 'status ' + (isError ? 'status--error' : 'status--success');
  el.removeAttribute('hidden');
  if (!isError) {
    el._timer = setTimeout(() => {
      el.textContent = '';
      el.className = 'status';
      el._timer = null;
    }, 3500);
  }
}

/* ══════════════════════════════════════════════════════
   AUTH — LOGIN / LOGOUT
   ══════════════════════════════════════════════════════ */

/** On page load: probe the API; route to the right view. */
async function checkAuth() {
  try {
    const res = await fetch('/api/admin/phrases', { credentials: 'same-origin' });
    if (res.status === 401) { showLoginView(); return; }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    phrases = data.phrases || [];
    showEditorView();
  } catch (_) {
    showLoginView();
  }
}

function showLoginView() {
  editorView.hidden = true;
  loginView.hidden = false;
  loginError.hidden = true;
  loginError.textContent = '';
  const pwField = document.getElementById('password');
  if (pwField) { pwField.value = ''; pwField.focus(); }
}

function showEditorView() {
  loginView.hidden = true;
  editorView.hidden = false;
  buildDataLists();
  renderPhraseList();
  searchInput.value = '';
  searchQuery = '';
}

function handleUnauthorized() {
  phrases     = [];
  editingId   = null;
  deletingId  = null;
  searchQuery = '';
  showLoginView();
  showLoginError('Your session expired. Please log in again.');
}

/* ── Login form ────────────────────────────────────── */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in…';
  loginError.hidden = true;
  loginError.textContent = '';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      /* Fetch the phrase list immediately so the editor is ready. */
      const listRes = await fetch('/api/admin/phrases', { credentials: 'same-origin' });
      if (!listRes.ok) {
        showLoginError('Login succeeded but could not load phrases. Please try refreshing.');
        return;
      }
      const listData = await listRes.json();
      phrases = listData.phrases || [];
      showEditorView();
    } else if (res.status === 429) {
      showLoginError(data.error || 'Too many attempts. Please wait and try again.');
    } else {
      showLoginError('Incorrect password.');
    }
  } catch (_) {
    showLoginError('Network error — check your connection and try again.');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log in';
  }
});

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.hidden = false;
}

/* ── Logout button ─────────────────────────────────── */
logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (_) { /* ignore network errors on logout */ }
  phrases     = [];
  editingId   = null;
  deletingId  = null;
  searchQuery = '';
  logoutBtn.disabled = false;
  showLoginView();
});

/* ══════════════════════════════════════════════════════
   DATALISTS (category + subsection autocomplete)
   ══════════════════════════════════════════════════════ */
function buildDataLists() {
  const cats = [...new Set(phrases.map(p => p.category).filter(Boolean))].sort();
  const subs = [...new Set(phrases.map(p => p.subsection).filter(Boolean))].sort();

  catDatalist.textContent = '';
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    catDatalist.appendChild(opt);
  });

  subDatalist.textContent = '';
  subs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    subDatalist.appendChild(opt);
  });
}

/* ══════════════════════════════════════════════════════
   ADD PHRASE FORM
   ══════════════════════════════════════════════════════ */
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fd       = new FormData(addForm);
  const category = fd.get('category').trim();
  const vi       = fd.get('vi').trim();

  if (!category) { showStatus(addStatus, 'Category is required.', true); return; }
  if (!vi)       { showStatus(addStatus, 'Vietnamese phrase is required.', true); return; }

  const body = { category, vi };
  const subsection = fd.get('subsection').trim();
  const en         = fd.get('en').trim();
  const note       = fd.get('note').trim();
  if (subsection) body.subsection = subsection;
  if (en)         body.en = en;
  if (note)       body.note = note;

  const addBtn = document.getElementById('add-btn');
  addBtn.disabled = true;

  try {
    const res = await fetch('/api/admin/phrases', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 401) { handleUnauthorized(); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showStatus(addStatus, data.error || 'Could not add phrase.', true);
      return;
    }
    phrases.push(data.phrase);
    addForm.reset();
    buildDataLists();
    renderPhraseList();
    showStatus(addStatus, 'Phrase added.', false);
  } catch (_) {
    showStatus(addStatus, 'Network error — please try again.', true);
  } finally {
    addBtn.disabled = false;
  }
});

/* ══════════════════════════════════════════════════════
   SEARCH
   ══════════════════════════════════════════════════════ */
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  editingId   = null;   /* cancel any open edit when searching */
  deletingId  = null;
  renderPhraseList();
});

function getFilteredPhrases() {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return phrases;
  return phrases.filter(p =>
    [p.en, p.vi, p.note, p.category, p.subsection]
      .some(v => v && v.toLowerCase().includes(q))
  );
}

/* ══════════════════════════════════════════════════════
   RENDER PHRASE LIST
   Groups: category → subsection → rows.
   All text set via textContent — no innerHTML with user data.
   ══════════════════════════════════════════════════════ */
function renderPhraseList() {
  /* Clear the list — wipe child nodes, not innerHTML */
  while (phraseList.firstChild) phraseList.removeChild(phraseList.firstChild);

  const filtered = getFilteredPhrases();

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'list-empty';
    empty.textContent = searchQuery.trim()
      ? 'No phrases match your search.'
      : 'No phrases yet. Add one above.';
    phraseList.appendChild(empty);
    return;
  }

  /* Build: category → Map(subsection → phrase[]) */
  const groups = new Map();
  filtered.forEach(p => {
    const cat = p.category || '';
    const sub = p.subsection || '';
    if (!groups.has(cat)) groups.set(cat, new Map());
    const subMap = groups.get(cat);
    if (!subMap.has(sub)) subMap.set(sub, []);
    subMap.get(sub).push(p);
  });

  groups.forEach((subMap, cat) => {
    const totalInCat = [...subMap.values()].reduce((n, arr) => n + arr.length, 0);

    /* ── Category group wrapper ── */
    const groupEl = document.createElement('div');
    groupEl.className = 'phrase-group';

    /* Category header */
    const catHeader = document.createElement('div');
    catHeader.className = 'phrase-group__header';

    const catTitle = document.createElement('h3');
    catTitle.className = 'phrase-group__title';
    catTitle.textContent = displayCategory(cat);

    const catCount = document.createElement('span');
    catCount.className = 'phrase-group__count';
    catCount.textContent = totalInCat + (totalInCat === 1 ? ' phrase' : ' phrases');

    catHeader.appendChild(catTitle);
    catHeader.appendChild(catCount);
    groupEl.appendChild(catHeader);

    /* ── Subsection groups ── */
    subMap.forEach((subPhrases, sub) => {
      if (sub) {
        const subHeader = document.createElement('div');
        subHeader.className = 'phrase-subgroup';

        const subTitle = document.createElement('h4');
        subTitle.className = 'phrase-subgroup__title';
        subTitle.textContent = sub;

        const subCount = document.createElement('span');
        subCount.className = 'phrase-subgroup__count';
        subCount.textContent = '(' + subPhrases.length + ')';

        subHeader.appendChild(subTitle);
        subHeader.appendChild(subCount);
        groupEl.appendChild(subHeader);
      }

      /* ── Phrase rows ── */
      subPhrases.forEach(p => {
        if (editingId === p.id) {
          groupEl.appendChild(buildEditRow(p));
        } else if (deletingId === p.id) {
          groupEl.appendChild(buildConfirmRow(p));
        } else {
          groupEl.appendChild(buildPhraseRow(p));
        }
      });
    });

    phraseList.appendChild(groupEl);
  });
}

/* ── Normal phrase row ─────────────────────────────── */
function buildPhraseRow(p) {
  const row = document.createElement('div');
  row.className = 'phrase-row';
  row.dataset.id = p.id;

  const content = document.createElement('div');
  content.className = 'phrase-row__content';

  if (p.en) {
    const en = document.createElement('p');
    en.className = 'phrase-row__en';
    en.textContent = p.en;
    content.appendChild(en);
  }

  const vi = document.createElement('p');
  vi.className = 'phrase-row__vi';
  vi.textContent = p.vi;
  content.appendChild(vi);

  if (p.note) {
    const note = document.createElement('p');
    note.className = 'phrase-row__note';
    note.textContent = p.note;
    content.appendChild(note);
  }

  const actions = document.createElement('div');
  actions.className = 'phrase-row__actions';

  const editBtn = makeActionBtn('Edit', 'action-btn--edit', 'Edit phrase: ' + (p.en || p.vi));
  editBtn.addEventListener('click', () => {
    editingId  = p.id;
    deletingId = null;
    renderPhraseList();
  });

  const delBtn = makeActionBtn('Delete', 'action-btn--delete', 'Delete phrase: ' + (p.en || p.vi));
  delBtn.addEventListener('click', () => {
    deletingId = p.id;
    editingId  = null;
    renderPhraseList();
  });

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  row.appendChild(content);
  row.appendChild(actions);
  return row;
}

/* ── Inline edit row ───────────────────────────────── */
function buildEditRow(p) {
  const row = document.createElement('div');
  row.className = 'phrase-row phrase-row--editing';
  row.dataset.id = p.id;

  /* Edit fields grid */
  const fieldsGrid = document.createElement('div');
  fieldsGrid.className = 'phrase-row__edit-fields';

  const catInput = makeEditField('Category *', 'category', p.category || '', true, 'category-list');
  const subInput = makeEditField('Subsection', 'subsection', p.subsection || '', false, 'subsection-list');
  const enInput  = makeEditField('English', 'en', p.en || '', false);
  const viInput  = makeEditField('Vietnamese *', 'vi', p.vi || '', true);
  const noteInput = makeEditField('Note', 'note', p.note || '', false);

  [catInput, subInput, enInput, viInput, noteInput].forEach(f => fieldsGrid.appendChild(f));

  /* Row footer: status message + save/cancel */
  const footer = document.createElement('div');
  footer.className = 'phrase-row__footer';

  const editStatus = document.createElement('div');
  editStatus.className = 'status';
  editStatus.setAttribute('role', 'status');
  editStatus.setAttribute('aria-live', 'polite');

  const actions = document.createElement('div');
  actions.className = 'phrase-row__actions';

  const saveBtn   = makeActionBtn('Save', 'action-btn--save');
  const cancelBtn = makeActionBtn('Cancel', 'action-btn--cancel');

  cancelBtn.addEventListener('click', () => {
    editingId = null;
    renderPhraseList();
  });

  saveBtn.addEventListener('click', async () => {
    const catVal  = fieldsGrid.querySelector('[data-name="category"]').value.trim();
    const viVal   = fieldsGrid.querySelector('[data-name="vi"]').value.trim();

    if (!catVal) { showStatus(editStatus, 'Category is required.', true); return; }
    if (!viVal)  { showStatus(editStatus, 'Vietnamese is required.', true); return; }

    const body = {
      id: p.id,
      category:   catVal,
      vi:         viVal,
      subsection: fieldsGrid.querySelector('[data-name="subsection"]').value.trim() || null,
      en:         fieldsGrid.querySelector('[data-name="en"]').value.trim() || null,
      note:       fieldsGrid.querySelector('[data-name="note"]').value.trim() || null,
    };

    saveBtn.disabled = true;

    try {
      const res = await fetch('/api/admin/phrases', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showStatus(editStatus, data.error || 'Could not save phrase.', true);
        return;
      }
      const idx = phrases.findIndex(x => x.id === p.id);
      if (idx !== -1) phrases[idx] = data.phrase;
      editingId = null;
      buildDataLists();
      renderPhraseList();
      showStatus(listStatus, 'Phrase saved.', false);
    } catch (_) {
      showStatus(editStatus, 'Network error — please try again.', true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  footer.appendChild(editStatus);
  footer.appendChild(actions);

  row.appendChild(fieldsGrid);
  row.appendChild(footer);

  /* Focus the first field after paint */
  requestAnimationFrame(() => {
    const firstInput = fieldsGrid.querySelector('input');
    if (firstInput) firstInput.focus();
  });

  return row;
}

/* ── Inline delete confirm row ─────────────────────── */
function buildConfirmRow(p) {
  const row = document.createElement('div');
  row.className = 'phrase-row phrase-row--confirming';
  row.dataset.id = p.id;

  /* Show phrase preview */
  const content = document.createElement('div');
  content.className = 'phrase-row__content';

  if (p.en) {
    const en = document.createElement('p');
    en.className = 'phrase-row__en';
    en.textContent = p.en;
    content.appendChild(en);
  }
  const vi = document.createElement('p');
  vi.className = 'phrase-row__vi';
  vi.textContent = p.vi;
  content.appendChild(vi);

  /* Confirm strip */
  const confirm = document.createElement('div');
  confirm.className = 'phrase-row__confirm';

  const msg = document.createElement('span');
  msg.className = 'confirm-msg';
  msg.textContent = 'Delete this phrase?';

  const yesBtn = makeActionBtn('Yes, delete', 'action-btn--yes');
  const noBtn  = makeActionBtn('No, keep', 'action-btn--no');

  noBtn.addEventListener('click', () => {
    deletingId = null;
    renderPhraseList();
  });

  yesBtn.addEventListener('click', async () => {
    yesBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/phrases?id=' + encodeURIComponent(p.id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      /* 404 means it's already gone — treat as success */
      if (!res.ok && res.status !== 404) {
        deletingId = null;
        renderPhraseList();
        showStatus(listStatus, 'Could not delete phrase.', true);
        return;
      }
      phrases    = phrases.filter(x => x.id !== p.id);
      deletingId = null;
      buildDataLists();
      renderPhraseList();
      showStatus(listStatus, 'Phrase deleted.', false);
    } catch (_) {
      yesBtn.disabled = false;
      showStatus(listStatus, 'Network error — please try again.', true);
    }
  });

  confirm.appendChild(msg);
  confirm.appendChild(yesBtn);
  confirm.appendChild(noBtn);

  row.appendChild(content);
  row.appendChild(confirm);

  /* Focus "No" by default — safer choice for keyboard users */
  requestAnimationFrame(() => noBtn.focus());

  return row;
}

/* ══════════════════════════════════════════════════════
   SMALL DOM HELPERS
   ══════════════════════════════════════════════════════ */

/** Build a labeled text input for the edit grid. */
function makeEditField(labelText, name, value, required, listId) {
  const wrap = document.createElement('div');
  wrap.className = 'form-field';

  const lbl = document.createElement('label');
  lbl.className = 'form-label';
  lbl.textContent = labelText;
  lbl.setAttribute('for', 'edit-' + name + '-' + Math.random().toString(36).slice(2));

  const inp = document.createElement('input');
  inp.className = 'form-input';
  inp.type = 'text';
  inp.id = lbl.getAttribute('for');
  inp.dataset.name = name;   /* used by save handler to query fields */
  inp.value = value;
  if (required) inp.required = true;
  if (listId)   inp.setAttribute('list', listId);

  wrap.appendChild(lbl);
  wrap.appendChild(inp);
  return wrap;
}

/** Create a small action button with an optional aria-label. */
function makeActionBtn(text, modifierClass, ariaLabel) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'action-btn ' + modifierClass;
  btn.textContent = text;
  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  return btn;
}

/* ══════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════ */
checkAuth();
