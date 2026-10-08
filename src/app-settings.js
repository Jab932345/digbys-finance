/* ============================================================
   Settings and boot
   ============================================================ */
PAGES.settings = function () {
  const tab = UI.tab.settings || 'company'; const c = S.company;
  const tabs = [['company', 'Company'], ['vat', 'VAT'], ['lock', 'Period lock'], ['accounts', 'Chart of accounts'], ['rules', 'Bank rules'], ['users', 'People with access']];
  const ro = !can.edit(); const R = ro ? 'readonly' : ''; const D = ro ? 'disabled' : '';
  let body = '';
  if (tab === 'company') {
    body = `<section class="panel"><div class="panel-body" style="padding-top:18px"><div class="grid cols-4" id="co-form">
      ${field('Business is', sel('entityType', [['sole_trader', 'Sole trader (until incorporation)'], ['ltd', 'Limited company']].map(([k, l]) => `<option value="${k}"${(c.entityType || 'ltd') === k ? ' selected' : ''}>${l}</option>`).join(''), D))}${field('Owner', inp('ownerName', c.ownerName || 'James Brierley', 'text', R))}${field('Books start', inp('booksStart', c.booksStart || c.incorporated || '', 'date', R))}<span></span>
      ${field('Legal name', inp('name', c.name, 'text', R), 2)}${field('Trading name', inp('tradingName', c.tradingName, 'text', R))}${field('Company number', inp('companyNo', c.companyNo, 'text', R))}
      ${field('Registered office', inp('regOffice', c.regOffice, 'text', R), 3)}${field('Registered in', inp('registeredIn', c.registeredIn || 'England and Wales', 'text', R))}
      ${field('Corporation tax UTR', inp('utr', c.utr, 'text', R))}${field('Incorporated', inp('incorporated', c.incorporated, 'date', R))}${field('Financial year ends (MM-DD)', inp('yearEnd', c.yearEnd || '03-31', 'text', 'pattern="\\d{2}-\\d{2}" ' + R))}${field('Associated companies', inp('associatedCompanies', c.associatedCompanies || 0, 'number', 'min="0" ' + R))}
      ${field('Accounts email', inp('email', c.email, 'email', R))}${field('Phone', inp('phone', c.phone, 'tel', R))}${field('Invoice prefix', inp('invoicePrefix', c.invoicePrefix, 'text', R))}${field('Next invoice number', inp('nextInvoiceNo', c.nextInvoiceNo, 'number', R))}
      ${field('Payment terms (days)', inp('paymentTerms', c.paymentTerms || 30, 'number', R))}${field('Bank account name (on invoices)', inp('bankAccountName', c.bankAccountName, 'text', R))}${field('Sort code', inp('bankSort', c.bankSort, 'text', R))}${field('Account number', inp('bankAccountNo', c.bankAccountNo, 'text', R))}
    </div>
    <div class="nav-label" style="padding:18px 0 6px">Directors and shareholders</div>
    <div class="grid" id="dir-list">${(c.directors || []).map((d, i) => `<div class="grid cols-3"><input class="input" data-d="name" data-i="${i}" value="${esc(d.name)}" aria-label="Director name" ${R}><input class="input" type="number" data-d="share" data-i="${i}" value="${d.share}" aria-label="Shareholding %" ${R}><select class="input" data-d="dla" data-i="${i}" aria-label="Loan account" ${D}>${accountOptions(d.dla, a => a.type === 'current_liability')}</select></div>`).join('')}</div>
    ${ro ? '' : `<div class="head-actions" style="margin-top:16px;justify-content:flex-end"><button class="btn primary" data-act="saveCompanyForm">Save company details</button></div>`}
    </div></section>`;
  } else if (tab === 'vat') {
    body = `<section class="panel"><div class="panel-body" style="padding-top:18px"><div class="grid cols-3" id="vat-form">
      <div class="field" style="grid-column:1/-1">${chk('vatRegistered', c.vatRegistered, 'VAT registered')}</div>
      ${field('VAT number', inp('vatNumber', c.vatNumber, 'text', R))}${field('Effective date of registration', inp('vatRegDate', c.vatRegDate, 'date', R))}
      ${field('Scheme', sel('vatScheme', [['standard', 'Standard (invoice basis)'], ['cash', 'Cash accounting'], ['flat', 'Flat rate']].map(([k, l]) => `<option value="${k}"${(c.vatScheme || 'standard') === k ? ' selected' : ''}>${l}</option>`).join(''), D))}
      ${field('Quarters end', sel('vatStagger', [[1, 'Mar, Jun, Sep, Dec'], [2, 'Jan, Apr, Jul, Oct'], [3, 'Feb, May, Aug, Nov']].map(([k, l]) => `<option value="${k}"${+(c.vatStagger || 1) === k ? ' selected' : ''}>${l}</option>`).join(''), D))}
      ${field('Flat rate %', inp('flatRate', c.flatRate || 12.5, 'number', 'step="0.5" ' + R))}<div class="field" style="align-self:end">${chk('frsFirstYearDiscount', c.frsFirstYearDiscount, '1% first-year discount')}</div>
    </div>${callout('', 'Catering, restaurants and takeaways use 12.5% on the flat rate scheme, or 16.5% as a limited cost trader. Hot food and catering are standard-rated; most cold food sold to take away is zero-rated. Your accountant should confirm the scheme and rates for pies, butchery services and hire before registration.')}
    ${ro ? '' : `<div class="head-actions" style="margin-top:16px;justify-content:flex-end"><button class="btn primary" data-act="saveVatForm">Save VAT settings</button></div>`}</div></section>`;
  } else if (tab === 'lock') {
    body = `<section class="panel"><div class="panel-body" style="padding-top:18px;display:grid;gap:14px">
      <p style="margin:0">Nothing dated on or before the lock date can be added, changed or deleted, by anyone. Lock a period once its VAT return is filed or its accounts are signed off.</p>
      <div class="grid cols-3">${field('Lock everything up to and including', inp('lockDate', c.lockDate, 'date', can.lock() ? '' : 'readonly'))}</div>
      ${can.lock() ? `<div class="head-actions"><button class="btn primary" data-act="saveLock">Save lock date</button></div>` : callout('', 'Only the owner or the accountant can move the lock date.')}</div></section>`;
  } else if (tab === 'accounts') {
    const types = { income: 'Income', cos: 'Cost of sales', overhead: 'Overhead', fixed: 'Fixed asset', current_asset: 'Current asset', bank: 'Bank', current_liability: 'Liability', equity: 'Equity' };
    body = `<section class="panel"><div class="panel-head"><span class="sub">${(S.accounts || []).length} accounts</span>${can.edit() ? `<button class="btn primary" data-act="editAccount">${ico('plus')} Add account</button>` : ''}</div><div class="table-wrap"><table class="t"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Default VAT</th><th class="num">Postings</th><th></th></tr></thead><tbody>
      ${(S.accounts || []).slice().sort((a, b) => a.code.localeCompare(b.code)).map(a => { const n = E.ledger(S, { account: a.code }).length; return `<tr class="click" data-act="editAccount" data-id="${a.code}"><td class="mono">${a.code}</td><td>${esc(a.name)}</td><td class="muted">${types[a.type] || a.type}</td><td>${vatShort(a.vatDefault)}</td><td class="num">${n}</td><td>${a.archived ? '<span class="pill">Archived</span>' : ''}</td></tr>`; }).join('')}
    </tbody></table></div></section>`;
  } else if (tab === 'rules') {
    body = `<section class="panel"><div class="panel-head"><span class="sub">Bank lines whose payee or reference contains the text are coded automatically. First match wins.</span>${can.edit() ? `<button class="btn primary" data-act="editRule">${ico('plus')} Add rule</button>` : ''}</div><div class="table-wrap"><table class="t"><thead><tr><th>When the line contains</th><th>Direction</th><th>Account</th><th>VAT</th><th>Division</th><th>Contact</th></tr></thead><tbody>
      ${(S.rules || []).map(r => `<tr class="click" data-act="editRule" data-id="${r.id}"><td class="mono">${esc(r.match)}</td><td>${r.direction === 'in' ? 'Money in' : r.direction === 'out' ? 'Money out' : 'Either'}</td><td>${esc(acctLabel(r.account))}</td><td>${vatShort(r.vatCode)}</td><td>${r.division ? divChip(r.division) : '<span class="faint">—</span>'}</td><td class="muted">${esc(contactName(r.contactId))}</td></tr>`).join('') || `<tr><td colspan="6">${emptyState('No rules yet', 'Tick "Always code like this" when you code a bank line.')}</td></tr>`}
    </tbody></table></div></section>`;
  } else if (tab === 'users') {
    body = `<section class="panel"><div class="panel-head"><span class="sub">Only these email addresses can sign in and see the books.</span>${can.admin() ? `<button class="btn primary" data-act="editUser">${ico('plus')} Give someone access</button>` : ''}</div><div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Can</th></tr></thead><tbody>
      ${(S.users || []).map(u => `<tr${can.admin() ? ` class="click" data-act="editUser" data-id="${esc(u.email)}"` : ''}><td>${esc(u.name || '')}</td><td>${esc(u.email)}</td><td><span class="pill tint">${ROLE_LABEL[u.role] || u.role}</span></td><td class="muted wrap">${{ owner: 'Everything, including access and the lock date', director: 'Enter and change trading, payroll and staff records', bookkeeper: 'Enter and change trading records', accountant: 'Read everything, post journals, file VAT, move the lock date, export' }[u.role] || ''}</td></tr>`).join('')}
    </tbody></table></div></section>
    ${callout('', 'New people sign in with a one-time link sent to their email. Add their address here first; anyone else is turned away.')}`;
  }
  return head('Settings', null) + `<div class="stack"><div class="seg">${tabs.map(([k, l]) => `<button data-act="tab" data-page="settings" data-id="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}</div>`;
};
ACT.saveCompanyForm = async () => {
  const f = readForm($('#co-form')); const c = Object.assign({}, S.company, f, { nextInvoiceNo: +f.nextInvoiceNo || 1, paymentTerms: +f.paymentTerms || 30, associatedCompanies: +f.associatedCompanies || 0 });
  if (!/^\d{2}-\d{2}$/.test(c.yearEnd)) throw new Error('Write the year end as MM-DD, for example 03-31.');
  const dirs = (c.directors || []).map(d => Object.assign({}, d)); $$('[data-d]').forEach(el => { const d = dirs[+el.dataset.i]; d[el.dataset.d] = el.dataset.d === 'share' ? +el.value : el.value; });
  if (dirs.length && dirs.reduce((s, d) => s + d.share, 0) !== 100) throw new Error('Shareholdings must add up to 100%.');
  c.directors = dirs; await saveCompany(c, 'Company details saved'); UI.period = null; render();
};
ACT.saveVatForm = async () => {
  const f = readForm($('#vat-form')); const c = Object.assign({}, S.company, f, { vatStagger: +f.vatStagger, flatRate: +f.flatRate });
  if (c.vatRegistered && (!c.vatNumber || !c.vatRegDate)) throw new Error('Enter the VAT number and the effective date of registration.');
  await saveCompany(c, 'VAT settings saved'); render();
};
ACT.saveLock = async () => {
  const v = $('#f-lockDate').value; const c = Object.assign({}, S.company, { lockDate: v || null });
  if (S.company.lockDate && (!v || v < S.company.lockDate) && !await confirmSheet('Unlock a period', `Moving the lock date back from ${fdate(S.company.lockDate)} reopens filed periods to change. Continue?`, 'Unlock', true)) return;
  await saveCompany(c, v ? `Locked to ${fdate(v)}` : 'Lock removed'); render();
};
ACT.editAccount = (el) => {
  const ex = (S.accounts || []).find(a => a.code === el.dataset.id);
  const a = ex ? clone(ex) : { code: '', name: '', type: 'overhead', vatDefault: 'S20', archived: false };
  const system = ex && E.DEFAULT_ACCOUNTS.some(d => d.code === a.code); const used = ex && E.ledger(S, { account: a.code }).length;
  const ro = !can.edit();
  const sh = openSheet({ title: ex ? `${a.code} · ${a.name}` : 'Add account', size: 'narrow', body: `<div class="grid cols-2">
    ${field('Code', inp('code', a.code, 'text', ex || ro ? 'readonly' : 'placeholder="4 digits"'))}${field('Type', sel('type', [['income', 'Income'], ['cos', 'Cost of sales'], ['overhead', 'Overhead'], ['fixed', 'Fixed asset'], ['current_asset', 'Current asset'], ['bank', 'Bank'], ['current_liability', 'Liability'], ['equity', 'Equity']].map(([k, l]) => `<option value="${k}"${a.type === k ? ' selected' : ''}>${l}</option>`).join(''), system || used || ro ? 'disabled' : ''))}
    ${field('Name', inp('name', a.name, 'text', ro ? 'readonly' : ''), 2)}${field('Default VAT code', sel('vatDefault', vatOptions(a.vatDefault), ro ? 'disabled' : ''), 2)}
    <div class="field">${chk('archived', a.archived, 'Archived (hidden from pickers)')}</div></div>${system ? callout('', 'A standard account: its type is fixed so the reports stay correct.') : ''}`,
    foot: ro ? '' : `<button class="btn primary" data-c="save">Save</button>` });
  if (ro) return;
  sh.querySelector('[data-c="save"]').onclick = () => run(async () => { const f = readForm(sh); if (!/^\d{4}$/.test(f.code)) throw new Error('Codes are four digits.'); if (!ex && S.accounts.some(x => x.code === f.code)) throw new Error('That code is taken.'); Object.assign(a, f, { type: f.type || a.type }); await persist('accounts', a, 'Account saved'); closeSheet(); render(); });
};
ACT.editRule = (el) => {
  const ex = (S.rules || []).find(r => r.id === el.dataset.id);
  const r = ex ? clone(ex) : { id: uid(), match: '', direction: 'out', action: 'code', account: '5000', vatCode: 'Z0', division: null };
  const sh = openSheet({ title: ex ? 'Bank rule' : 'Add bank rule', size: 'narrow', body: `<div class="grid cols-2">
    ${field('When the payee or reference contains', inp('match', r.match), 2)}${field('Direction', sel('direction', [['out', 'Money out'], ['in', 'Money in'], ['any', 'Either']].map(([k, l]) => `<option value="${k}"${r.direction === k ? ' selected' : ''}>${l}</option>`).join('')))}${field('VAT code', sel('vatCode', vatOptions(r.vatCode)))}
    ${field('Account', sel('account', accountOptions(r.account)), 2)}${field('Division', sel('division', divOptions(r.division)))}${field('Contact', sel('contactId', contactOptions(r.contactId)))}</div>`,
    foot: `${ex ? '<button class="btn danger" data-c="del">Delete</button>' : ''}<button class="btn primary" data-c="save">Save</button>` });
  sh.querySelector('[data-c="save"]').onclick = () => run(async () => { const f = readForm(sh); if (!f.match.trim()) throw new Error('Enter the text to look for.'); Object.assign(r, f, { match: f.match.trim().toUpperCase(), division: f.division || null, contactId: f.contactId || null }); await persist('rules', r, 'Rule saved'); closeSheet(); render(); });
  const del = sh.querySelector('[data-c="del"]'); if (del) del.onclick = () => run(async () => { await removeRec('rules', r.id, 'Rule deleted'); closeSheet(); render(); });
};
ACT.editUser = (el) => {
  const ex = (S.users || []).find(u => u.email === el.dataset.id); const u = ex ? clone(ex) : { email: '', name: '', role: 'accountant' };
  const sh = openSheet({ title: ex ? u.email : 'Give someone access', size: 'narrow', body: `<div class="grid cols-2">${field('Email', inp('email', u.email, 'email', ex ? 'readonly' : ''), 2)}${field('Name', inp('name', u.name))}${field('Role', sel('role', ['owner', 'director', 'bookkeeper', 'accountant'].map(k => `<option value="${k}"${u.role === k ? ' selected' : ''}>${ROLE_LABEL[k]}</option>`).join('')))}</div>`,
    foot: `${ex && ex.email !== store.user.email ? '<button class="btn danger" data-c="del">Remove access</button>' : ''}<button class="btn primary" data-c="save">Save</button>` });
  sh.querySelector('[data-c="save"]').onclick = () => run(async () => { const f = readForm(sh); f.email = (f.email || '').trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(f.email)) throw new Error('Enter a valid email.'); Object.assign(u, f); await persist('users', u, 'Access saved'); closeSheet(); render(); });
  const del = sh.querySelector('[data-c="del"]'); if (del) del.onclick = () => run(async () => { if (!await confirmSheet('Remove access', `Stop ${esc(u.email)} signing in?`, 'Remove', true)) return; await removeRec('users', u.email, 'Access removed'); closeSheet(); render(); });
};

// ---------- boot ----------
function setupScreen() {
  const sql = window.SETUP_SQL || '';
  $('#root').innerHTML = `<div class="login"><div class="login-card" style="width:min(560px,100%)">
    <div class="brand" style="padding:0"><div class="brand-mark">D</div><div><div class="brand-name">Digby's</div><div class="brand-sub">Accounts</div></div></div>
    <h1>One-off database setup</h1>
    <p style="margin:0">The tables for the new books are not in Supabase yet. Copy the script, paste it into the Supabase SQL editor and press Run. It only adds new tables; nothing existing is changed.</p>
    <div class="head-actions"><button class="btn primary" id="cp-sql">Copy setup script</button><a class="btn" href="https://supabase.com/dashboard/project/jaajrllkozknilvmdezt/sql/new" target="_blank" rel="noopener">Open Supabase SQL editor</a></div>
    <textarea class="input mono" id="sql-box" readonly style="height:160px;font-size:11px">${esc(sql)}</textarea>
    <button class="btn" id="re-try">I've run it — reload</button></div></div>`;
  $('#cp-sql').onclick = () => { const box = $('#sql-box'); (navigator.clipboard ? navigator.clipboard.writeText(sql) : Promise.reject()).then(() => toast('Copied')).catch(() => { box.focus(); box.select(); toast('Selected — press Cmd+C'); }); };
  $('#re-try').onclick = () => location.reload();
}
function loginScreen(msg) {
  $('#root').innerHTML = `<div class="login"><form class="login-card" id="login">
    <div class="brand" style="padding:0"><div class="brand-mark">D</div><div><div class="brand-name">Digby's &amp; Co</div><div class="brand-sub">Accounts</div></div></div>
    <h1>Sign in</h1>${msg ? callout('bad', esc(msg)) : ''}
    ${field('Email', '<input class="input" id="lg-email" type="email" autocomplete="username" required>')}
    ${field('Password', '<input class="input" id="lg-pass" type="password" autocomplete="current-password">')}
    <button class="btn primary" type="submit" style="height:40px">Sign in</button>
    <button class="btn plain" type="button" id="lg-link">Email me a sign-in link instead</button>
    <p class="faint" style="margin:0;font-size:12.5px">Use the same email and password as the Digby's staff app. Only people the owner has given access can sign in.</p></form></div>`;
  $('#login').addEventListener('submit', (e) => { e.preventDefault(); run(async () => { await store.signIn($('#lg-email').value.trim(), $('#lg-pass').value); await start(); }); });
  $('#lg-link').addEventListener('click', () => run(async () => { const em = $('#lg-email').value.trim(); if (!em) throw new Error('Enter your email first.'); await store.sendLink(em); toast('Check your email for the sign-in link'); }));
}
async function start() {
  $('#root').innerHTML = `<div class="login"><div class="muted">Loading the books…</div></div>`;
  try {
    let ok;
    try { ok = await store.init(); } catch (e) { if (e.setup) return setupScreen(); throw e; }
    if (!ok) return loginScreen();
    S = await store.load();
    S.company = S.company || {};
    if (!S.company.name) S.company = Object.assign({ entityType: 'sole_trader', name: "Digby's Events & Catering", tradingName: "Digby's", ownerName: 'James Brierley', booksStart: '2026-04-06', yearEnd: '04-05', invoicePrefix: 'INV-', nextInvoiceNo: 188, paymentTerms: 30, bankAccountName: 'James Brierley', directors: [{ name: 'James Brierley', share: 100, dla: '2300' }], vatRegistered: false, registeredIn: 'England and Wales' }, S.company);
    const hash = (location.hash || '').replace('#', ''); if (hash && PAGES[hash]) UI.page = hash;
    render();
    if (store.mode === 'live') ACT.syncBank().catch(e => toast(e.message, true));
  } catch (e) { console.error(e); if (store.mode === 'live') loginScreen(e.message); else $('#root').innerHTML = `<div class="login"><div class="login-card"><h1>Could not load</h1><p>${esc(e.message)}</p></div></div>`; }
}
window.addEventListener('DOMContentLoaded', () => {
  store = MODE === 'demo' ? window.Stores.DemoStore() : window.Stores.LiveStore(LIVE_CONFIG);
  start();
});
window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (h && PAGES[h] && h !== UI.page) go(h); });
