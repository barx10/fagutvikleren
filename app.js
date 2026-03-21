// --- Models config ---
var MODELS = {
  'gemini-2.5-flash-lite': { provider: 'google', label: 'Gemini 2.5 Flash Lite' },
  'gemini-3-flash-preview': { provider: 'google', label: 'Gemini 3 Flash Preview' },
  'gemini-3.1-flash-lite-preview': { provider: 'google', label: 'Gemini 3.1 Flash Lite Preview' },
  'gpt-5-mini': { provider: 'openai', label: 'GPT-5 mini' },
  'gpt-5.4-nano': { provider: 'openai', label: 'GPT-5.4 nano' },
  'gpt-5.4-mini': { provider: 'openai', label: 'GPT-5.4 mini' },
};

// --- Modals & settings ---
function openModal(id) {
  document.getElementById(id).classList.add('visible');
  if (id === 'key-modal') loadSettings();
}
function closeModal(id) {
  document.getElementById(id).classList.remove('visible');
}
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('visible');
  });
});

function getKey(provider) {
  return localStorage.getItem('laerbar_' + provider + '_key') || '';
}
function getSelectedModel() {
  return localStorage.getItem('laerbar_model') || '';
}

function loadSettings() {
  var googleKey = getKey('google');
  var openaiKey = getKey('openai');
  var selectedModel = getSelectedModel();

  document.getElementById('google-key-input').value = googleKey;
  document.getElementById('openai-key-input').value = openaiKey;

  updateProviderStatus('google', googleKey);
  updateProviderStatus('openai', openaiKey);

  updateModelStates();

  if (selectedModel) {
    var radio = document.querySelector('input[name="model"][value="' + selectedModel + '"]');
    if (radio && !radio.disabled) radio.checked = true;
  }

  var audience = localStorage.getItem('laerbar_audience') || 'voksen';
  var audRadio = document.querySelector('input[name="audience"][value="' + audience + '"]');
  if (audRadio) audRadio.checked = true;
}

function updateProviderStatus(provider, key) {
  var el = document.getElementById(provider + '-key-status');
  if (key) {
    el.className = 'key-status ok';
    el.textContent = 'Nokkel lagret (' + key.slice(0, 6) + '...)';
  } else {
    el.className = 'key-status missing';
    el.textContent = 'Ingen nokkel lagret';
  }
}

function updateModelStates() {
  var googleKey = document.getElementById('google-key-input').value.trim();
  var openaiKey = document.getElementById('openai-key-input').value.trim();

  document.querySelectorAll('#google-models input[type="radio"]').forEach(function(r) {
    r.disabled = !googleKey;
    r.closest('.model-option').classList.toggle('disabled', !googleKey);
  });
  document.querySelectorAll('#openai-models input[type="radio"]').forEach(function(r) {
    r.disabled = !openaiKey;
    r.closest('.model-option').classList.toggle('disabled', !openaiKey);
  });
}

document.addEventListener('input', function(e) {
  if (e.target.id === 'google-key-input' || e.target.id === 'openai-key-input') {
    updateModelStates();
  }
});

function saveSettings() {
  var googleKey = document.getElementById('google-key-input').value.trim();
  var openaiKey = document.getElementById('openai-key-input').value.trim();
  var selectedRadio = document.querySelector('input[name="model"]:checked');

  if (googleKey) localStorage.setItem('laerbar_google_key', googleKey);
  else localStorage.removeItem('laerbar_google_key');

  if (openaiKey) localStorage.setItem('laerbar_openai_key', openaiKey);
  else localStorage.removeItem('laerbar_openai_key');

  if (selectedRadio) localStorage.setItem('laerbar_model', selectedRadio.value);

  var audienceRadio = document.querySelector('input[name="audience"]:checked');
  if (audienceRadio) localStorage.setItem('laerbar_audience', audienceRadio.value);

  closeModal('key-modal');
}

function clearKey(provider) {
  localStorage.removeItem('laerbar_' + provider + '_key');
  document.getElementById(provider + '-key-input').value = '';
  updateProviderStatus(provider, '');
  updateModelStates();

  // Uncheck models for this provider if selected
  var selectedRadio = document.querySelector('input[name="model"]:checked');
  if (selectedRadio && MODELS[selectedRadio.value] && MODELS[selectedRadio.value].provider === provider) {
    selectedRadio.checked = false;
    localStorage.removeItem('laerbar_model');
  }
}


function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Input mode switching ---
var currentMode = 'fil';

document.querySelector('.input-tabs').addEventListener('click', function(e) {
  if (!e.target.matches('.input-tab')) return;
  var mode = e.target.dataset.mode;
  currentMode = mode;
  document.querySelectorAll('.input-tab').forEach(function(t) { t.classList.remove('active'); });
  e.target.classList.add('active');
  document.querySelectorAll('.input-mode').forEach(function(m) { m.classList.remove('active'); });
  document.getElementById('mode-' + mode).classList.add('active');
  document.getElementById('error-msg').textContent = '';
  updateGenerateBtn();
});

function updateGenerateBtn() {
  var btn = document.getElementById('generate-btn');
  if (currentMode === 'fil') {
    btn.disabled = !selectedFile;
  } else if (currentMode === 'tekst') {
    btn.disabled = !document.getElementById('paste-input').value.trim();
  } else if (currentMode === 'lenke') {
    btn.disabled = !document.getElementById('url-input').value.trim();
  }
}

document.getElementById('paste-input').addEventListener('input', updateGenerateBtn);
document.getElementById('url-input').addEventListener('input', updateGenerateBtn);

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
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    errEl.textContent = 'Filen er for stor. Maks 20MB.';
    return;
  }
  selectedFile = file;
  document.getElementById('file-chosen').textContent =
    file.name + ' (' + (file.size / 1024).toFixed(0) + ' KB)';
  document.getElementById('generate-btn').disabled = false;
  errEl.textContent = '';
}

// --- Extract text from file ---
async function extractTextFromFile(file) {
  const mimeType = file.type || detectMime(file.name);
  const arrayBuffer = await file.arrayBuffer();

  if (mimeType === 'application/pdf') {
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(function(item) { return item.str; }).join(' '));
    }
    return pages.join('\n\n');
  } else {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }
}

// --- Fetch text from URL ---
async function fetchTextFromUrl(url) {
  const res = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kunne ikke hente artikkelen.');
  return data.text;
}

// --- Generate ---
async function generate() {
  const errEl = document.getElementById('error-msg');
  const btn = document.getElementById('generate-btn');
  errEl.textContent = '';

  const model = getSelectedModel();
  if (!model || !MODELS[model]) {
    errEl.textContent = 'Velg en modell i innstillinger forst.';
    openModal('key-modal');
    return;
  }

  const provider = MODELS[model].provider;
  const apiKey = getKey(provider);
  if (!apiKey) {
    errEl.textContent = 'Legg inn API-nokkel for ' + (provider === 'google' ? 'Google Gemini' : 'OpenAI') + ' i innstillinger.';
    openModal('key-modal');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Analyserer…';
  document.getElementById('spinner').classList.add('visible');

  try {
    let text;

    if (currentMode === 'fil') {
      if (!selectedFile) return;
      text = await extractTextFromFile(selectedFile);
    } else if (currentMode === 'tekst') {
      text = document.getElementById('paste-input').value;
    } else if (currentMode === 'lenke') {
      var url = document.getElementById('url-input').value.trim();
      if (!url) throw new Error('Legg inn en lenke.');
      text = await fetchTextFromUrl(url);
    }

    if (!text || !text.trim()) throw new Error('Kunne ikke hente tekst. Sjekk at kilden inneholder lesbar tekst.');

    const body = { text: text, apiKey: apiKey, model: model, audience: localStorage.getItem('laerbar_audience') || 'voksen' };

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
    { id: 'argumentasjon', label: 'Argumentasjon' },
    { id: 'ordforklaring', label: 'Ordforklaring' },
    { id: 'tverrfaglig', label: 'Tverrfaglig' },
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
  renderArgumentasjon(data.argumentasjon);
  renderOrdforklaring(data.ordforklaring);
  renderTverrfaglig(data.tverrfaglig);
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

// --- Argumentasjon ---
function renderArgumentasjon(items) {
  if (!items || !items.length) return;
  const sec = document.getElementById('argumentasjon');

  const secTitle = document.createElement('div');
  secTitle.className = 'sec-title';
  secTitle.textContent = 'Argumentasjon';
  const secSub = document.createElement('div');
  secSub.className = 'sec-sub';
  secSub.textContent = 'Hovedpåstander med argumenter, evidens og motargumenter.';
  sec.appendChild(secTitle);
  sec.appendChild(secSub);

  const grid = document.createElement('div');
  grid.className = 'begrep-grid';

  items.forEach(function(item) {
    const card = document.createElement('div');
    card.className = 'begrep-card';

    const title = document.createElement('h3');
    title.className = 'begrep-title';
    title.textContent = item.pastand;

    card.appendChild(title);

    if (item.argumenter && item.argumenter.length) {
      const ul = document.createElement('ul');
      ul.className = 'arg-list';
      item.argumenter.forEach(function(arg) {
        const li = document.createElement('li');
        li.textContent = arg;
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }

    if (item.evidens) {
      const evidens = document.createElement('div');
      evidens.className = 'begrep-forklaring';
      evidens.textContent = item.evidens;
      card.appendChild(evidens);
    }

    if (item.motargument) {
      const mot = document.createElement('div');
      mot.className = 'begrep-sammenheng';
      mot.textContent = 'Motargument: ' + item.motargument;
      card.appendChild(mot);
    }

    grid.appendChild(card);
  });

  sec.appendChild(grid);
}

// --- Ordforklaring ---
function renderOrdforklaring(items) {
  if (!items || !items.length) return;
  const sec = document.getElementById('ordforklaring');

  const secTitle = document.createElement('div');
  secTitle.className = 'sec-title';
  secTitle.textContent = 'Ordforklaring';
  const secSub = document.createElement('div');
  secSub.className = 'sec-sub';
  secSub.textContent = 'Fremmedord og fagtermer fra teksten.';
  sec.appendChild(secTitle);
  sec.appendChild(secSub);

  const grid = document.createElement('div');
  grid.className = 'begrep-grid';

  items.forEach(function(item) {
    const card = document.createElement('div');
    card.className = 'begrep-card';

    const title = document.createElement('div');
    title.className = 'begrep-title';
    title.textContent = item.ord;

    const forklaring = document.createElement('div');
    forklaring.className = 'begrep-forklaring';
    forklaring.textContent = item.forklaring;

    card.appendChild(title);
    card.appendChild(forklaring);

    if (item.eksempel) {
      const eksempel = document.createElement('div');
      eksempel.className = 'begrep-sammenheng';
      eksempel.textContent = '\u00ab' + item.eksempel + '\u00bb';
      card.appendChild(eksempel);
    }

    grid.appendChild(card);
  });

  sec.appendChild(grid);
}

// --- Tverrfaglig ---
function renderTverrfaglig(items) {
  if (!items || !items.length) return;
  const sec = document.getElementById('tverrfaglig');

  const secTitle = document.createElement('div');
  secTitle.className = 'sec-title';
  secTitle.textContent = 'Tverrfaglig';
  const secSub = document.createElement('div');
  secSub.className = 'sec-sub';
  secSub.textContent = 'Koblinger til andre fagfelt.';
  sec.appendChild(secTitle);
  sec.appendChild(secSub);

  const grid = document.createElement('div');
  grid.className = 'begrep-grid';

  items.forEach(function(item) {
    const card = document.createElement('div');
    card.className = 'begrep-card';

    const title = document.createElement('h3');
    title.className = 'begrep-title';
    title.textContent = item.begrep + ' \u2192 ' + item.fagfelt;

    const parallell = document.createElement('div');
    parallell.className = 'begrep-forklaring';
    parallell.textContent = item.parallell;

    card.appendChild(title);
    card.appendChild(parallell);

    if (item.innsikt) {
      const innsikt = document.createElement('div');
      innsikt.className = 'begrep-sammenheng';
      innsikt.textContent = item.innsikt;
      card.appendChild(innsikt);
    }

    grid.appendChild(card);
  });

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

document.addEventListener('DOMContentLoaded', () => {
  const tabIds = ['flashcards','sammendrag','sporsmal','argumentasjon','ordforklaring','tverrfaglig'];
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
