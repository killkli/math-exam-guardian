/* ═══════════════════════════════════════════════════════════════
   MATH EXAM BANK — Application Logic
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── State ────────────────────────────────────────────────────
const state = {
  questions: [],
  filtered: [],
  shuffled: false,        // NEW: shuffle flag
  filters: {
    years: new Set(),
    type: 'all',
    difficulty: new Set(),
    concept: 'all',
    quality: 'all',
    search: ''
  },
  view: 'grid',          // 'grid' | 'list'
  page: 0,
  pageSize: 30
};

// ── DOM refs ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const grid      = $('question-grid');
const overlay   = $('modal-overlay');
const modal     = $('modal');
const resCount  = $('result-count');
const emptyEl   = $('empty-state');
const loadMore  = $('load-more-wrap');
const loadMoreBtn = $('load-more');

// ── Sidebar drawer (mobile) ─────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hamburger')?.addEventListener('click', openSidebar);
  document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
});

// ── Init ────────────────────────────────────────────────────
async function init() {
  try {
    const resp = await fetch('data/questions.json');
    const data = await resp.json();
    state.questions = data.questions;
  } catch (e) {
    console.error('Failed to load questions.json', e);
    document.body.innerHTML = '<p style="padding:2rem;text-align:center;color:#ef4444">載入題庫失敗，請確認 data/questions.json 存在。</p>';
    return;
  }

  buildFilterUI();
  bindEvents();
  applyFilters();

  // Stat counter animation
  animateCounter($('stat-total'), state.questions.length);

  // Init Lucide icons after DOM ready
  if (window.lucide) lucide.createIcons();

  // KaTeX auto-render (deferred)
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$',  right: '$',  display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    }
  });
}

// ── Filter UI ───────────────────────────────────────────────
function buildFilterUI() {
  const years = [...new Set(state.questions.map(q => q.year))].sort();
  const diffs = [...new Set(state.questions.map(q => q.difficulty))].sort();

  // Year chips
  const yearContainer = $('filter-year');
  years.forEach(y => {
    const btn = makeChip(String(y), y + '年');
    btn.addEventListener('click', () => toggleSet('years', y, btn));
    yearContainer.appendChild(btn);
  });

  // Difficulty chips — no direct listener; event is handled by delegation listener in bindEvents()
  const diffContainer = $('filter-difficulty');
  diffLabels.forEach(([val, label]) => {
    if (diffs.includes(val)) {
      const btn = makeChip(val, label);
      diffContainer.appendChild(btn);
    }
  });

  // Concept select
  const conceptSelect = $('filter-concept');
  const concepts = getTopConcepts(30);
  concepts.forEach(([concept, count]) => {
    const opt = document.createElement('option');
    opt.value = concept;
    opt.textContent = `${concept} (${count})`;
    conceptSelect.appendChild(opt);
  });
  conceptSelect.addEventListener('change', e => {
    state.filters.concept = e.target.value;
    applyFilters();
  });
}

const diffLabels = [
  ['basic',      '基礎'],
  ['medium',     '中等'],
  ['hard',       '困難'],
  ['difficult',  '最難']
];

function makeChip(val, label) {
  const btn = document.createElement('button');
  btn.className = 'chip';
  btn.dataset.val = val;
  btn.textContent = label;
  return btn;
}

function toggleSet(key, val, btn) {
  const s = state.filters[key];
  if (s.has(val)) { s.delete(val); btn.classList.remove('active'); }
  else             { s.add(val);    btn.classList.add('active');    }
  applyFilters();
}

// ── Filtering ──────────────────────────────────────────────
function applyFilters() {
  const f = state.filters;
  state.filtered = state.questions.filter(q => {
    if (f.years.size && !f.years.has(q.year)) return false;
    if (f.type !== 'all' && q.type !== f.type) return false;
    if (f.difficulty.size && !f.difficulty.has(q.difficulty)) return false;
    if (f.concept !== 'all' && !q.concepts.includes(f.concept)) return false;
    if (f.quality !== 'all') {
      const qs = (q.quality_status || '').toUpperCase();
      if (f.quality === 'PASS' && qs !== 'PASS') return false;
      if (f.quality === 'FIXED' && qs !== 'FIXED') return false;
    }
    if (f.search) {
      const term = f.search.toLowerCase();
      const inText = (q.question || '').toLowerCase().includes(term) ||
                     (q.answer    || '').toLowerCase().includes(term) ||
                     (q.concepts  || []).some(c => c.toLowerCase().includes(term));
      if (!inText) return false;
    }
    return true;
  });

  state.page = 0;
  renderPage();
}

// ── Rendering ───────────────────────────────────────────────
function renderPage() {
  const start = 0;
  const end   = (state.page + 1) * state.pageSize;
  const visible = state.filtered.slice(start, end);

  if (state.page === 0) {
    grid.innerHTML = '';
    grid.className = 'question-grid' + (state.view === 'list' ? ' list-view' : '');
  }

  visible.forEach((q, i) => {
    const card = buildCard(q);
    // Stagger animation
    card.style.animationDelay = `${i * 30}ms`;
    card.classList.add('q-card-animate');
    grid.appendChild(card);
  });

  // Update count
  resCount.textContent = `${state.filtered.length} 筆結果`;

  // Empty state
  emptyEl.style.display = state.filtered.length === 0 ? 'block' : 'none';
  loadMore.style.display = end < state.filtered.length ? 'block' : 'none';

  // Re-render math in new cards
  requestAnimationFrame(() => {
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(grid, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$',  right: '$',  display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    }
  });

  if (window.lucide) lucide.createIcons();
}

function buildCard(q) {
  const card = document.createElement('article');
  card.className = 'q-card';
  card.dataset.id = q.id;

  const diffBadge = diffBadgeClass(q.difficulty);
  const typeLabel = q.type === 'choice' ? '選擇題' : '非選題';
  const answerText = q.type === 'choice' ? `答案：${q.answer}` : '非選題';
  const statusDot = q.quality_status || 'PASS';

  card.innerHTML = `
    <div class="q-status-dot ${statusDot}" title="QA 狀態：${statusDot}"></div>
    <div class="q-card-header">
      <span class="q-id">${q.year}-${q.number}</span>
      <div class="q-badges">
        <span class="badge badge-year">${q.year}年</span>
        <span class="badge badge-type-${q.type}">${typeLabel}</span>
        <span class="badge badge-difficulty-${q.difficulty}">${diffLabel(q.difficulty)}</span>
      </div>
    </div>
    <div class="q-text">${escHtml(q.question)}</div>
    <div class="q-concepts">
      ${(q.concepts || []).slice(0, 3).map(c => `<span class="q-concept-tag">${escHtml(c)}</span>`).join('')}
      ${(q.concepts || []).length > 3 ? `<span class="q-concept-tag">+${q.concepts.length - 3}</span>` : ''}
    </div>
    <div class="q-footer">
      <span class="q-page">p.${q.page_source || '?'}</span>
      <span class="q-answer-preview">${answerText}</span>
    </div>
  `;

  card.addEventListener('click', () => openModal(q));
  return card;
}

function diffLabel(d) {
  const map = { basic: '基礎', medium: '中等', hard: '困難', difficult: '最難' };
  return map[d] || d;
}
function diffBadgeClass(d) {
  return `badge-difficulty-${d}`;
}

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Modal ──────────────────────────────────────────────────
function openModal(q) {
  $('modal-header').innerHTML = `
    <div class="modal-title">${q.year} 年 · 第 ${q.number} 題</div>
    <div class="modal-meta">
      <span class="badge badge-year">${q.year}年</span>
      <span class="badge badge-type-${q.type}">${q.type === 'choice' ? '選擇題' : '非選題'}</span>
      <span class="badge badge-difficulty-${q.difficulty}">${diffLabel(q.difficulty)}</span>
      <span class="badge badge-year">p.${q.page_source || '?'}</span>
      ${(q.quality_status ? `<span class="badge" style="background:#fef9c3;color:#92400e">QA: ${q.quality_status}</span>` : '')}
    </div>
  `;

  let body = '';

  // Question
  body += `<div class="modal-section">
    <div class="modal-section-title">題目</div>
    <div class="modal-question-text">${escHtml(q.question)}</div>
  </div>`;

  // Options (choice only)
  if (q.type === 'choice' && q.options) {
    const opts = q.options;
    const answer = (q.answer || '').toUpperCase().trim();
    body += `<div class="modal-section">
      <div class="modal-section-title">選項</div>
      <div class="options-grid">`;
    for (const [label, text] of Object.entries(opts)) {
      const isCorrect = label.toUpperCase() === answer;
      body += `<div class="option-item${isCorrect ? ' correct' : ''}">
        <span class="option-label">${label}.</span>
        <span>${escHtml(text)}</span>
      </div>`;
    }
    body += `</div></div>`;
  }

  // Essay answer
  if (q.type === 'essay') {
    body += `<div class="modal-section">
      <div class="modal-section-title">答案</div>
      <div class="essay-answer">${escHtml(q.answer || '（非選題，請參考詳解）')}</div>
    </div>`;
  }

  // Figure description
  if (q.figure_desc) {
    body += `<div class="modal-section">
      <div class="modal-section-title">圖形說明</div>
      <div style="background:#f8fafc;padding:12px 16px;border-radius:8px;font-size:14px;color:#64748b;border-left:3px solid #e2e8f0">${escHtml(q.figure_desc)}</div>
    </div>`;
  }

  // Concepts
  if (q.concepts && q.concepts.length) {
    $('modal-footer').innerHTML = `
      <div class="modal-section-title">主題標籤</div>
      <div class="concepts-section">
        ${q.concepts.map(c => `<span class="concept-tag">${escHtml(c)}</span>`).join('')}
      </div>
    `;
  } else {
    $('modal-footer').innerHTML = '';
  }

  $('modal-body').innerHTML = body;

  // Render math in modal
  requestAnimationFrame(() => {
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(modal, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$',  right: '$',  display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    }
  });

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Events ─────────────────────────────────────────────────
function bindEvents() {
  // Search
  const searchInput = $('search-input');
  const searchClear = $('search-clear');
  let searchTimer;
  searchInput.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.search = e.target.value.trim();
      applyFilters();
      searchClear.style.display = e.target.value ? 'flex' : 'none';
    }, 250);
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.filters.search = '';
    applyFilters();
    searchClear.style.display = 'none';
  });

  // Type chips
  $('filter-type').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    $('filter-type').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.filters.type = chip.dataset.val;
    applyFilters();
  });

  // Quality chips
  $('filter-quality').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    $('filter-quality').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.filters.quality = chip.dataset.val;
    applyFilters();
  });

  // Reset
  $('filter-reset').addEventListener('click', resetFilters);
  $('empty-reset')?.addEventListener('click', resetFilters);

  // View toggle
  $('btn-grid').addEventListener('click', () => setView('grid'));
  $('btn-list').addEventListener('click', () => setView('list'));

  // Load more
  loadMoreBtn.addEventListener('click', () => {
    state.page++;
    renderPage();
  });

  // Modal close
  $('modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Difficulty chips delegation
  $('filter-difficulty').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const val = chip.dataset.val;
    toggleSet('difficulty', val, chip);
  });
}

function resetFilters() {
  state.filters.years      = new Set();
  state.filters.type       = 'all';
  state.filters.difficulty = new Set();
  state.filters.concept    = 'all';
  state.filters.quality    = 'all';
  state.filters.search     = '';
  state.shuffled           = false;
  $('search-input').value = '';
  $('search-clear').style.display = 'none';

  // Reset UI chips
  document.querySelectorAll('.filter-chips').forEach(container => {
    container.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('active', c.dataset.val === 'all' || c.dataset.val === 'all');
    });
  });
  $('filter-type').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  $('filter-type').querySelector('[data-val="all"]').classList.add('active');
  $('filter-quality').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  $('filter-quality').querySelector('[data-val="all"]').classList.add('active');
  $('filter-concept').value = 'all';

  // Reset shuffle button
  $('btn-shuffle').classList.remove('active');

  applyFilters();
}

function setView(v) {
  state.view = v;
  $('btn-grid').classList.toggle('active', v === 'grid');
  $('btn-list').classList.toggle('active', v === 'list');
  grid.className = 'question-grid' + (v === 'list' ? ' list-view' : '');
}

// ── Shuffle ───────────────────────────────────────────────
function shuffleCurrent() {
  if (!state.filtered.length) return;
  // Fisher-Yates shuffle
  const arr = [...state.filtered];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  state.filtered = arr;
  state.shuffled = true;
  state.page = 0;

  // Highlight shuffle button
  $('btn-shuffle').classList.add('active');
  // Update result count
  $('result-count').textContent = `${state.filtered.length} 筆結果（已亂序）`;
  renderPage();
}

// ── Print ──────────────────────────────────────────────────
let _currentPrintMode = 'paper';

function openPrintDialog(mode) {
  if (!state.filtered.length) {
    alert('沒有題目可列印，請先設定篩選條件。');
    return;
  }
  _currentPrintMode = mode;
  const title = mode === 'paper' ? '列印題目卷' : '列印答案卷';
  $('print-dialog-title').textContent = `${title}（${state.filtered.length} 題）`;

  const bodyHTML = mode === 'paper'
    ? buildPaperHTML(state.filtered)
    : buildAnswerHTML(state.filtered);

  // Use srcdoc for a self-contained document (avoids sandbox script restrictions)
  const frame = $('print-frame');
  frame.srcdoc = buildPrintDoc(bodyHTML);

  $('print-dialog-overlay').classList.add('open');
  if (window.lucide) lucide.createIcons();
}

function buildPrintDoc(bodyHTML) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Noto Sans TC',sans-serif;padding:28px 36px;color:#1a1a1a;font-size:14px;line-height:1.7}
  .paper-header{text-align:center;border-bottom:2px solid #1a1a1a;padding-bottom:14px;margin-bottom:24px}
  .paper-header h1{font-size:19px;margin-bottom:5px}
  .paper-header p{font-size:12px;color:#555}
  .paper-section{margin-bottom:28px}
  .paper-section-title{font-size:14px;font-weight:bold;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #ddd}
  .print-question{margin-bottom:18px;padding:12px 14px;background:#f8f9fa;border-radius:6px;page-break-inside:avoid}
  .print-q-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}
  .print-q-id{font-weight:bold;color:#2c3e50;font-size:12px}
  .badge{padding:2px 8px;border-radius:10px;color:#fff;font-size:11px;display:inline-block}
  .bg-basic{background:#27ae60}.bg-medium{background:#f39c12}.bg-hard{background:#e74c3c}.bg-hardest{background:#8e44ad}
  .print-question-text{font-size:14px;margin-bottom:9px}
  .print-question-text .katex{font-size:1.05em}
  .print-options{list-style:none}
  .print-options li{display:flex;gap:8px;margin-bottom:4px;align-items:flex-start}
  .print-options li .opt-label{font-weight:bold;min-width:18px}
  .print-figure{margin-top:7px;padding:7px;background:#e8f4f8;border-radius:4px;font-size:12px;color:#2980b9}
  .print-figure::before{content:'📷 '}
  .answer-section{margin-top:36px;padding-top:18px;border-top:2px solid #1a1a1a}
  .answer-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
  .answer-card{border:1px solid #ddd;border-radius:6px;padding:10px 12px}
  .answer-card-title{font-weight:bold;margin-bottom:7px;font-size:12px;color:#2c3e50}
  .answer-row{display:grid;grid-template-columns:26px repeat(5,1fr);gap:3px;align-items:center;margin-bottom:3px}
  .answer-num{font-size:10px;color:#888;text-align:center}
  .answer-cell{text-align:center;font-size:11px;padding:2px}
  .answer-cell.header{font-weight:bold;background:#eee;border-radius:3px}
  .answer-section{margin-top:36px;padding-top:18px;border-top:2px solid #1a1a1a}
  .answer-header{text-align:center;border-bottom:2px solid #1e3a5f;padding-bottom:14px;margin-bottom:24px}
  .answer-header h1{font-size:19px;color:#1e3a5f;margin-bottom:5px}
  .answer-header p{font-size:12px;color:#555}
  .answer-key{margin-top:32px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
  .answer-key h3{background:#f1f5f9;margin:0;padding:10px 16px;font-size:13px;color:#1e3a5f;border-bottom:1px solid #e2e8f0;font-weight:bold}
  .answer-key-row{display:flex;justify-content:space-between;padding:6px 16px;border-bottom:1px solid #f1f5f9;font-size:13px}
  .answer-key-row:last-child{border-bottom:none}
  .answer-key-row span:first-child{color:#64748b}
  .paper-footer{text-align:center;margin-top:36px;font-size:11px;color:#999;padding-top:14px;border-top:1px solid #eee}
</style>
</head>
<body>
${bodyHTML}
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<script>document.addEventListener("DOMContentLoaded",function(){if(typeof renderMathInElement!=="undefined"){renderMathInElement(document.body,{delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],throwOnError:false})}});</script>
</body>
</html>`;
}

function closePrintDialog() {
  $('print-dialog-overlay').classList.remove('open');
}

function doPrint() {
  const frame = $('print-frame');
  const win = frame.contentWindow || frame.contentDocument;
  win.print();
}

function diffLabelPrint(d) {
  const map = { basic: '基礎', medium: '中等', hard: '困難', difficult: '最難' };
  return map[d] || d;
}

function renderMathBlock(text) {
  // Replace $...$ with KaTeX-rendered HTML
  if (typeof katex !== 'undefined') {
    return text.replace(/\$([^$]+)\$/g, (_, expr) => {
      try { return katex.renderToString(expr, { throwOnError: false, displayMode: false }); }
      catch(e) { return `<span class="katex-err">${escHtml(expr)}</span>`; }
    });
  }
  return escHtml(text);
}

function buildPaperHTML(questions) {
  const diffLabel2 = d => ({ basic: '基礎', medium: '中等', hard: '困難', difficult: '最難' }[d] || d);
  const diffColor = d => ({ basic: '#d1fae5', medium: '#fef9c3', hard: '#fee2e2', difficult: '#fee2e2' }[d] || '#f1f5f9');

  const rows = questions.map((q, i) => {
    const num = i + 1;
    const typeLabel = q.type === 'choice' ? '選擇題' : '非選題';
    const fig = q.figure_desc ? `<div class="print-figure-desc">📐 ${escHtml(q.figure_desc)}</div>` : '';

    let opts = '';
    if (q.type === 'choice' && q.options) {
      const optRows = Object.entries(q.options).map(([l, t]) =>
        `<li><span class="opt-label">${l}.</span><span>${renderMathBlock(t)}</span></li>`
      ).join('');
      opts = `<ul class="print-options">${optRows}</ul>`;
    }

    return `
    <div class="print-question">
      <div class="print-question-header">
        <span>第 ${num} 題 ｜ ${q.year}年</span>
        <span>${typeLabel} · ${diffLabel2(q.difficulty)} · ${(q.concepts||[]).slice(0,2).join('、')}</span>
      </div>
      <div class="print-question-body">
        <div class="print-question-text">${renderMathBlock(q.question)}</div>
        ${fig}
        ${opts}
      </div>
    </div>`;
  }).join('');

  return `
<div class="paper-header">
  <h1>國中教育會考 數學科 題目卷</h1>
  <p>共 ${questions.length} 題 ｜ ${new Date().toLocaleDateString('zh-TW')} 自行列印</p>
</div>
${rows}
<div class="paper-footer">國中教育會考數學科題庫 ｜ 資料來源：cap.rcpet.edu.tw</div>`;
}

function buildAnswerHTML(questions) {
  // Build a clean answer sheet — questions grouped by year
  const choiceQuestions = questions.filter(q => q.type === 'choice');

  // Group by year
  const byYear = {};
  choiceQuestions.forEach(q => {
    if (!byYear[q.year]) byYear[q.year] = [];
    byYear[q.year].push(q);
  });

  let yearBlocks = '';
  Object.keys(byYear).sort().forEach(year => {
    const qs = byYear[year];
    // 5-column answer grid: 1-5, 6-10, 11-15, 16-20, 21-25
    const blocks = [];
    for (let start = 1; start <= 25; start += 5) {
      const end = Math.min(start + 4, 25);
      const nums = [];
      const answers = [];
      for (let n = start; n <= end; n++) {
        nums.push(n);
        const q = qs.find(q => q.number === n);
        answers.push(q ? `<span class="answered">${escHtml(q.answer || '—')}</span>` : '—');
      }
      blocks.push(`<div class="answer-block">
        <div class="answer-block-header">${start}–${end} 題</div>
        <div class="answer-block-body">
          ${nums.map((n, i) => `<div class="answer-cell">${n}<br>${answers[i]}</div>`).join('')}
        </div>
      </div>`);
    }
    yearBlocks += `<div style="margin-bottom:32px">
      <h3 style="font-size:16px;color:#1e3a5f;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">${year} 年（${qs.length} 題）</h3>
      <div class="answer-grid">${blocks.join('')}</div>
    </div>`;
  });

  // Key list (id → answer)
  const keyRows = choiceQuestions.map(q =>
    `<div class="answer-key-row">
      <span>${q.year}-${q.number}</span>
      <span style="font-weight:700;color:#1e3a5f">${escHtml(q.answer || '—')}</span>
    </div>`
  ).join('');

  return `
<div class="answer-header">
  <h1>國中教育會考 數學科 答案卷</h1>
  <p>共 ${choiceQuestions.length} 題 ｜ ${new Date().toLocaleDateString('zh-TW')} 自行列印</p>
</div>
${yearBlocks}
<div class="answer-key">
  <h3>答案對照表</h3>
  ${keyRows}
</div>
<div class="paper-footer">國中教育會考數學科題庫 ｜ 資料來源：cap.rcpet.edu.tw</div>`;
}

// ── Helpers ────────────────────────────────────────────────
function getTopConcepts(n) {
  const counter = {};
  state.questions.forEach(q => {
    (q.concepts || []).forEach(c => { counter[c] = (counter[c] || 0) + 1; });
  });
  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function animateCounter(el, target) {
  let start = 0;
  const duration = 1000;
  const step = Math.ceil(target / (duration / 16));
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = start;
    if (start >= target) clearInterval(timer);
  }, 16);
}

// ── Start ──────────────────────────────────────────────────
init();
