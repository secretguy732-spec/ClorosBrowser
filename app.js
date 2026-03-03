/**
 * CLOROS BROWSER — Main Application Script
 * Full-featured web browser engine using iframes + proxy
 */

'use strict';

// ─────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────
const State = {
  tabs: [],           // Array of tab objects
  activeTabId: null,  // ID of active tab
  nextTabId: 1,
  isIncognito: false,
  settings: {
    theme: 'light',
    searchEngine: 'https://www.google.com/search?q=',
    homepage: 'new-tab',
    bookmarkBarVisible: true,
  },
  bookmarks: [],
  history: [],
  downloads: [],
  networkLog: [],
};

// ─────────────────────────────────────────────────────────────
//  DOM REFS
// ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const tabBar          = $('tab-bar');
const framesContainer = $('frames-container');
const addressBar      = $('address-bar');
const btnBack         = $('btn-back');
const btnForward      = $('btn-forward');
const btnReload       = $('btn-reload');
const btnHome         = $('btn-home');
const btnNewTab       = $('btn-new-tab');
const btnMenu         = $('btn-menu');
const btnBookmarkToggle = $('btn-bookmark-toggle');
const btnIncognito    = $('btn-incognito');
const progressBar     = $('progress-bar');
const progressFill    = $('progress-fill');
const bookmarkBar     = $('bookmark-bar');
const bookmarkList    = $('bookmark-list');
const statusText      = $('status-text');
const newTabPage      = $('new-tab-page');
const errorPage       = $('error-page');
const loadingOverlay  = $('loading-overlay');
const menuDropdown    = $('menu-dropdown');
const ntpSearch       = $('ntp-search');
const securityIcon    = $('security-icon');

// ─────────────────────────────────────────────────────────────
//  PERSIST LOAD
// ─────────────────────────────────────────────────────────────
function loadStorage() {
  try {
    const saved = localStorage.getItem('cloros_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      State.settings  = { ...State.settings, ...parsed.settings };
      State.bookmarks = parsed.bookmarks || [];
      State.history   = parsed.history   || [];
    }
  } catch(e) { console.warn('Storage load failed', e); }
}

function saveStorage() {
  try {
    localStorage.setItem('cloros_state', JSON.stringify({
      settings:  State.settings,
      bookmarks: State.bookmarks,
      history:   State.history,
    }));
  } catch(e) {}
}

// ─────────────────────────────────────────────────────────────
//  TABS
// ─────────────────────────────────────────────────────────────
function createTab(url = null, incognito = false) {
  const id = State.nextTabId++;
  const tab = {
    id,
    url: url || 'new-tab',
    title: 'New Tab',
    favicon: null,
    history: url ? [url] : [],
    historyIndex: url ? 0 : -1,
    loading: false,
    incognito: incognito || State.isIncognito,
    zoom: 1,
  };
  State.tabs.push(tab);

  // Create tab element
  const tabEl = document.createElement('div');
  tabEl.className = 'tab' + (tab.incognito ? ' incognito' : '');
  tabEl.dataset.tabId = id;
  tabEl.setAttribute('role', 'tab');
  tabEl.innerHTML = `
    <div class="tab-favicon">
      <div class="tab-fav-text">N</div>
    </div>
    <span class="tab-title">New Tab</span>
    <button class="tab-close" title="Close tab" aria-label="Close tab">✕</button>
  `;
  tabEl.addEventListener('click', e => {
    if (!e.target.classList.contains('tab-close')) switchTab(id);
  });
  tabEl.querySelector('.tab-close').addEventListener('click', e => {
    e.stopPropagation();
    closeTab(id);
  });
  tabBar.appendChild(tabEl);

  // Create iframe
  const frame = document.createElement('iframe');
  frame.className = 'browser-frame';
  frame.dataset.tabId = id;
  frame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox');
  frame.setAttribute('allow', 'fullscreen');
  framesContainer.appendChild(frame);

  switchTab(id);

  if (url && url !== 'new-tab') {
    navigate(url, id);
  }

  return id;
}

function switchTab(id) {
  State.activeTabId = id;

  // Update tab elements
  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tabId == id);
  });

  // Update frames
  document.querySelectorAll('.browser-frame').forEach(f => {
    f.classList.toggle('active', f.dataset.tabId == id);
  });

  const tab = getTab(id);
  if (!tab) return;

  // Update address bar
  addressBar.value = tab.url === 'new-tab' ? '' : tab.url;
  updateNavButtons(tab);
  updateBookmarkButton(tab.url);
  updateSecurityIcon(tab.url);

  // Show correct page
  if (tab.url === 'new-tab') {
    showNewTabPage();
  } else if (tab.errorPage) {
    showErrorPage();
  } else {
    hideSpecialPages();
  }
}

function closeTab(id) {
  const idx = State.tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  // Remove tab element
  const tabEl = tabBar.querySelector(`[data-tab-id="${id}"]`);
  if (tabEl) tabEl.remove();

  // Remove iframe
  const frame = framesContainer.querySelector(`[data-tab-id="${id}"]`);
  if (frame) frame.remove();

  State.tabs.splice(idx, 1);

  if (State.tabs.length === 0) {
    createTab();
  } else if (State.activeTabId === id) {
    const newIdx = Math.min(idx, State.tabs.length - 1);
    switchTab(State.tabs[newIdx].id);
  }
}

function getTab(id) {
  return State.tabs.find(t => t.id === id);
}

function getActiveTab() {
  return getTab(State.activeTabId);
}

function getTabFrame(id) {
  return framesContainer.querySelector(`[data-tab-id="${id}"]`);
}

function updateTabUI(id, { title, favicon, loading } = {}) {
  const tab = getTab(id);
  if (!tab) return;
  const tabEl = tabBar.querySelector(`[data-tab-id="${id}"]`);
  if (!tabEl) return;

  if (title !== undefined) {
    tab.title = title;
    tabEl.querySelector('.tab-title').textContent = title;
    if (id === State.activeTabId) document.title = title + ' — Cloros';
  }
  if (loading !== undefined) {
    tab.loading = loading;
    const favDiv = tabEl.querySelector('.tab-favicon');
    if (loading) {
      favDiv.innerHTML = '<div class="tab-spinner"></div>';
    } else {
      if (favicon) {
        favDiv.innerHTML = `<img src="${favicon}" onerror="this.parentNode.innerHTML='<div class=\\'tab-fav-text\\'>${(title||'N')[0]}</div>'" />`;
      } else {
        favDiv.innerHTML = `<div class="tab-fav-text">${(title||'N')[0].toUpperCase()}</div>`;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────────────────────────
function processInput(input) {
  input = input.trim();
  if (!input) return null;

  // Check if it's a URL
  if (/^https?:\/\//i.test(input)) return input;
  if (/^localhost(:\d+)?/i.test(input)) return 'http://' + input;
  if (/^[\w-]+\.(com|net|org|io|dev|edu|gov|co\.\w{2}|app|ai|tv|me|info)(\/.*)?$/.test(input)) {
    return 'https://' + input;
  }

  // It's a search query
  return State.settings.searchEngine + encodeURIComponent(input);
}

function navigate(url, tabId = null) {
  const id = tabId || State.activeTabId;
  const tab = getTab(id);
  if (!tab) return;

  const processed = processInput(url);
  if (!processed) return;

  tab.url = processed;
  tab.errorPage = false;

  // Update history stack
  if (tab.historyIndex < tab.history.length - 1) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
  }
  tab.history.push(processed);
  tab.historyIndex = tab.history.length - 1;

  // Update address bar if this is the active tab
  if (id === State.activeTabId) {
    addressBar.value = processed;
    updateNavButtons(tab);
    updateSecurityIcon(processed);
    hideSpecialPages();
  }

  // Fetch via proxy and load into iframe
  loadUrl(processed, id);

  // Add to history (if not incognito)
  if (!tab.incognito) {
    addHistory(processed, tab.title || processed);
  }

  logNetwork(processed, 'GET');
}

function loadUrl(url, tabId) {
  const tab = getTab(tabId);
  const frame = getTabFrame(tabId);
  if (!tab || !frame) return;

  startProgress();
  updateTabUI(tabId, { loading: true, title: 'Loading…' });
  if (tabId === State.activeTabId) loadingOverlay.classList.add('active');

  const proxyUrl = `/proxy?url=${encodeURIComponent(url)}`;
  const tabFavicon = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;

  // Use a blob URL approach to load content into iframe
  fetch(proxyUrl)
    .then(res => res.json().then(data => {
      if (data.redirect) {
        navigate(data.redirect, tabId);
        return;
      }
      throw new Error('Unexpected JSON response');
    }).catch(() => {
      // If response is HTML, load it
      return fetch(proxyUrl).then(r => r.text());
    }))
    .then(html => {
      if (!html || typeof html !== 'string') return;

      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      frame.src = blobUrl;

      frame.onload = () => {
        stopProgress();
        updateTabUI(tabId, {
          loading: false,
          title: extractTitle(html) || new URL(url).hostname,
          favicon: tabFavicon
        });
        if (tabId === State.activeTabId) {
          loadingOverlay.classList.remove('active');
          updateNavButtons(getTab(tabId));
        }
        // Revoke blob URL to free memory
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      };
      frame.onerror = () => showError(tabId);
    })
    .catch(err => {
      stopProgress();
      showError(tabId, err.message);
    });
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function showError(tabId, msg) {
  const tab = getTab(tabId);
  if (!tab) return;
  tab.errorPage = true;
  stopProgress();
  updateTabUI(tabId, { loading: false, title: 'Error' });
  loadingOverlay.classList.remove('active');
  if (tabId === State.activeTabId) {
    $('error-msg').textContent = msg || 'This site cannot be reached. It may be unavailable or blocked.';
    showErrorPage();
  }
}

function goBack() {
  const tab = getActiveTab();
  if (!tab || tab.historyIndex <= 0) return;
  tab.historyIndex--;
  const url = tab.history[tab.historyIndex];
  tab.url = url;
  addressBar.value = url;
  updateNavButtons(tab);
  loadUrl(url, tab.id);
}

function goForward() {
  const tab = getActiveTab();
  if (!tab || tab.historyIndex >= tab.history.length - 1) return;
  tab.historyIndex++;
  const url = tab.history[tab.historyIndex];
  tab.url = url;
  addressBar.value = url;
  updateNavButtons(tab);
  loadUrl(url, tab.id);
}

function reload() {
  const tab = getActiveTab();
  if (!tab || tab.url === 'new-tab') return;
  loadUrl(tab.url, tab.id);
}

function goHome() {
  if (State.settings.homepage === 'new-tab') {
    const tab = getActiveTab();
    if (tab) {
      tab.url = 'new-tab';
      tab.errorPage = false;
      addressBar.value = '';
      updateTabUI(tab.id, { title: 'New Tab', loading: false });
      showNewTabPage();
      getTabFrame(tab.id).src = 'about:blank';
    }
  } else {
    navigate(State.settings.homepage);
  }
}

function updateNavButtons(tab) {
  if (!tab) return;
  btnBack.disabled    = !tab || tab.historyIndex <= 0;
  btnForward.disabled = !tab || tab.historyIndex >= tab.history.length - 1;
}

function updateSecurityIcon(url) {
  if (!url || url === 'new-tab') {
    securityIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    securityIcon.style.color = 'var(--text-muted)';
    return;
  }
  const isHttps = url.startsWith('https://');
  securityIcon.innerHTML = isHttps
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
  securityIcon.style.color = isHttps ? 'var(--success)' : '#f9ab00';
}

function updateBookmarkButton(url) {
  const isBookmarked = State.bookmarks.some(b => b.url === url);
  btnBookmarkToggle.classList.toggle('bookmarked', isBookmarked);
  btnBookmarkToggle.innerHTML = isBookmarked
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
}

// ─────────────────────────────────────────────────────────────
//  PROGRESS BAR
// ─────────────────────────────────────────────────────────────
let progressTimer = null;
function startProgress() {
  progressBar.classList.add('active');
  progressFill.style.width = '10%';
  clearInterval(progressTimer);
  let p = 10;
  progressTimer = setInterval(() => {
    p += (90 - p) * 0.08;
    progressFill.style.width = p + '%';
    if (p >= 89) clearInterval(progressTimer);
  }, 100);
}
function stopProgress() {
  clearInterval(progressTimer);
  progressFill.style.width = '100%';
  setTimeout(() => {
    progressBar.classList.remove('active');
    progressFill.style.width = '0%';
  }, 300);
}

// ─────────────────────────────────────────────────────────────
//  PAGE VISIBILITY
// ─────────────────────────────────────────────────────────────
function showNewTabPage() {
  newTabPage.classList.add('active-page');
  errorPage.classList.remove('active-page');
  document.querySelectorAll('.browser-frame').forEach(f => f.classList.remove('active'));
}
function showErrorPage() {
  errorPage.classList.add('active-page');
  newTabPage.classList.remove('active-page');
}
function hideSpecialPages() {
  newTabPage.classList.remove('active-page');
  errorPage.classList.remove('active-page');
  const frame = getTabFrame(State.activeTabId);
  if (frame) frame.classList.add('active');
  // re-activate all frames for the current tab
  document.querySelectorAll('.browser-frame').forEach(f => {
    f.classList.toggle('active', f.dataset.tabId == State.activeTabId);
  });
}

// ─────────────────────────────────────────────────────────────
//  BOOKMARKS
// ─────────────────────────────────────────────────────────────
function toggleBookmark() {
  const tab = getActiveTab();
  if (!tab || tab.url === 'new-tab') return;

  const idx = State.bookmarks.findIndex(b => b.url === tab.url);
  if (idx !== -1) {
    State.bookmarks.splice(idx, 1);
    showToast('Bookmark removed');
  } else {
    State.bookmarks.unshift({ url: tab.url, title: tab.title || tab.url, time: Date.now() });
    showToast('Bookmark saved');
  }
  saveStorage();
  renderBookmarkBar();
  updateBookmarkButton(tab.url);
}

function renderBookmarkBar() {
  bookmarkList.innerHTML = '';
  State.bookmarks.slice(0, 12).forEach(bm => {
    const el = document.createElement('div');
    el.className = 'bookmark-item';
    el.innerHTML = `
      <img class="bookmark-favicon" src="https://www.google.com/s2/favicons?domain=${new URL(bm.url).hostname}&sz=16" onerror="this.style.display='none'" />
      <span>${bm.title || bm.url}</span>
    `;
    el.title = bm.url;
    el.addEventListener('click', () => navigate(bm.url));
    bookmarkList.appendChild(el);
  });
}

function renderBookmarksPanel() {
  const list = $('bookmarks-list');
  list.innerHTML = '';
  if (!State.bookmarks.length) {
    list.innerHTML = '<p class="panel-empty">No bookmarks yet.<br>Click the ★ icon to add one.</p>';
    return;
  }
  State.bookmarks.forEach((bm, i) => {
    const el = createPanelItem(bm.title, bm.url, bm.url, () => navigate(bm.url), () => {
      State.bookmarks.splice(i, 1);
      saveStorage();
      renderBookmarkBar();
      renderBookmarksPanel();
    });
    list.appendChild(el);
  });
}

// ─────────────────────────────────────────────────────────────
//  HISTORY
// ─────────────────────────────────────────────────────────────
function addHistory(url, title) {
  if (State.isIncognito) return;
  State.history.unshift({ url, title, time: Date.now() });
  if (State.history.length > 500) State.history.pop();
  saveStorage();
}

function renderHistoryPanel(filter = '') {
  const list = $('history-list');
  list.innerHTML = '';
  const items = filter
    ? State.history.filter(h => h.url.includes(filter) || h.title.toLowerCase().includes(filter.toLowerCase()))
    : State.history;

  if (!items.length) {
    list.innerHTML = '<p class="panel-empty">No history.</p>';
    return;
  }

  let lastDate = '';
  items.slice(0, 200).forEach((h, i) => {
    const d = new Date(h.time);
    const dateStr = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (dateStr !== lastDate) {
      lastDate = dateStr;
      const header = document.createElement('div');
      header.className = 'panel-date-group';
      header.textContent = dateStr;
      list.appendChild(header);
    }
    const el = createPanelItem(h.title, h.url, formatTime(d), () => navigate(h.url), () => {
      State.history.splice(State.history.indexOf(h), 1);
      saveStorage();
      renderHistoryPanel(filter);
    });
    list.appendChild(el);
  });
}

function formatTime(d) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────
//  PANEL ITEMS (shared factory)
// ─────────────────────────────────────────────────────────────
function createPanelItem(title, url, meta, onNavigate, onRemove) {
  const el = document.createElement('div');
  el.className = 'panel-item';
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch(e) {}
  el.innerHTML = `
    <div class="panel-item-icon">
      <img src="https://www.google.com/s2/favicons?domain=${hostname}&sz=16" onerror="this.style.display='none'" />
    </div>
    <div class="panel-item-text">
      <div class="panel-item-title">${escapeHtml(title || url)}</div>
      <div class="panel-item-url">${escapeHtml(url)}</div>
    </div>
    <span class="panel-item-time">${meta || ''}</span>
    <button class="panel-item-remove" title="Remove">✕</button>
  `;
  el.querySelector('.panel-item-text').addEventListener('click', onNavigate);
  el.querySelector('.panel-item-remove').addEventListener('click', e => {
    e.stopPropagation();
    onRemove();
  });
  return el;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ─────────────────────────────────────────────────────────────
//  PANELS
// ─────────────────────────────────────────────────────────────
const openPanels = new Set();

function openPanel(panelId) {
  const panel = $(panelId);
  if (!panel) return;
  panel.classList.remove('hidden');
  requestAnimationFrame(() => panel.classList.add('open'));

  const backdrop = $('panel-backdrop');
  backdrop.classList.remove('hidden');
  requestAnimationFrame(() => backdrop.classList.add('visible'));

  openPanels.add(panelId);
}

function closePanel(panelId) {
  const panel = $(panelId);
  if (!panel) return;
  panel.classList.remove('open');
  panel.addEventListener('transitionend', () => panel.classList.add('hidden'), { once: true });
  openPanels.delete(panelId);

  if (openPanels.size === 0) {
    const backdrop = $('panel-backdrop');
    backdrop.classList.remove('visible');
    backdrop.addEventListener('transitionend', () => backdrop.classList.add('hidden'), { once: true });
  }
}

function togglePanel(panelId) {
  const panel = $(panelId);
  if (panel.classList.contains('open')) {
    closePanel(panelId);
  } else {
    openPanel(panelId);
  }
}

// Close panel buttons
document.querySelectorAll('.panel-close-btn').forEach(btn => {
  btn.addEventListener('click', () => closePanel(btn.dataset.panel));
});

$('panel-backdrop').addEventListener('click', () => {
  [...openPanels].forEach(p => closePanel(p));
  menuDropdown.classList.add('hidden');
});

// ─────────────────────────────────────────────────────────────
//  DEVTOOLS
// ─────────────────────────────────────────────────────────────
$('btn-devtools').addEventListener('click', () => {
  const dt = $('devtools-panel');
  if (dt.classList.contains('open')) {
    dt.classList.remove('open');
    dt.classList.add('hidden');
  } else {
    dt.classList.remove('hidden');
    requestAnimationFrame(() => dt.classList.add('open'));
    renderStorageView();
  }
});

// DevTools tabs
document.querySelectorAll('.dt-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.dt-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dt-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $('dt-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'storage') renderStorageView();
    if (tab.dataset.tab === 'network') renderNetworkLog();
  });
});

// Console
$('console-input').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const code = e.target.value.trim();
  if (!code) return;
  logConsole('> ' + code, 'info');
  try {
    const result = eval(code);
    logConsole(String(result), 'log');
  } catch(err) {
    logConsole(err.message, 'error');
  }
  e.target.value = '';
});

function logConsole(msg, type = 'log') {
  const out = $('console-output');
  const el = document.createElement('div');
  el.className = 'console-log console-' + type;
  el.textContent = msg;
  out.appendChild(el);
  out.scrollTop = out.scrollHeight;
}

function logNetwork(url, method) {
  State.networkLog.push({ url, method, time: new Date().toLocaleTimeString() });
  if ($('dt-network').classList.contains('active')) renderNetworkLog();
}

function renderNetworkLog() {
  const el = $('network-log');
  el.innerHTML = State.networkLog.slice(-50).reverse().map(n =>
    `<div class="console-log"><span style="color:var(--accent)">${n.method}</span> ${n.time} — ${n.url}</div>`
  ).join('');
}

function renderStorageView() {
  const el = $('storage-view');
  try {
    const keys = Object.keys(localStorage);
    el.innerHTML = keys.length
      ? keys.map(k => `<div class="console-log"><span style="color:var(--accent)">${k}</span>: ${localStorage.getItem(k).slice(0, 100)}</div>`).join('')
      : '<div class="console-log" style="color:var(--text-muted)">localStorage is empty</div>';
  } catch(e) { el.textContent = 'Unable to read storage'; }
}

// ─────────────────────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────────────────────
function setTheme(theme) {
  document.body.classList.toggle('dark-mode', theme === 'dark');
  document.body.classList.toggle('light-mode', theme === 'light');
  State.settings.theme = theme;
  $('btn-darkmode').textContent = theme === 'dark' ? '☀️' : '🌙';
  $('theme-light').classList.toggle('active', theme === 'light');
  $('theme-dark').classList.toggle('active', theme === 'dark');
  saveStorage();
}

$('btn-darkmode').addEventListener('click', () => {
  setTheme(State.settings.theme === 'dark' ? 'light' : 'dark');
});
$('theme-light').addEventListener('click', () => setTheme('light'));
$('theme-dark').addEventListener('click', () => setTheme('dark'));

// ─────────────────────────────────────────────────────────────
//  INCOGNITO
// ─────────────────────────────────────────────────────────────
function toggleIncognito() {
  State.isIncognito = !State.isIncognito;
  document.body.classList.toggle('incognito', State.isIncognito);
  showToast(State.isIncognito ? '🕵️ Incognito mode on' : 'Incognito mode off');
  createTab(null, State.isIncognito);
}

btnIncognito.addEventListener('click', toggleIncognito);

// ─────────────────────────────────────────────────────────────
//  SETTINGS
// ─────────────────────────────────────────────────────────────
function applySettings() {
  $('search-engine-select').value = State.settings.searchEngine;
  $('homepage-url').value = State.settings.homepage === 'new-tab' ? '' : State.settings.homepage;
  $('toggle-bookmarks').checked = State.settings.bookmarkBarVisible;
  bookmarkBar.classList.toggle('hidden', !State.settings.bookmarkBarVisible);
  setTheme(State.settings.theme);
}

$('toggle-bookmarks').addEventListener('change', e => {
  State.settings.bookmarkBarVisible = e.target.checked;
  bookmarkBar.classList.toggle('hidden', !e.target.checked);
  saveStorage();
});

$('search-engine-select').addEventListener('change', e => {
  State.settings.searchEngine = e.target.value;
  saveStorage();
});

$('homepage-url').addEventListener('change', e => {
  State.settings.homepage = e.target.value || 'new-tab';
  saveStorage();
});

$('btn-clear-history').addEventListener('click', () => {
  State.history = [];
  saveStorage();
  renderHistoryPanel();
  showToast('History cleared');
});

$('btn-clear-all-history').addEventListener('click', () => {
  State.history = [];
  saveStorage();
  showToast('History cleared');
});

$('btn-clear-bookmarks').addEventListener('click', () => {
  State.bookmarks = [];
  saveStorage();
  renderBookmarkBar();
  renderBookmarksPanel();
  showToast('Bookmarks cleared');
});

// ─────────────────────────────────────────────────────────────
//  TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
let toastContainer;
function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
}
function showToast(msg) {
  ensureToastContainer();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ─────────────────────────────────────────────────────────────
//  NEW TAB PAGE CLOCK
// ─────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  $('ntp-time').textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  $('ntp-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
updateClock();
setInterval(updateClock, 1000);

// ─────────────────────────────────────────────────────────────
//  KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const isMod = e.ctrlKey || e.metaKey;

  if (isMod && e.key === 't') { e.preventDefault(); createTab(); }
  if (isMod && e.key === 'w') { e.preventDefault(); closeTab(State.activeTabId); }
  if (isMod && e.key === 'l') { e.preventDefault(); addressBar.focus(); addressBar.select(); }
  if (isMod && e.key === 'r') { e.preventDefault(); reload(); }
  if (isMod && e.key === 'd') { e.preventDefault(); toggleBookmark(); }
  if (isMod && e.key === 'h') { e.preventDefault(); openPanel('history-panel'); renderHistoryPanel(); }
  if (isMod && e.key === 'j') { e.preventDefault(); openPanel('downloads-panel'); }
  if (isMod && e.key === 'i') { e.preventDefault(); toggleIncognito(); }
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goForward(); }
  if (e.key === 'F5') { e.preventDefault(); reload(); }
  if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
  if (e.key === 'Escape') {
    menuDropdown.classList.add('hidden');
    [...openPanels].forEach(p => closePanel(p));
  }

  // Ctrl+1-9: switch tab
  if (isMod && e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key) - 1;
    if (State.tabs[idx]) { e.preventDefault(); switchTab(State.tabs[idx].id); }
  }
});

// ─────────────────────────────────────────────────────────────
//  ADDRESS BAR EVENTS
// ─────────────────────────────────────────────────────────────
addressBar.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = addressBar.value.trim();
    if (val) navigate(val);
    addressBar.blur();
  }
  if (e.key === 'Escape') addressBar.blur();
});

addressBar.addEventListener('focus', () => {
  addressBar.select();
});

// ─────────────────────────────────────────────────────────────
//  NTP SEARCH
// ─────────────────────────────────────────────────────────────
ntpSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = ntpSearch.value.trim();
    if (val) { navigate(val); ntpSearch.value = ''; }
  }
});

// NTP shortcuts
document.querySelectorAll('.shortcut').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.url));
});

// ─────────────────────────────────────────────────────────────
//  NAV BUTTONS
// ─────────────────────────────────────────────────────────────
btnBack.addEventListener('click', goBack);
btnForward.addEventListener('click', goForward);
btnReload.addEventListener('click', reload);
btnHome.addEventListener('click', goHome);
btnNewTab.addEventListener('click', () => createTab());
btnBookmarkToggle.addEventListener('click', toggleBookmark);
$('btn-error-reload').addEventListener('click', () => {
  const tab = getActiveTab();
  if (tab && tab.url !== 'new-tab') {
    tab.errorPage = false;
    loadUrl(tab.url, tab.id);
    hideSpecialPages();
  }
});

// ─────────────────────────────────────────────────────────────
//  3-DOT MENU
// ─────────────────────────────────────────────────────────────
btnMenu.addEventListener('click', e => {
  e.stopPropagation();
  const rect = btnMenu.getBoundingClientRect();
  menuDropdown.style.top = (rect.bottom + 6) + 'px';
  menuDropdown.style.right = (window.innerWidth - rect.right) + 'px';
  menuDropdown.classList.toggle('hidden');
});

document.addEventListener('click', e => {
  if (!menuDropdown.contains(e.target) && e.target !== btnMenu) {
    menuDropdown.classList.add('hidden');
  }
});

document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', () => {
    const action = item.dataset.action;
    menuDropdown.classList.add('hidden');
    switch(action) {
      case 'new-tab':    createTab(); break;
      case 'incognito':  toggleIncognito(); break;
      case 'history':
        openPanel('history-panel');
        renderHistoryPanel();
        break;
      case 'bookmarks':
        openPanel('bookmarks-panel');
        renderBookmarksPanel();
        break;
      case 'downloads':
        openPanel('downloads-panel');
        break;
      case 'zoom-in':   zoomTab(0.1); break;
      case 'zoom-out':  zoomTab(-0.1); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'settings':
        openPanel('settings-panel');
        break;
    }
  });
});

$('btn-downloads').addEventListener('click', () => openPanel('downloads-panel'));
$('btn-extensions').addEventListener('click', () => showToast('Extensions: Coming soon!'));

// Status bar history search
$('history-search').addEventListener('input', e => renderHistoryPanel(e.target.value));

// ─────────────────────────────────────────────────────────────
//  ZOOM
// ─────────────────────────────────────────────────────────────
function zoomTab(delta) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.zoom = Math.max(0.5, Math.min(3, (tab.zoom || 1) + delta));
  const frame = getTabFrame(tab.id);
  if (frame) frame.style.transform = `scale(${tab.zoom})`;
  showToast(`Zoom: ${Math.round(tab.zoom * 100)}%`);
}

// ─────────────────────────────────────────────────────────────
//  FULLSCREEN
// ─────────────────────────────────────────────────────────────
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(e => {});
  } else {
    document.exitFullscreen().catch(e => {});
  }
}

// ─────────────────────────────────────────────────────────────
//  IFRAME → PARENT MESSAGES (navigation from within iframe)
// ─────────────────────────────────────────────────────────────
window.addEventListener('message', e => {
  if (e.data && e.data.type === 'navigate') {
    navigate(e.data.url);
  }
});

// ─────────────────────────────────────────────────────────────
//  STATUS BAR HOVER
// ─────────────────────────────────────────────────────────────
document.addEventListener('mouseover', e => {
  const a = e.target.closest('a');
  if (a && a.href) statusText.textContent = a.href;
});
document.addEventListener('mouseout', e => {
  if (e.target.closest('a')) statusText.textContent = '';
});

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
function init() {
  loadStorage();
  applySettings();
  renderBookmarkBar();

  // Open first tab
  createTab();

  // Restore session if applicable
  const savedUrl = sessionStorage.getItem('cloros_last_url');
  if (savedUrl) navigate(savedUrl);
}

// Save last URL on unload
window.addEventListener('beforeunload', () => {
  const tab = getActiveTab();
  if (tab && tab.url !== 'new-tab') {
    sessionStorage.setItem('cloros_last_url', tab.url);
  }
});

init();
