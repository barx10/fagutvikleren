// --- Modals & API key ---
function openModal(id) {
  document.getElementById(id).classList.add('visible');
  if (id === 'key-modal') updateKeyStatus();
}
function closeModal(id) {
  document.getElementById(id).classList.remove('visible');
}
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('visible');
  });
});

function getApiKey() {
  return localStorage.getItem('gemini_api_key') || '';
}
function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return;
  localStorage.setItem('gemini_api_key', key);
  updateKeyStatus();
}
function clearApiKey() {
  localStorage.removeItem('gemini_api_key');
  document.getElementById('api-key-input').value = '';
  updateKeyStatus();
}
function updateKeyStatus() {
  const el = document.getElementById('key-status');
  const key = getApiKey();
  if (key) {
    el.className = 'key-status ok';
    el.textContent = 'Nokkel lagret (' + key.slice(0, 6) + '...)';
    document.getElementById('api-key-input').value = key;
  } else {
    el.className = 'key-status missing';
    el.textContent = 'Ingen nokkel lagret';
  }
}

// Show key modal on first visit if no key
if (!getApiKey()) {
  window.addEventListener('DOMContentLoaded', () => openModal('key-modal'));
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- File upload ---
let selectedFile = null;

document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) setFile(file);
});

const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

function detectMime(name) {
  return name.endsWith('.pdf') ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function setFile(file) {
  const allowed = ['application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const mime = file.type || detectMime(file.name);
  const errEl = document.getElementById('error-msg');
  if (!allowed.includes(mime)) {
    errEl.textContent = 'Kun PDF og DOCX støttes.';
    return;
  }
  const isPdf = mime === 'application/pdf';
  const maxSize = isPdf ? 3 * 1024 * 1024 : 20 * 1024 * 1024;
  if (file.size > maxSize) {
    errEl.textContent = isPdf
      ? 'PDF-filen er for stor. Maks 3MB.'
      : 'DOCX-filen er for stor. Maks 20MB.';
    return;
  }
  selectedFile = file;
  document.getElementById('file-chosen').textContent =
    file.name + ' (' + (file.size / 1024).toFixed(0) + ' KB)';
  document.getElementById('generate-btn').disabled = false;
  errEl.textContent = '';
}

// --- Generate ---
async function generate() {
  if (!selectedFile) return;
  const errEl = document.getElementById('error-msg');
  const btn = document.getElementById('generate-btn');
  errEl.textContent = '';

  const apiKey = getApiKey();
  if (!apiKey) {
    errEl.textContent = 'Du ma legge inn en Gemini API-nokkel forst.';
    openModal('key-modal');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Analyserer…';
  document.getElementById('spinner').classList.add('visible');

  try {
    const mimeType = selectedFile.type || detectMime(selectedFile.name);
    let body;

    if (mimeType === 'application/pdf') {
      const arrayBuffer = await selectedFile.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const base64 = btoa(binary);
      body = { mimeType, size: selectedFile.size, data: base64, apiKey };
    } else {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      body = { mimeType, size: selectedFile.size, text: result.value, apiKey };
    }

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Noe gikk galt');
    showResult(data);
  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false;
  } finally {
    btn.textContent = 'Generer læringsverktøy';
    document.getElementById('spinner').classList.remove('visible');
  }
}

// --- Result view ---
function showResult(data) {
  document.getElementById('upload-view').style.display = 'none';
  document.getElementById('result-view').classList.add('visible');
  document.getElementById('page-title').textContent = data.title || 'Læringsverktøy';
  document.getElementById('page-sub').textContent = data.subject || '';

  const actions = document.getElementById('header-actions');
  while (actions.firstChild) actions.removeChild(actions.firstChild);
  const dlBtn = document.createElement('button');
  dlBtn.className = 'btn-outline';
  dlBtn.textContent = 'Last ned HTML';
  dlBtn.addEventListener('click', downloadHTML);
  const restartBtn = document.createElement('button');
  restartBtn.className = 'btn-outline';
  restartBtn.textContent = 'Start på nytt';
  restartBtn.addEventListener('click', () => location.reload());
  actions.appendChild(dlBtn);
  actions.appendChild(restartBtn);

  window._resultData = data;
  renderTabs(data);
}

function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}

function renderTabs(data) {
  const tabs = [
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'sammendrag', label: 'Sammendrag' },
    { id: 'sporsmal', label: 'Spørsmål & Svar' },
    { id: 'utfordring', label: 'Utfordring' },
    { id: 'nokkelBegreper', label: 'Nøkkelbegreper' },
    { id: 'strategi', label: 'Strategi' },
  ];

  const nav = document.getElementById('tab-nav');
  const content = document.getElementById('tab-content');
  nav.innerHTML = '';
  content.innerHTML = '';

  tabs.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    if (i === 0) btn.classList.add('active');
    btn.addEventListener('click', () => showSection(tab.id, btn));
    nav.appendChild(btn);

    const sec = document.createElement('div');
    sec.className = 'section' + (i === 0 ? ' active' : '');
    sec.id = tab.id;
    content.appendChild(sec);
  });

  renderFlashcards(data.flashcards);
  renderSammendrag(data.sammendrag);
  renderQA(data.qa);
  renderUtfordring(data.utfordring);
  renderNokkelBegreper(data.nokkelBegreper);
  renderStrategi(data.strategi);
}

// --- Flashcards ---
let _fcCards = [], fcFiltered = [], fcCur = 0, fcFlipped = false;

function renderFlashcards(cards) {
  _fcCards = cards;
  fcFiltered = [...cards];
  fcCur = 0;
  fcFlipped = false;

  const catLabels = { kjerne: 'Kjerne', fakta: 'Fakta', begrep: 'Begrep', eksempel: 'Eksempel' };
  const cats = [...new Set(cards.map(c => c.cat))];
  const sec = document.getElementById('flashcards');

  sec.innerHTML = `
    <div class="sec-title">Flashcards</div>
    <div class="sec-sub">Klikk for å snu. Øv høyt.</div>
    <div class="ftabs" id="fc-filters">
      <button class="ftab active" data-cat="alle">Alle</button>
    </div>
    <div class="pbar-bg"><div class="pbar" id="fcpb" style="width:0%"></div></div>
    <div class="fc-hint" id="fchint">Klikk for å snu</div>
    <div class="fc-wrap">
      <div class="card" id="flashcard">
        <div class="face front">
          <div class="clabel" id="fclabel"></div>
          <div class="cbadge" id="fcbadge"></div>
          <div class="ctext" id="fcfront"></div>
        </div>
        <div class="face back">
          <div class="clabel">Svar</div>
          <div class="ctext" id="fcback"></div>
        </div>
      </div>
    </div>
    <div class="cnav">
      <button id="fc-prev">← Forrige</button>
      <span class="ccount" id="fccount"></span>
      <button id="fc-next">Neste →</button>
    </div>
  `;

  const filters = document.getElementById('fc-filters');
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'ftab';
    btn.dataset.cat = cat;
    btn.textContent = catLabels[cat] || cat;
    filters.appendChild(btn);
  });

  filters.addEventListener('click', e => {
    if (!e.target.matches('.ftab')) return;
    filters.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    const cat = e.target.dataset.cat;
    fcFiltered = cat === 'alle' ? [..._fcCards] : _fcCards.filter(c => c.cat === cat);
    fcCur = 0;
    fcUpdate();
  });

  document.getElementById('flashcard').addEventListener('click', fcFlip);
  document.getElementById('fc-next').addEventListener('click', () => { fcCur = (fcCur + 1) % fcFiltered.length; fcUpdate(); });
  document.getElementById('fc-prev').addEventListener('click', () => { fcCur = (fcCur - 1 + fcFiltered.length) % fcFiltered.length; fcUpdate(); });

  fcUpdate();
}

function fcUpdate() {
  if (!fcFiltered.length) return;
  const c = fcFiltered[fcCur];
  const catLabels = { kjerne: 'Kjerne', fakta: 'Fakta', begrep: 'Begrep', eksempel: 'Eksempel' };
  document.getElementById('fcfront').textContent = c.front;
  document.getElementById('fcbadge').textContent = catLabels[c.cat] || c.cat;
  document.getElementById('fcback').textContent = c.back;
  document.getElementById('fclabel').textContent = (fcCur + 1) + ' / ' + fcFiltered.length;
  document.getElementById('fccount').textContent = (fcCur + 1) + ' / ' + fcFiltered.length;
  document.getElementById('fcpb').style.width = ((fcCur + 1) / fcFiltered.length * 100) + '%';
  document.getElementById('flashcard').classList.remove('flipped');
  fcFlipped = false;
  document.getElementById('fchint').textContent = 'Klikk for å snu';
}

function fcFlip() {
  fcFlipped = !fcFlipped;
  document.getElementById('flashcard').classList.toggle('flipped', fcFlipped);
  document.getElementById('fchint').textContent = fcFlipped ? 'Klikk for å snu tilbake' : 'Klikk for å snu';
}

// --- Sammendrag ---
function renderSammendrag(temaer) {
  const sec = document.getElementById('sammendrag');
  sec.innerHTML = '<div class="sec-title">Sammendrag</div><div class="sec-sub">Nøkkelpunkter per tema.</div>';

  temaer.forEach(t => {
    const card = document.createElement('div');
    card.className = 'tema-card';

    const title = document.createElement('div');
    title.className = 'tema-title';
    title.textContent = t.tema;
    card.appendChild(title);

    const ul = document.createElement('ul');
    t.punkter.forEach(p => {
      const li = document.createElement('li');
      li.textContent = p;
      ul.appendChild(li);
    });
    card.appendChild(ul);
    sec.appendChild(card);
  });
}

// --- Q&A ---
function renderQA(qaItems) {
  const sec = document.getElementById('sporsmal');
  sec.innerHTML = '<div class="sec-title">Spørsmål &amp; Svar</div><div class="sec-sub">Si svaret høyt før du slår opp.</div>';

  const grid = document.createElement('div');
  grid.className = 'qa-grid';

  qaItems.forEach((item, i) => {
    const qi = document.createElement('div');
    qi.className = 'qi';
    qi.id = 'qa' + i;

    const qq = document.createElement('div');
    qq.className = 'qq';
    qq.addEventListener('click', () => qi.classList.toggle('open'));

    const qtext = document.createElement('span');
    qtext.className = 'qq-text';
    qtext.textContent = item.sporsmal;

    const qtog = document.createElement('span');
    qtog.className = 'qtog';
    qtog.textContent = '▼';

    qq.appendChild(qtext);
    qq.appendChild(qtog);

    const qaBody = document.createElement('div');
    qaBody.className = 'qa-body';
    qaBody.textContent = item.svar;

    if (item.hint) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '💡 ' + item.hint;
      qaBody.appendChild(hint);
    }

    qi.appendChild(qq);
    qi.appendChild(qaBody);
    grid.appendChild(qi);
  });

  sec.appendChild(grid);
}

// --- Utfordring ---
let _utfordringPool = [], _utfordringTimer = null;

function renderUtfordring(items) {
  _utfordringPool = items;
  const sec = document.getElementById('utfordring');
  sec.innerHTML = '<div class="sec-title">Utfordringsmodus</div><div class="sec-sub">Svar høyt på 60 sekunder, se fasit.</div>';

  const startBtn = document.createElement('button');
  startBtn.className = 'cbtn-all';
  startBtn.textContent = 'Tilfeldig spørsmål';
  startBtn.id = 'start-utfordring';
  startBtn.addEventListener('click', startUtfordring);

  const cq = document.createElement('div');
  cq.className = 'cqdis';
  cq.id = 'cq';

  const timerWrap = document.createElement('div');
  timerWrap.className = 'tbar-wrap';
  timerWrap.id = 'ctimer';
  timerWrap.innerHTML = '<div class="tbar-bg"><div class="tbar" id="cbar"></div></div><div class="tnum" id="csec">60</div>';

  const revBtn = document.createElement('button');
  revBtn.className = 'revbtn';
  revBtn.id = 'crevbtn';
  revBtn.textContent = 'Vis fasit';
  revBtn.addEventListener('click', revealUtfordring);

  const cans = document.createElement('div');
  cans.className = 'cadis';
  cans.id = 'cans';

  sec.appendChild(startBtn);
  sec.appendChild(cq);
  sec.appendChild(timerWrap);
  sec.appendChild(revBtn);
  sec.appendChild(cans);
}

function startUtfordring() {
  clearInterval(_utfordringTimer);
  const item = _utfordringPool[Math.floor(Math.random() * _utfordringPool.length)];
  window._utfordringAnswer = item.svar;

  const cq = document.getElementById('cq');
  cq.className = 'cqdis visible';
  cq.textContent = item.sporsmal;

  document.getElementById('cans').className = 'cadis';
  document.getElementById('crevbtn').className = 'revbtn visible';

  let secs = 60;
  document.getElementById('cbar').style.width = '100%';
  document.getElementById('cbar').className = 'tbar';
  document.getElementById('csec').textContent = '60';
  document.getElementById('ctimer').className = 'tbar-wrap visible';

  _utfordringTimer = setInterval(() => {
    secs--;
    document.getElementById('csec').textContent = secs;
    document.getElementById('cbar').style.width = (secs / 60 * 100) + '%';
    if (secs <= 20) document.getElementById('cbar').className = 'tbar warn';
    if (secs <= 10) document.getElementById('cbar').className = 'tbar danger';
    if (secs <= 0) clearInterval(_utfordringTimer);
  }, 1000);
}

function revealUtfordring() {
  clearInterval(_utfordringTimer);
  const el = document.getElementById('cans');
  el.textContent = window._utfordringAnswer;
  el.className = 'cadis visible';
}

// --- Nøkkelbegreper ---
function renderNokkelBegreper(begreper) {
  const sec = document.getElementById('nokkelBegreper');
  sec.innerHTML = '<div class="sec-title">Nøkkelbegreper</div><div class="sec-sub">Sentrale begreper og sammenhenger.</div>';

  const grid = document.createElement('div');
  grid.className = 'begrep-grid';

  begreper.forEach(b => {
    const card = document.createElement('div');
    card.className = 'begrep-card';

    const title = document.createElement('div');
    title.className = 'begrep-title';
    title.textContent = b.begrep;

    const forklaring = document.createElement('div');
    forklaring.className = 'begrep-forklaring';
    forklaring.textContent = b.forklaring;

    card.appendChild(title);
    card.appendChild(forklaring);

    if (b.sammenheng) {
      const sammenheng = document.createElement('div');
      sammenheng.className = 'begrep-sammenheng';
      sammenheng.textContent = b.sammenheng;
      card.appendChild(sammenheng);
    }

    grid.appendChild(card);
  });

  sec.appendChild(grid);
}

// --- Strategi ---
function renderStrategi(strategi) {
  const sec = document.getElementById('strategi');
  sec.innerHTML = '<div class="sec-title">Strategi</div><div class="sec-sub">Muntlig framføring. Klikk formuleringer for å kopiere.</div>';

  const grid = document.createElement('div');
  grid.className = 'sgrid';

  function makeListCard(tittel, items) {
    const card = document.createElement('div');
    card.className = 'scrd';
    const h3 = document.createElement('h3');
    h3.textContent = tittel;
    const ul = document.createElement('ul');
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    card.appendChild(h3);
    card.appendChild(ul);
    return card;
  }

  grid.appendChild(makeListCard('Posisjonering', strategi.posisjonering));
  grid.appendChild(makeListCard('Tips', strategi.tips));

  const formCard = document.createElement('div');
  formCard.className = 'scrd';
  formCard.style.gridColumn = '1 / -1';
  const formH3 = document.createElement('h3');
  formH3.textContent = 'Forberedte formuleringer';
  const flist = document.createElement('div');
  flist.className = 'flist';

  strategi.formuleringer.forEach(f => {
    const el = document.createElement('div');
    el.className = 'fi';
    el.appendChild(document.createTextNode('«' + f + '»'));
    const ch = document.createElement('span');
    ch.className = 'ch';
    ch.textContent = 'kopier';
    el.appendChild(ch);
    el.addEventListener('click', () => {
      navigator.clipboard.writeText('«' + f + '»').catch(() => {});
      el.style.background = '#d4e8d4';
      setTimeout(() => { el.style.background = ''; }, 700);
    });
    flist.appendChild(el);
  });

  formCard.appendChild(formH3);
  formCard.appendChild(flist);
  grid.appendChild(formCard);
  sec.appendChild(grid);
}

// --- Download standalone HTML ---
async function downloadHTML() {
  const data = window._resultData;
  if (!data) return;

  const cssRes = await fetch('/style.css');
  const css = await cssRes.text();
  const safeTitle = esc(data.title || 'Læringsverktøy');
  const safeSubject = esc(data.subject || '');

  const navHTML = document.getElementById('tab-nav').innerHTML;
  const contentHTML = document.getElementById('tab-content').innerHTML;

  const standaloneJS = `
const _d = ${JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>')};
let _fcCards = _d.flashcards, fcFiltered = [..._d.flashcards], fcCur = 0, fcFlipped = false;
let _utfordringPool = _d.utfordring, _utfordringTimer = null;

function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}

function fcUpdate() {
  if (!fcFiltered.length) return;
  const c = fcFiltered[fcCur];
  const cl = {kjerne:'Kjerne',fakta:'Fakta',begrep:'Begrep',eksempel:'Eksempel'};
  document.getElementById('fcfront').textContent = c.front;
  document.getElementById('fcbadge').textContent = cl[c.cat] || c.cat;
  document.getElementById('fcback').textContent = c.back;
  document.getElementById('fclabel').textContent = (fcCur+1) + ' / ' + fcFiltered.length;
  document.getElementById('fccount').textContent = (fcCur+1) + ' / ' + fcFiltered.length;
  document.getElementById('fcpb').style.width = ((fcCur+1)/fcFiltered.length*100) + '%';
  document.getElementById('flashcard').classList.remove('flipped');
  fcFlipped = false;
  document.getElementById('fchint').textContent = 'Klikk for å snu';
}

function fcFlip() {
  fcFlipped = !fcFlipped;
  document.getElementById('flashcard').classList.toggle('flipped', fcFlipped);
  document.getElementById('fchint').textContent = fcFlipped ? 'Klikk for å snu tilbake' : 'Klikk for å snu';
}

function startUtfordring() {
  clearInterval(_utfordringTimer);
  const item = _utfordringPool[Math.floor(Math.random() * _utfordringPool.length)];
  window._ua = item.svar;
  const cq = document.getElementById('cq');
  cq.className = 'cqdis visible';
  cq.textContent = item.sporsmal;
  document.getElementById('cans').className = 'cadis';
  document.getElementById('crevbtn').className = 'revbtn visible';
  let secs = 60;
  document.getElementById('cbar').style.width = '100%';
  document.getElementById('cbar').className = 'tbar';
  document.getElementById('csec').textContent = '60';
  document.getElementById('ctimer').className = 'tbar-wrap visible';
  _utfordringTimer = setInterval(() => {
    secs--;
    document.getElementById('csec').textContent = secs;
    document.getElementById('cbar').style.width = (secs/60*100) + '%';
    if (secs <= 20) document.getElementById('cbar').className = 'tbar warn';
    if (secs <= 10) document.getElementById('cbar').className = 'tbar danger';
    if (secs <= 0) clearInterval(_utfordringTimer);
  }, 1000);
}

function revealUtfordring() {
  clearInterval(_utfordringTimer);
  const el = document.getElementById('cans');
  el.textContent = window._ua;
  el.className = 'cadis visible';
}

document.addEventListener('DOMContentLoaded', () => {
  const tabIds = ['flashcards','sammendrag','sporsmal','utfordring','nokkelBegreper','strategi'];
  document.querySelectorAll('nav button').forEach((btn, i) => {
    btn.addEventListener('click', () => showSection(tabIds[i], btn));
  });
  const fc = document.getElementById('flashcard');
  if (fc) fc.addEventListener('click', fcFlip);
  const fcNext = document.getElementById('fc-next');
  if (fcNext) fcNext.addEventListener('click', () => { fcCur = (fcCur+1)%fcFiltered.length; fcUpdate(); });
  const fcPrev = document.getElementById('fc-prev');
  if (fcPrev) fcPrev.addEventListener('click', () => { fcCur = (fcCur-1+fcFiltered.length)%fcFiltered.length; fcUpdate(); });
  const filters = document.getElementById('fc-filters');
  if (filters) {
    filters.addEventListener('click', e => {
      if (!e.target.matches('.ftab')) return;
      filters.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      const cat = e.target.dataset.cat;
      fcFiltered = cat === 'alle' ? [..._fcCards] : _fcCards.filter(c => c.cat === cat);
      fcCur = 0; fcUpdate();
    });
  }
  document.querySelectorAll('.qi').forEach(qi => {
    const qq = qi.querySelector('.qq');
    if (qq) qq.addEventListener('click', () => qi.classList.toggle('open'));
  });
  const startBtn = document.getElementById('start-utfordring');
  if (startBtn) startBtn.addEventListener('click', startUtfordring);
  const revBtn = document.getElementById('crevbtn');
  if (revBtn) revBtn.addEventListener('click', revealUtfordring);
  document.querySelectorAll('.fi').forEach(fi => {
    fi.addEventListener('click', () => {
      const text = fi.firstChild ? fi.firstChild.textContent.trim() : '';
      navigator.clipboard.writeText(text).catch(() => {});
      fi.style.background = '#d4e8d4';
      setTimeout(() => { fi.style.background = ''; }, 700);
    });
  });
  fcUpdate();
});
`;

  const parts = [
    '<!DOCTYPE html>',
    '<html lang="no">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>' + safeTitle + '</title>',
    '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">',
    '<style>' + css + '</style>',
    '</head>',
    '<body>',
    '<header><div>',
    '<h1>' + safeTitle + '</h1>',
    '<div style="font-size:.8rem;color:var(--gl);margin-top:4px;opacity:.85;">' + safeSubject + '</div>',
    '</div></header>',
    '<nav id="tab-nav">' + navHTML + '</nav>',
    '<main id="tab-content">' + contentHTML + '</main>',
    '<script>' + standaloneJS + '<' + '/script>',
    '</body>',
    '</html>',
  ];

  const html = parts.join('\n');
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (data.title || 'laeringsverktoy')
    .replace(/[^a-z0-9æøå]/gi, '-')
    .toLowerCase() + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
