import { ParsedElf } from './parser';

export function getElfWebviewContent(parsed: ParsedElf, fileName: string): string {
  const payload = JSON.stringify({ fileName, ...parsed }).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  :root { color-scheme: dark light; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    font-size: 12px;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .mono { font-family: var(--vscode-editor-font-family, 'Cascadia Code', Consolas, monospace); }
  #toolbar {
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
    padding: 8px 12px;
    background: var(--vscode-editorWidget-background, #252526);
    border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    flex: 0 0 auto;
  }
  #title { font-weight: 600; font-size: 13px; margin-right: 4px; }
  input[type="text"] {
    background: var(--vscode-input-background, #3c3c3c);
    color: var(--vscode-input-foreground, #d4d4d4);
    border: 1px solid var(--vscode-input-border, #555);
    padding: 3px 8px; border-radius: 3px; font: inherit; width: 240px;
  }
  input[type="text"]:focus {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  #tabs {
    display: flex; gap: 2px; padding: 6px 12px 0;
    background: var(--vscode-editorWidget-background, #252526);
    border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    flex: 0 0 auto;
  }
  .tab {
    padding: 6px 12px; border: 1px solid transparent; border-bottom: none;
    border-radius: 4px 4px 0 0; background: transparent;
    color: var(--vscode-descriptionForeground, #999); cursor: pointer;
  }
  .tab:hover { color: var(--vscode-editor-foreground, #d4d4d4); }
  .tab.active {
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #fff);
    border-color: var(--vscode-panel-border, #3c3c3c);
    font-weight: 600;
  }
  .badge {
    display: inline-block; margin-left: 5px; padding: 0 5px;
    border-radius: 8px; font-size: 10px;
    background: rgba(128,128,128,0.22);
  }
  #content { flex: 1 1 auto; overflow: auto; padding: 12px; }
  .cards {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px; margin-bottom: 14px;
  }
  .card {
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    border-radius: 5px; padding: 10px 12px;
  }
  .card-title { font-weight: 600; font-size: 11px; color: var(--vscode-descriptionForeground, #999); margin-bottom: 4px; text-transform: uppercase; }
  .card-val { font-size: 16px; font-weight: 600; }
  .card-sub { color: var(--vscode-descriptionForeground, #999); font-size: 11px; margin-top: 4px; word-break: break-all; }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    text-align: left; padding: 5px 8px;
    border-bottom: 1px solid var(--vscode-panel-border, #2d2d2d);
    vertical-align: top;
  }
  th {
    position: sticky; top: 0; z-index: 1;
    background: var(--vscode-editorWidget-background, #252526);
    color: var(--vscode-descriptionForeground, #aaa);
    font-weight: 600; font-size: 11px; user-select: none;
  }
  th.sortable { cursor: pointer; }
  th.sortable:hover { color: var(--vscode-editor-foreground, #fff); }
  tr:hover td { background: var(--vscode-list-hoverBackground, #2a2d2e); }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .addr { color: var(--vscode-textLink-foreground, #569cd6); white-space: nowrap; }
  .sec-name { color: var(--vscode-symbolIcon-structForeground, #c586c0); font-weight: 600; }
  .pill {
    display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px;
    background: rgba(86, 156, 214, 0.16); color: var(--vscode-textLink-foreground, #9cdcfe);
  }
  .mini-bar {
    display: inline-block; height: 6px; border-radius: 3px;
    background: var(--vscode-textLink-foreground, #569cd6); vertical-align: middle;
  }
  .muted { color: var(--vscode-descriptionForeground, #888); }
</style>
</head>
<body>
<div id="toolbar">
  <span id="title" class="mono"></span>
  <input id="search" type="text" placeholder="Filter sections, symbols, strings...">
  <label><input type="checkbox" id="hideDebug"> Hide debug &amp; empty</label>
</div>
<div id="tabs"></div>
<div id="content"></div>

<script>
let DATA = ${payload};
let activeTab = 'sections';
let symSort = { key: 'value', dir: 1 };
let secSort = { key: 'index', dir: 1 };

const titleEl = document.getElementById('title');
const searchEl = document.getElementById('search');
const hideDebugEl = document.getElementById('hideDebug');
const tabsEl = document.getElementById('tabs');
const contentEl = document.getElementById('content');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function hex(n) {
  return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
function fmtBytes(n) {
  if (n >= 1048576) return n.toLocaleString() + ' B (' + (n / 1048576).toFixed(2) + ' MiB)';
  if (n >= 1024) return n.toLocaleString() + ' B (' + (n / 1024).toFixed(1) + ' KiB)';
  return n.toLocaleString() + ' B';
}
function fmtShort(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(2) + ' MiB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KiB';
  return n + ' B';
}

function renderSummaryCards() {
  const h = DATA.header;
  const t = DATA.totals;
  return '<div class="cards">' +
    '<div class="card"><div class="card-title">Target &amp; Entry</div>' +
      '<div class="card-val mono">' + esc(h.machine) + ' (' + esc(h.elfClass) + ')</div>' +
      '<div class="card-sub mono">' + esc(h.type) + ' &bull; ' + esc(h.endian) + '-endian &bull; entry ' + hex(h.entry) + '</div>' +
    '</div>' +
    '<div class="card"><div class="card-title">Flash (ROM)</div>' +
      '<div class="card-val mono">' + fmtShort(t.flash) + '</div>' +
      '<div class="card-sub mono">text ' + fmtShort(t.text) + ' + rodata ' + fmtShort(t.rodata) + ' + data ' + fmtShort(t.data) + '</div>' +
    '</div>' +
    '<div class="card"><div class="card-title">RAM</div>' +
      '<div class="card-val mono">' + fmtShort(t.ram) + '</div>' +
      '<div class="card-sub mono">data ' + fmtShort(t.data) + ' + bss ' + fmtShort(t.bss) + '</div>' +
    '</div>' +
    '<div class="card"><div class="card-title">File Info</div>' +
      '<div class="card-val mono">' + fmtShort(DATA.fileSize) + '</div>' +
      '<div class="card-sub mono">SHA-256: ' + esc(DATA.sha256.slice(0, 16)) + '...</div>' +
    '</div>' +
  '</div>';
}

function renderTabs() {
  const tabs = [
    { id: 'sections', label: 'Sections', count: DATA.sections.length },
    { id: 'symbols', label: 'Symbols', count: DATA.symbols.length },
    { id: 'phdrs', label: 'Program Headers', count: DATA.programHeaders.length },
    { id: 'strings', label: 'Strings', count: DATA.strings.length },
  ];
  tabsEl.innerHTML = tabs.map(t =>
    '<button class="tab' + (activeTab === t.id ? ' active' : '') + '" data-tab="' + t.id + '">' +
      esc(t.label) + '<span class="badge">' + t.count.toLocaleString() + '</span>' +
    '</button>'
  ).join('');
}

function renderSections(q, hideDebug) {
  const rows = DATA.sections
    .filter(s => {
      if (hideDebug && (s.size === 0 || s.name.startsWith('.debug_'))) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q) || s.flags.toLowerCase().includes(q);
    })
    .slice()
    .sort((a, b) => {
      const av = a[secSort.key], bv = b[secSort.key];
      if (typeof av === 'string') return av.localeCompare(bv) * secSort.dir;
      return (av - bv) * secSort.dir;
    });

  const maxSz = rows.reduce((m, r) => Math.max(m, r.size), 1);
  const arrow = (k) => secSort.key === k ? (secSort.dir < 0 ? ' &#9662;' : ' &#9652;') : '';

  let html = renderSummaryCards();
  html += '<table><thead><tr>' +
    '<th class="sortable num" data-secsort="index">#' + arrow('index') + '</th>' +
    '<th class="sortable" data-secsort="name">Name' + arrow('name') + '</th>' +
    '<th class="sortable" data-secsort="type">Type' + arrow('type') + '</th>' +
    '<th>Flags</th>' +
    '<th class="sortable num" data-secsort="addr">Addr' + arrow('addr') + '</th>' +
    '<th class="num">Offset</th>' +
    '<th class="sortable num" data-secsort="size">Size' + arrow('size') + '</th>' +
    '<th>Share</th>' +
    '</tr></thead><tbody>';

  for (const s of rows) {
    const w = s.size > 0 ? Math.max(2, Math.round((s.size / maxSz) * 100)) : 0;
    html += '<tr>' +
      '<td class="num muted">' + s.index + '</td>' +
      '<td class="mono sec-name">' + esc(s.name || '(null)') + '</td>' +
      '<td class="mono">' + esc(s.type) + '</td>' +
      '<td><span class="pill mono">' + esc(s.flags) + '</span></td>' +
      '<td class="num mono addr">' + hex(s.addr) + '</td>' +
      '<td class="num mono muted">' + hex(s.offset) + '</td>' +
      '<td class="num mono">' + fmtBytes(s.size) + '</td>' +
      '<td>' + (w ? '<span class="mini-bar" style="width:' + w + 'px"></span>' : '') + '</td>' +
    '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderSymbols(q) {
  const rows = DATA.symbols
    .filter(s => !q || s.name.toLowerCase().includes(q) || s.section.toLowerCase().includes(q) || s.type.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => {
      const av = a[symSort.key], bv = b[symSort.key];
      if (typeof av === 'string') return av.localeCompare(bv) * symSort.dir;
      return (av - bv) * symSort.dir;
    });
  const arrow = (k) => symSort.key === k ? (symSort.dir < 0 ? ' &#9662;' : ' &#9652;') : '';

  let html = '<div class="muted" style="margin-bottom:6px;">Showing ' + Math.min(rows.length, 2000).toLocaleString() + ' of ' + rows.length.toLocaleString() + ' symbols</div>';
  html += '<table><thead><tr>' +
    '<th class="sortable num" data-symsort="value">Address' + arrow('value') + '</th>' +
    '<th class="sortable num" data-symsort="size">Size' + arrow('size') + '</th>' +
    '<th class="sortable" data-symsort="type">Type' + arrow('type') + '</th>' +
    '<th class="sortable" data-symsort="bind">Bind' + arrow('bind') + '</th>' +
    '<th class="sortable" data-symsort="section">Section' + arrow('section') + '</th>' +
    '<th class="sortable" data-symsort="name">Name' + arrow('name') + '</th>' +
    '</tr></thead><tbody>';

  for (const s of rows.slice(0, 2000)) {
    html += '<tr>' +
      '<td class="num mono addr">' + hex(s.value) + '</td>' +
      '<td class="num mono">' + s.size.toLocaleString() + ' B</td>' +
      '<td class="mono">' + esc(s.type) + '</td>' +
      '<td class="mono muted">' + esc(s.bind) + '</td>' +
      '<td class="mono sec-name">' + esc(s.section) + '</td>' +
      '<td class="mono"><strong>' + esc(s.name) + '</strong></td>' +
    '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderPhdrs(q) {
  const rows = DATA.programHeaders.filter(p => !q || p.type.toLowerCase().includes(q) || p.flags.toLowerCase().includes(q));
  let html = '<table><thead><tr><th>#</th><th>Type</th><th>Flags</th><th class="num">Offset</th><th class="num">VAddr</th><th class="num">PAddr</th><th class="num">FileSz</th><th class="num">MemSz</th><th class="num">Align</th></tr></thead><tbody>';
  for (const p of rows) {
    html += '<tr>' +
      '<td class="muted">' + p.index + '</td>' +
      '<td class="mono"><strong>' + esc(p.type) + '</strong></td>' +
      '<td><span class="pill mono">' + esc(p.flags) + '</span></td>' +
      '<td class="num mono muted">' + hex(p.offset) + '</td>' +
      '<td class="num mono addr">' + hex(p.vaddr) + '</td>' +
      '<td class="num mono addr">' + hex(p.paddr) + '</td>' +
      '<td class="num mono">' + fmtBytes(p.filesz) + '</td>' +
      '<td class="num mono">' + fmtBytes(p.memsz) + '</td>' +
      '<td class="num mono muted">' + hex(p.align) + '</td>' +
    '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderStrings(q) {
  const rows = DATA.strings.filter(s => !q || s.value.toLowerCase().includes(q) || s.section.toLowerCase().includes(q));
  let html = '<div class="muted" style="margin-bottom:6px;">Showing ' + Math.min(rows.length, 2000).toLocaleString() + ' of ' + rows.length.toLocaleString() + ' strings</div>';
  html += '<table><thead><tr><th class="num">Address</th><th>Section</th><th>String</th></tr></thead><tbody>';
  for (const s of rows.slice(0, 2000)) {
    html += '<tr><td class="num mono addr">' + hex(s.addr) + '</td><td class="mono sec-name">' + esc(s.section) + '</td><td class="mono" style="word-break:break-all;">' + esc(s.value) + '</td></tr>';
  }
  html += '</tbody></table>';
  return html;
}

function render() {
  titleEl.textContent = DATA.fileName;
  renderTabs();
  const q = searchEl.value.trim().toLowerCase();
  const hideDebug = hideDebugEl.checked;
  if (activeTab === 'sections') contentEl.innerHTML = renderSections(q, hideDebug);
  else if (activeTab === 'symbols') contentEl.innerHTML = renderSymbols(q);
  else if (activeTab === 'phdrs') contentEl.innerHTML = renderPhdrs(q);
  else contentEl.innerHTML = renderStrings(q);
}

tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn) return;
  activeTab = btn.dataset.tab;
  render();
});

contentEl.addEventListener('click', (e) => {
  const sh = e.target.closest('th[data-secsort]');
  if (sh) {
    const k = sh.dataset.secsort;
    if (secSort.key === k) secSort.dir *= -1;
    else { secSort.key = k; secSort.dir = (k === 'name' || k === 'type' || k === 'index') ? 1 : -1; }
    render();
    return;
  }
  const sy = e.target.closest('th[data-symsort]');
  if (sy) {
    const k = sy.dataset.symsort;
    if (symSort.key === k) symSort.dir *= -1;
    else { symSort.key = k; symSort.dir = (k === 'size') ? -1 : 1; }
    render();
  }
});

searchEl.addEventListener('input', render);
hideDebugEl.addEventListener('change', render);

window.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg && msg.type === 'update' && msg.payload) {
    DATA = msg.payload;
    render();
  }
});

render();
</script>
</body>
</html>`;
}
