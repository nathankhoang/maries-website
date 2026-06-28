/* ══════════════════════════════════════════════════════
   AuD Viet Translations — Admin CMS
   Plain vanilla JS. No frameworks, no build step.
   All phrase text injected via .textContent only.
   ══════════════════════════════════════════════════════ */

'use strict';

/* ── Category display labels + ordering ────────────── */
const CATEGORY_LABELS = {
  pronouns:  'Pronouns',
  greetings: 'Greetings',
  history:   'History',
  testing:   'Testing',
  diagnoses: 'Diagnoses',
  results:   'Results & Recs',
};
const CATEGORY_ORDER = ['pronouns', 'greetings', 'history', 'testing', 'diagnoses', 'results'];

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
const openGroups = new Set();   // categories the user has expanded

/* Add-form controls (built dynamically). */
let addCatPicker = null;
let addSubPicker = null;
let addAudio     = null;

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

/* ══════════════════════════════════════════════════════
   STATUS HELPER
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
  searchInput.value = '';
  searchQuery = '';
  mountAddControls();
  renderPhraseList();
}

function handleUnauthorized() {
  phrases     = [];
  editingId   = null;
  deletingId  = null;
  searchQuery = '';
  openGroups.clear();
  showLoginView();
  showLoginError('Your session expired. Please log in again.');
}

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

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (_) { /* ignore */ }
  phrases     = [];
  editingId   = null;
  deletingId  = null;
  searchQuery = '';
  openGroups.clear();
  logoutBtn.disabled = false;
  showLoginView();
});

/* ══════════════════════════════════════════════════════
   CATEGORY / SUBSECTION PICKER  (choose existing or add new)
   ══════════════════════════════════════════════════════ */
function distinctCategories() {
  return [...new Set(phrases.map(p => p.category).filter(Boolean))].sort();
}
function distinctSubsections() {
  return [...new Set(phrases.map(p => p.subsection).filter(Boolean))].sort();
}

function makePicker(kind, value) {
  const isCat = kind === 'category';
  const wrap = document.createElement('div');
  wrap.className = 'picker';

  const select = document.createElement('select');
  select.className = 'form-input picker__select';
  select.appendChild(new Option(isCat ? 'Choose a category…' : '— none —', ''));

  const values = isCat ? distinctCategories() : distinctSubsections();
  values.forEach(v => select.appendChild(new Option(isCat ? displayCategory(v) : v, v)));
  if (value && !values.includes(value)) {
    select.appendChild(new Option(isCat ? displayCategory(value) : value, value));
  }
  select.appendChild(new Option(isCat ? '➕ Add new category…' : '➕ Add new subsection…', '__new__'));

  const input = document.createElement('input');
  input.className = 'form-input picker__new';
  input.type = 'text';
  input.placeholder = isCat ? 'New category name' : 'New subsection name';
  input.hidden = true;

  if (value) select.value = value;

  select.addEventListener('change', () => {
    if (select.value === '__new__') { input.hidden = false; input.focus(); }
    else { input.hidden = true; input.value = ''; }
  });

  wrap.appendChild(select);
  wrap.appendChild(input);
  wrap.getValue = () => (select.value === '__new__' ? input.value.trim() : select.value.trim());
  return wrap;
}

/* ══════════════════════════════════════════════════════
   AUDIO UPLOAD  (Marie's own recordings → Vercel Blob)
   ══════════════════════════════════════════════════════ */
async function uploadAudio(file) {
  const res = await fetch('/api/admin/audio?filename=' + encodeURIComponent(file.name), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Session expired.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed.');
  return data.url;
}
async function deleteAudio(url) {
  try {
    await fetch('/api/admin/audio?url=' + encodeURIComponent(url), {
      method: 'DELETE', credentials: 'same-origin',
    });
  } catch (_) { /* non-fatal */ }
}

/* A self-contained audio control: shows a player + remove when a recording
   exists, otherwise an upload button. Exposes getValue()/isUploading(). */
function makeAudioField(initialUrl) {
  let url = initialUrl || null;
  let uploading = false;
  const wrap = document.createElement('div');
  wrap.className = 'audio-field';

  function render() {
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    if (url) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = url;
      audio.className = 'audio-field__player';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'action-btn action-btn--cancel';
      remove.textContent = 'Remove audio';
      remove.addEventListener('click', () => {
        const old = url;
        url = null;
        render();
        deleteAudio(old);
      });
      wrap.appendChild(audio);
      wrap.appendChild(remove);
    } else {
      const label = document.createElement('label');
      label.className = 'audio-field__upload';
      label.textContent = uploading ? 'Uploading…' : '🎙 Choose audio file';
      if (uploading) label.classList.add('is-uploading');
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.className = 'audio-field__input';
      input.disabled = uploading;
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        uploading = true; render();
        try {
          url = await uploadAudio(file);
          uploading = false; render();
        } catch (e) {
          uploading = false; render();
          const err = document.createElement('span');
          err.className = 'audio-field__error';
          err.textContent = e.message || 'Upload failed.';
          wrap.appendChild(err);
        }
      });
      label.appendChild(input);
      wrap.appendChild(label);
    }
  }
  render();
  wrap.getValue = () => url;
  wrap.isUploading = () => uploading;
  return wrap;
}

/* Wrap a custom control in a labelled form field. */
function wrapField(labelText, controlEl) {
  const field = document.createElement('div');
  field.className = 'form-field';
  const lbl = document.createElement('label');
  lbl.className = 'form-label';
  lbl.textContent = labelText;
  field.appendChild(lbl);
  field.appendChild(controlEl);
  return field;
}

/* ══════════════════════════════════════════════════════
   ADD-PHRASE CONTROLS (pickers + audio) — (re)mounted on data change
   ══════════════════════════════════════════════════════ */
function mountAddControls() {
  const catBox   = document.getElementById('add-category-picker');
  const subBox   = document.getElementById('add-subsection-picker');
  const audioBox = document.getElementById('add-audio');
  if (!catBox || !subBox || !audioBox) return;
  addCatPicker = makePicker('category', '');
  addSubPicker = makePicker('subsection', '');
  addAudio     = makeAudioField(null);
  catBox.replaceChildren(addCatPicker);
  subBox.replaceChildren(addSubPicker);
  audioBox.replaceChildren(addAudio);
}

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const category = addCatPicker ? addCatPicker.getValue() : '';
  const vi       = document.getElementById('add-vi').value.trim();

  if (!category) { showStatus(addStatus, 'Category is required.', true); return; }
  if (!vi)       { showStatus(addStatus, 'Vietnamese phrase is required.', true); return; }
  if (addAudio && addAudio.isUploading()) {
    showStatus(addStatus, 'Please wait for the audio to finish uploading.', true);
    return;
  }

  const body = { category, vi };
  const subsection = addSubPicker ? addSubPicker.getValue() : '';
  const en        = document.getElementById('add-en').value.trim();
  const note      = document.getElementById('add-note').value.trim();
  const audioUrl  = addAudio ? addAudio.getValue() : null;
  if (subsection) body.subsection = subsection;
  if (en)         body.en = en;
  if (note)       body.note = note;
  if (audioUrl)   body.audio_url = audioUrl;

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
    openGroups.add(category);
    document.getElementById('add-en').value = '';
    document.getElementById('add-vi').value = '';
    document.getElementById('add-note').value = '';
    mountAddControls();
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
  editingId   = null;
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
   RENDER PHRASE LIST — collapsible category → subsection → rows
   ══════════════════════════════════════════════════════ */
function renderPhraseList() {
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

  /* category → Map(subsection → phrase[]) */
  const groups = new Map();
  filtered.forEach(p => {
    const cat = p.category || '';
    const sub = p.subsection || '';
    if (!groups.has(cat)) groups.set(cat, new Map());
    const subMap = groups.get(cat);
    if (!subMap.has(sub)) subMap.set(sub, []);
    subMap.get(sub).push(p);
  });

  /* Order: known categories first, then the rest alphabetically. */
  const cats = [...groups.keys()];
  const ordered = [
    ...CATEGORY_ORDER.filter(c => groups.has(c)),
    ...cats.filter(c => !CATEGORY_ORDER.includes(c)).sort(),
  ];
  const searching = !!searchQuery.trim();

  ordered.forEach(cat => {
    const subMap = groups.get(cat);
    const totalInCat = [...subMap.values()].reduce((n, arr) => n + arr.length, 0);

    const details = document.createElement('details');
    details.className = 'phrase-group';
    details.open = searching || openGroups.has(cat);
    details.addEventListener('toggle', () => {
      if (details.open) openGroups.add(cat); else openGroups.delete(cat);
    });

    const summary = document.createElement('summary');
    summary.className = 'phrase-group__header';
    const catTitle = document.createElement('h3');
    catTitle.className = 'phrase-group__title';
    catTitle.textContent = displayCategory(cat);
    const catCount = document.createElement('span');
    catCount.className = 'phrase-group__count';
    catCount.textContent = totalInCat + (totalInCat === 1 ? ' phrase' : ' phrases');
    summary.appendChild(catTitle);
    summary.appendChild(catCount);
    details.appendChild(summary);

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
        details.appendChild(subHeader);
      }
      subPhrases.forEach(p => {
        if (editingId === p.id)        details.appendChild(buildEditRow(p));
        else if (deletingId === p.id)  details.appendChild(buildConfirmRow(p));
        else                           details.appendChild(buildPhraseRow(p));
      });
    });

    phraseList.appendChild(details);
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

  if (p.audio_url) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = p.audio_url;
    audio.className = 'phrase-row__audio';
    content.appendChild(audio);
  }

  const actions = document.createElement('div');
  actions.className = 'phrase-row__actions';

  const editBtn = makeActionBtn('Edit', 'action-btn--edit', 'Edit phrase: ' + (p.en || p.vi));
  editBtn.addEventListener('click', () => {
    editingId  = p.id;
    deletingId = null;
    openGroups.add(p.category || '');
    renderPhraseList();
  });

  const delBtn = makeActionBtn('Delete', 'action-btn--delete', 'Delete phrase: ' + (p.en || p.vi));
  delBtn.addEventListener('click', () => {
    deletingId = p.id;
    editingId  = null;
    openGroups.add(p.category || '');
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

  const fieldsGrid = document.createElement('div');
  fieldsGrid.className = 'phrase-row__edit-fields';

  const catPicker  = makePicker('category', p.category || '');
  const subPicker  = makePicker('subsection', p.subsection || '');
  const enInput    = makeEditField('English', 'en', p.en || '', false);
  const viInput    = makeEditField('Vietnamese *', 'vi', p.vi || '', true);
  const noteInput  = makeEditField('Note', 'note', p.note || '', false);
  const audioField = makeAudioField(p.audio_url || null);

  fieldsGrid.appendChild(wrapField('Category *', catPicker));
  fieldsGrid.appendChild(wrapField('Subsection', subPicker));
  fieldsGrid.appendChild(enInput);
  fieldsGrid.appendChild(viInput);
  fieldsGrid.appendChild(noteInput);
  fieldsGrid.appendChild(wrapField("Audio — Marie's recording", audioField));

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
    const catVal = catPicker.getValue();
    const viVal  = viInput.querySelector('[data-name="vi"]').value.trim();

    if (!catVal) { showStatus(editStatus, 'Category is required.', true); return; }
    if (!viVal)  { showStatus(editStatus, 'Vietnamese is required.', true); return; }
    if (audioField.isUploading()) {
      showStatus(editStatus, 'Please wait for the audio to finish uploading.', true);
      return;
    }

    const body = {
      id: p.id,
      category:   catVal,
      vi:         viVal,
      subsection: subPicker.getValue() || null,
      en:         enInput.querySelector('[data-name="en"]').value.trim() || null,
      note:       noteInput.querySelector('[data-name="note"]').value.trim() || null,
      audio_url:  audioField.getValue() || null,
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
      openGroups.add(data.phrase.category || '');
      mountAddControls();
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

  requestAnimationFrame(() => {
    const firstSelect = fieldsGrid.querySelector('select');
    if (firstSelect) firstSelect.focus();
  });

  return row;
}

/* ── Inline delete confirm row ─────────────────────── */
function buildConfirmRow(p) {
  const row = document.createElement('div');
  row.className = 'phrase-row phrase-row--confirming';
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
      if (!res.ok && res.status !== 404) {
        deletingId = null;
        renderPhraseList();
        showStatus(listStatus, 'Could not delete phrase.', true);
        return;
      }
      if (p.audio_url) deleteAudio(p.audio_url);
      phrases    = phrases.filter(x => x.id !== p.id);
      deletingId = null;
      mountAddControls();
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

  requestAnimationFrame(() => noBtn.focus());
  return row;
}

/* ══════════════════════════════════════════════════════
   SMALL DOM HELPERS
   ══════════════════════════════════════════════════════ */
function makeEditField(labelText, name, value, required) {
  const wrap = document.createElement('div');
  wrap.className = 'form-field';
  const lbl = document.createElement('label');
  lbl.className = 'form-label';
  lbl.textContent = labelText;
  const id = 'edit-' + name + '-' + Math.random().toString(36).slice(2);
  lbl.setAttribute('for', id);
  const inp = document.createElement('input');
  inp.className = 'form-input';
  inp.type = 'text';
  inp.id = id;
  inp.dataset.name = name;
  inp.value = value;
  if (required) inp.required = true;
  wrap.appendChild(lbl);
  wrap.appendChild(inp);
  return wrap;
}

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
