/* ═══════════════════════════════════════════════════════════════
   MATH EXAM BANK — Application Logic
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── State ────────────────────────────────────────────────────
const state = {
  questions: [],
  filtered: [],
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

  // Difficulty chips
  const diffContainer = $('filter-difficulty');
  diffLabels.forEach(([val, label]) => {
    if (diffs.includes(val)) {
      const btn = makeChip(val, label);
      btn.addEventListener('click', () => toggleSet('difficulty', val, btn));
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

  applyFilters();
}

function setView(v) {
  state.view = v;
  $('btn-grid').classList.toggle('active', v === 'grid');
  $('btn-list').classList.toggle('active', v === 'list');
  grid.className = 'question-grid' + (v === 'list' ? ' list-view' : '');
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
