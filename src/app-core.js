/* ============================================================
   App core: state, helpers, permissions, shell, sheets, router
   ============================================================ */
'use strict';
const E = window.Engine;
const MODE = window.DIGBYS_MODE || 'live';
const LIVE_CONFIG = {
  url: 'https://jaajrllkozknilvmdezt.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphYWpybGxrb3prbmlsdm1kZXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjQxNDAsImV4cCI6MjA5MjYwMDE0MH0.09U5cba3JxRmysrn2X3TxPqr-q6jJE4QhyeKQwEK03M'
};
let store = null;
let S = null;                       // loaded data
const UI = { page: 'home', div: 'all', period: null, tab: {}, filter: {}, sel: {} };
const ACT = {};                     // click actions: data-act="name"
const INPUT = {};                   // change/input handlers: data-on="name"

// ---------- helpers ----------
const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (p, bare) => {
  const v = Math.abs(p || 0) / 100;
  const s = (bare ? '' : '£') + v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (p || 0) < 0 ? '−' + s : s;
};
const money0 = (p) => { const v = Math.abs(p || 0) / 100; const s = '£' + Math.round(v).toLocaleString('en-GB'); return (p || 0) < 0 ? '−' + s : s; };
const td$ = (p, cls) => `<td class="num${(p || 0) < 0 ? ' neg' : ''}${cls ? ' ' + cls : ''}">${money(p)}</td>`;
const fdate = (s) => s ? E.parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fdateShort = (s) => s ? E.parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
const fts = (s) => { if (!s) return '—'; const d = new Date(s); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
const today = () => E.iso(new Date());
const nowIso = () => new Date().toISOString();
const uid = () => window.Stores.uuid();
const plural = (n, w, pl) => `${n} ${n === 1 ? w : (pl || w + 's')}`;

const ICON = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
  invoice: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  bill: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16.5 14.8c2.4.2 4 1.8 4.5 4.6"/>',
  vat: '<path d="M5 19 19 5"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
  pay: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>',
  staff: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/>',
  car: '<path d="M4 15.5 5.6 10a2 2 0 0 1 1.9-1.4h9a2 2 0 0 1 1.9 1.4l1.6 5.5"/><rect x="3" y="15" width="18" height="4" rx="1.5"/><circle cx="7.5" cy="19.5" r="1"/><circle cx="16.5" cy="19.5" r="1"/>',
  loan: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.5-1-1.6-1.6-2.8-1.6-1.6 0-2.8.9-2.8 2.2 0 3 5.8 1.6 5.8 4.4 0 1.3-1.3 2.2-3 2.2-1.3 0-2.5-.6-3-1.6M12 6v1.6M12 16.4V18"/>',
  asset: '<path d="M4 8 12 4l8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8" r="1.3"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  scales: '<path d="M12 4v16M5 20h14M6 7h12"/><path d="M6 7 3 13h6zM18 7l-3 6h6z"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".8"/><circle cx="4" cy="12" r=".8"/><circle cx="4" cy="18" r=".8"/>',
  book: '<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h9"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.3 3 7.7 7 9.5 4-1.8 7-5.2 7-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  down: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  warn: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17v.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  refresh: '<path d="M19.5 8.5A8 8 0 0 0 5.2 7.5M4.5 15.5a8 8 0 0 0 14.3 1"/><path d="M19.8 4v4.6h-4.6M4.2 20v-4.6h4.6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>',
  pie: '<path d="M4 13h16c0 3.5-3.6 6.5-8 6.5S4 16.5 4 13z"/><path d="M5.5 13c.8-3.6 3.4-6 6.5-6s5.7 2.4 6.5 6M9 9.5l1 1.5M12 8.5v2M15 9.5l-1 1.5"/>'
};
const ico = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ''}</svg>`;

// ---------- reference lookups ----------
const ACC = () => E.accountMap(S);
const acctName = (code) => { const a = ACC()[code]; return a ? a.name : (code || '—'); };
const acctLabel = (code) => code ? `${code} · ${acctName(code)}` : '—';
const contactName = (cid) => { const c = (S.contacts || []).find(x => x.id === cid); return c ? c.name : ''; };
const divName = (d) => { const x = E.DIVISIONS.find(v => v.id === d); return x ? x.name : 'Unallocated'; };
const divChip = (d) => `<span class="pill"><span class="dot ${esc(d || 'none')}"></span>${esc(divName(d))}</span>`;
const vatShort = (c) => (E.VAT_CODES[c] || { short: c || '—' }).short;
const vatOn = (date) => E.vatActive(S.company, date || today());
const lockedDate = (date) => !!(S.company.lockDate && date && date <= S.company.lockDate);
const staffName = (sid) => { const s = (S.staff || []).find(x => x.id === sid); return s ? s.name : sid; };

function accountOptions(selected, filterFn) {
  const groups = [['income', 'Income'], ['cos', 'Cost of sales'], ['overhead', 'Overheads'], ['fixed', 'Fixed assets'], ['current_asset', 'Current assets'], ['bank', 'Bank'], ['current_liability', 'Liabilities'], ['equity', 'Equity']];
  return groups.map(([type, label]) => {
    const accs = (S.accounts || []).filter(a => a.type === type && (!a.archived || a.code === selected) && (!filterFn || filterFn(a)));
    if (!accs.length) return '';
    return `<optgroup label="${label}">${accs.map(a => `<option value="${a.code}"${a.code === selected ? ' selected' : ''}>${a.code} · ${esc(a.name)}</option>`).join('')}</optgroup>`;
  }).join('');
}
const vatOptions = (sel) => Object.entries(E.VAT_CODES).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v.label)}</option>`).join('');
const divOptions = (sel, allowNone) => (allowNone !== false ? `<option value="">Unallocated</option>` : '') + E.DIVISIONS.map(d => `<option value="${d.id}"${d.id === sel ? ' selected' : ''}>${d.name}</option>`).join('');
const contactOptions = (sel, kind) => `<option value="">—</option>` + (S.contacts || []).filter(c => !kind || c.kind === kind || c.kind === 'both').sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
const jobOptions = (sel) => `<option value="">—</option>` + (S.jobCodes || []).slice().sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || '')).map(j => `<option value="${esc(j.code)}"${j.code === sel ? ' selected' : ''}>${esc(j.code)} · ${esc(j.name)}</option>`).join('');

// ---------- permissions ----------
const ROLE = () => (store && store.user && store.user.role) || 'viewer';
const can = {
  edit: () => ['owner', 'director', 'bookkeeper'].includes(ROLE()),
  journal: () => ['owner', 'director', 'bookkeeper', 'accountant'].includes(ROLE()),
  lock: () => ['owner', 'accountant'].includes(ROLE()),
  file: () => ['owner', 'director', 'accountant'].includes(ROLE()),
  private: () => ['owner', 'director', 'accountant'].includes(ROLE()),
  admin: () => ROLE() === 'owner'
};
const ROLE_LABEL = { owner: 'Owner', director: 'Director', bookkeeper: 'Bookkeeper', accountant: 'Accountant', viewer: 'Viewer' };

// ---------- persistence wrappers ----------
async function persist(entity, obj, note) {
  if (entity === 'txns') {
    if (lockedDate(obj.date)) throw new Error(`${fdate(obj.date)} is inside the locked period (up to ${fdate(S.company.lockDate)}).`);
    const prev = (S.txns || []).find(t => t.id === obj.id);
    if (prev && lockedDate(prev.date)) throw new Error('This transaction sits in a locked period and cannot be changed.');
    obj.updatedAt = nowIso(); obj.updatedBy = store.user.email;
    if (!obj.createdAt) { obj.createdAt = obj.updatedAt; obj.createdBy = store.user.email; }
  }
  await store.save(entity, obj);
  if (note) toast(note);
  return obj;
}
async function removeRec(entity, idv, note) { await store.remove(entity, idv); if (note) toast(note); }
async function saveCompany(c, note) { await store.saveCompany(c); if (note) toast(note); }

async function run(fn) {
  try { await fn(); } catch (e) { console.error(e); toast(e.message || String(e), true); }
}

// ---------- toast & tooltip ----------
let toastTimer = null;
function toast(msg, bad) {
  let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.style.background = bad ? 'var(--bad)' : ''; el.style.color = bad ? '#fff' : ''; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, bad ? 6000 : 2600);
}
let tipEl = null;
document.addEventListener('mousemove', (e) => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { if (tipEl) tipEl.hidden = true; return; }
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
  tipEl.textContent = t.getAttribute('data-tip'); tipEl.hidden = false;
  const x = Math.min(e.clientX + 14, window.innerWidth - tipEl.offsetWidth - 8);
  tipEl.style.left = x + 'px'; tipEl.style.top = (e.clientY - 34) + 'px';
});

// ---------- sheets ----------
let sheetStack = [];
function openSheet(o) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="sheet ${o.size || ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
    <div class="sheet-head"><h2>${esc(o.title)}</h2><button class="btn sm" data-sheet-close aria-label="Close">${ico('x')}</button></div>
    <div class="sheet-body">${o.body || ''}</div>
    ${o.foot ? `<div class="sheet-foot">${o.foot}</div>` : ''}</div>`;
  document.body.appendChild(scrim);
  sheetStack.push({ scrim, o });
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim && !o.sticky) closeSheet(); });
  scrim.querySelector('[data-sheet-close]').addEventListener('click', () => closeSheet());
  const first = scrim.querySelector('.sheet-body input, .sheet-body select, .sheet-body textarea');
  if (first && !o.noFocus) setTimeout(() => first.focus(), 60);
  if (o.mount) o.mount(scrim.querySelector('.sheet'));
  return scrim.querySelector('.sheet');
}
function closeSheet() { const top = sheetStack.pop(); if (top) top.scrim.remove(); }
function closeAllSheets() { while (sheetStack.length) closeSheet(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetStack.length) closeSheet(); });

function confirmSheet(title, message, okLabel, danger) {
  return new Promise((resolve) => {
    const sh = openSheet({ title, size: 'narrow', body: `<p style="margin:0">${message}</p>`, noFocus: true,
      foot: `<button class="btn" data-c="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-c="yes">${esc(okLabel || 'OK')}</button>` });
    sh.querySelector('[data-c="no"]').onclick = () => { closeSheet(); resolve(false); };
    sh.querySelector('[data-c="yes"]').onclick = () => { closeSheet(); resolve(true); };
  });
}
// Re-render part of a sheet without losing the field the user just moved to.
// change fires on blur, before the next field takes focus, so wait a tick and then restore it.
function keepFocus(root, fn) {
  setTimeout(() => {
    const a = document.activeElement; let key = null;
    if (a && root.contains(a)) { const d = a.dataset || {}; key = d.k ? `[data-k="${d.k}"]` : d.l ? `[data-l="${d.l}"][data-i="${d.i}"]` : d.j ? `[data-j="${d.j}"][data-i="${d.i}"]` : d.pl ? `[data-pl="${d.pl}"][data-i="${d.i}"]` : null; }
    const pos = key && a.selectionStart != null ? a.selectionStart : null;
    fn();
    if (key) { const n = root.querySelector(key); if (n) { n.focus(); try { if (pos != null && n.setSelectionRange) n.setSelectionRange(pos, pos); } catch (e) { /* number inputs */ } } }
  }, 0);
}
// read a sheet's form into an object: elements with data-k="key"
function readForm(root) {
  const o = {};
  $$('[data-k]', root).forEach(el => {
    const k = el.getAttribute('data-k');
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number' && v !== '') v = +v;
    o[k] = v;
  });
  return o;
}
const field = (label, inner, span) => `<label class="field"${span ? ` style="grid-column:span ${span}"` : ''}><span>${esc(label)}</span>${inner}</label>`;
const inp = (k, v, type, attrs) => `<input class="input" data-k="${k}" id="f-${k}" type="${type || 'text'}" value="${esc(v == null ? '' : v)}" ${attrs || ''}>`;
const sel = (k, opts, attrs) => `<select class="input" data-k="${k}" id="f-${k}" ${attrs || ''}>${opts}</select>`;
const area = (k, v, attrs) => `<textarea class="input" data-k="${k}" id="f-${k}" ${attrs || ''}>${esc(v || '')}</textarea>`;
const chk = (k, v, label) => `<label class="check"><input type="checkbox" data-k="${k}" id="f-${k}" ${v ? 'checked' : ''}> ${esc(label)}</label>`;

// ---------- files ----------
let downloadsCap;
async function saveFile(filename, data, mime) {
  if (window.claude && window.claude.use) {
    if (downloadsCap === undefined) { try { downloadsCap = await window.claude.use('downloads'); } catch (e) { downloadsCap = null; } }
    if (downloadsCap) {
      try { await downloadsCap.save({ filename, data }); toast(`Saved ${filename}`); }
      catch (e) { if (e && e.code !== 'declined') toast(e.message || 'The file could not be saved here.', true); }
      return;
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast(`Downloaded ${filename}`);
}
const inArtifact = () => !!(window.claude && window.claude.use);

// CSV: UTF-8 with BOM so Excel reads £ correctly; ISO dates; plain decimals
function toCSV(cols, rows) {
  const q = (v) => { if (v == null) return ''; const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [cols.map(c => q(c.h)).join(',')].concat(rows.map(r => cols.map(c => q(typeof c.v === 'function' ? c.v(r) : r[c.v])).join(','))).join('\r\n') + '\r\n';
}
const dec = (p) => (Math.round(p || 0) / 100).toFixed(2);

// ---------- period ----------
function periodPresets() {
  const t = today(); const cy = E.companyYear(S.company, t); const prev = E.companyYear(S.company, E.addDays(cy.from, -1));
  const m = t.slice(0, 7); const mStart = m + '-01'; const lmEnd = E.addDays(mStart, -1); const lmStart = lmEnd.slice(0, 7) + '-01';
  const q = Math.floor((E.parse(t).getMonth()) / 3); const qStart = E.iso(new Date(E.parse(t).getFullYear(), q * 3, 1)); const qEnd = E.addDays(E.addMonths(qStart, 3), -1);
  const lqStart = E.addMonths(qStart, -3); const lqEnd = E.addDays(qStart, -1);
  const tyS = E.taxYearStart(t);
  return [
    { id: 'cy', label: 'This financial year', from: cy.from, to: cy.to },
    { id: 'py', label: 'Last financial year', from: prev.from, to: prev.to },
    { id: 'q', label: 'This quarter', from: qStart, to: qEnd },
    { id: 'lq', label: 'Last quarter', from: lqStart, to: lqEnd },
    { id: 'm', label: 'This month', from: mStart, to: E.endOfMonth(mStart) },
    { id: 'lm', label: 'Last month', from: lmStart, to: lmEnd },
    { id: 'ty', label: `Tax year ${E.taxYearLabel(tyS)}`, from: `${tyS}-04-06`, to: `${tyS + 1}-04-05` },
    { id: 'all', label: 'All time', from: '2000-01-01', to: '2099-12-31' }
  ];
}
function currentPeriod() { if (!UI.period) { const p = periodPresets()[0]; UI.period = { id: p.id, from: p.from, to: p.to, label: p.label }; } return UI.period; }
function periodControl() {
  const p = currentPeriod();
  return `<div class="head-actions">
    <select class="input" style="width:auto" data-on="period" aria-label="Period">${periodPresets().map(x => `<option value="${x.id}"${x.id === p.id ? ' selected' : ''}>${x.label}</option>`).join('')}<option value="custom"${p.id === 'custom' ? ' selected' : ''}>Custom dates</option></select>
    ${p.id === 'custom' ? `<input class="input" type="date" style="width:auto" data-on="pfrom" value="${p.from}" aria-label="From"><input class="input" type="date" style="width:auto" data-on="pto" value="${p.to}" aria-label="To">` : `<span class="muted" style="font-size:13px">${fdate(p.from)} – ${fdate(p.to)}</span>`}
  </div>`;
}
INPUT.period = (el) => { if (el.value === 'custom') { const p = currentPeriod(); UI.period = { id: 'custom', from: p.from, to: p.to, label: 'Custom' }; } else { const x = periodPresets().find(v => v.id === el.value); UI.period = { id: x.id, from: x.from, to: x.to, label: x.label }; } render(); };
INPUT.pfrom = (el) => { UI.period.from = el.value; render(); };
INPUT.pto = (el) => { UI.period.to = el.value; render(); };

function divisionControl() {
  const opts = [{ id: 'all', name: 'All' }].concat(E.DIVISIONS);
  return `<div class="seg" role="group" aria-label="Division">${opts.map(d => `<button data-act="div" data-id="${d.id}" class="${UI.div === d.id ? 'on' : ''}" aria-pressed="${UI.div === d.id}">${d.id !== 'all' ? `<span class="dot ${d.id}"></span>` : ''}${d.name}</button>`).join('')}</div>`;
}
ACT.div = (el) => { UI.div = el.dataset.id; render(); };

// ---------- navigation ----------
const NAV = [
  { group: null, items: [['home', 'Home', 'home']] },
  { group: 'Sales', items: [['invoices', 'Invoices', 'invoice'], ['customers', 'Customers', 'people']] },
  { group: 'Purchases', items: [['bills', 'Bills', 'bill'], ['suppliers', 'Suppliers', 'people']] },
  { group: 'Bank', items: [['bank', 'Bank & reconcile', 'bank']] },
  { group: 'Tax', items: [['vat', 'VAT', 'vat']] },
  { group: 'People', items: [['payroll', 'Payroll', 'pay'], ['staff', 'Staff', 'staff'], ['mileage', 'Mileage', 'car']] },
  { group: 'Company', items: [['dla', "Directors' loans", 'loan'], ['assets', 'Fixed assets', 'asset'], ['jobs', 'Job codes', 'tag']] },
  { group: 'Reports', items: [['pnl', 'Profit & loss', 'chart'], ['balance', 'Balance sheet', 'scales'], ['tb', 'Trial balance', 'list'], ['gl', 'General ledger', 'book'], ['aged', 'Aged debts', 'clock']] },
  { group: 'Accountant', items: [['export', 'Export pack', 'box'], ['audit', 'Audit trail', 'shield'], ['notes', 'System notes', 'doc']] },
  { group: null, items: [['settings', 'Settings', 'gear']] }
];
function navBadge(page) {
  if (page === 'bank') { const n = (S.bankLines || []).filter(b => b.status === 'unreconciled').length; return n ? `<span class="badge">${n}</span>` : ''; }
  if (page === 'invoices') { const n = (S.txns || []).filter(t => t.type === 'invoice' && E.docStatus(S, t, today()).key === 'overdue').length; return n ? `<span class="badge">${n}</span>` : ''; }
  return '';
}
function sidebar() {
  const c = S.company;
  return `<nav class="sidebar" aria-label="Sections">
    <div class="brand"><div class="brand-mark">D</div><div><div class="brand-name">${esc(c.tradingName || "Digby's")}</div><div class="brand-sub">${esc(c.name || '')}</div></div></div>
    ${NAV.map(g => `<div class="nav-group">${g.group ? `<div class="nav-label">${g.group}</div>` : ''}${g.items.map(([id, label, icon]) => `<button class="nav-item${UI.page === id ? ' active' : ''}" data-go="${id}" ${UI.page === id ? 'aria-current="page"' : ''}>${ico(icon)}<span>${label}</span>${navBadge(id)}</button>`).join('')}</div>`).join('')}
    <div class="sidebar-foot">
      ${MODE === 'demo' ? `<label class="field"><span>Viewing as</span><select class="input" data-on="role">${['accountant', 'owner', 'director', 'bookkeeper'].map(r => `<option value="${r}"${ROLE() === r ? ' selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select></label>` : `<div>${esc(store.user.name)} · ${ROLE_LABEL[ROLE()]}</div><button class="btn sm" data-act="signout">Sign out</button>`}
      ${S.company.lockDate ? `<div class="faint">${ico('lock').replace('<svg', '<svg style="width:12px;height:12px;vertical-align:-1px;stroke:currentColor;fill:none;stroke-width:2"')} Locked to ${fdate(S.company.lockDate)}</div>` : ''}
    </div>
  </nav>`;
}
INPUT.role = (el) => { const u = (S.users || []).find(x => x.role === el.value) || { email: el.value + '@example.com', name: ROLE_LABEL[el.value] }; store.setRole(el.value, u.email, u.name); toast(`Viewing as ${ROLE_LABEL[el.value]}`); render(); };
ACT.signout = () => store.signOut();

const PAGES = {};
function go(page) { UI.page = page; UI.sel = {}; try { history.replaceState(null, '', '#' + page); } catch (e) { /* sandboxed */ } $('.app') && $('.app').classList.remove('nav-open'); render(); window.scrollTo(0, 0); }

function render() {
  const page = PAGES[UI.page] || PAGES.home;
  let body;
  try { body = page(); } catch (e) { console.error(e); body = `<div class="page-head"><div><h1>Something went wrong</h1><p>${esc(e.message)}</p></div></div>`; }
  $('#root').innerHTML = `<div class="app">${sidebar()}<main class="main" id="main">
    <div class="topbar"><button class="btn sm" data-act="nav" aria-label="Menu">${ico('menu')}</button><span class="t">${esc(S.company.tradingName || "Digby's")}</span></div>
    ${MODE === 'demo' ? `<div class="demo-strip"><span><strong>Demo company.</strong> Fictional figures for review. Changes stay in this browser.</span><button class="btn sm" data-act="resetDemo">Reset demo data</button></div>` : ''}
    ${body}</main></div>`;
  if (page.mount) page.mount();
}
ACT.nav = () => $('.app').classList.toggle('nav-open');
ACT.resetDemo = async () => { if (await confirmSheet('Reset demo data', 'Put the demo company back to its original figures? Anything you have changed here will be cleared.', 'Reset')) { store.reset(); S = await store.load(); UI.period = null; render(); toast('Demo data reset'); } };

document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  const a = e.target.closest('[data-act]');
  if (a && ACT[a.dataset.act]) { e.preventDefault(); run(() => ACT[a.dataset.act](a, e)); }
});
const onField = (e) => { const el = e.target.closest('[data-on]'); if (el && INPUT[el.dataset.on]) run(() => INPUT[el.dataset.on](el, e)); };
document.addEventListener('change', onField);

function head(title, sub, actions) {
  return `<header class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</header>`;
}
function emptyState(title, text, action) { return `<div class="empty"><strong>${esc(title)}</strong>${text ? esc(text) : ''}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`; }
const callout = (kind, text) => `<div class="callout ${kind || ''}">${ico(kind === 'warn' || kind === 'bad' ? 'warn' : kind === 'good' ? 'check' : 'info')}<div>${text}</div></div>`;
