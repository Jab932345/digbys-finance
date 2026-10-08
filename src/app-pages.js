/* ============================================================
   Pages
   ============================================================ */
const posted = (t) => E.POSTED(t);
const matchesDiv = (t) => UI.div === 'all' || t.division === UI.div || (t.lines || []).some(l => l.division === UI.div);
const statusPill = (st) => {
  const map = { paid: 'good', overdue: 'bad', awaiting: 'info', part: 'warn', draft: '', void: '' };
  return `<span class="pill ${map[st.key] || ''}">${esc(st.label)}</span>`;
};
const td0 = (p) => `<td class="num${(p || 0) < 0 ? ' neg' : ''}">${money0(p)}</td>`;
const colVal = (o) => UI.div === 'all' ? o.total : (o.cols[UI.div] || 0);

// ---------- Home ----------
PAGES.home = function () {
  const t = today(); const cy = E.companyYear(S.company, t);
  const p = E.pnl(S, cy);
  const tb = E.trialBalance(S, {});
  const bal = (code) => { const r = tb.rows.find(x => x.code === code); return r ? r.balance : 0; };
  const deb = E.aged(S, { at: t, kind: 'debtors' }); const cred = E.aged(S, { at: t, kind: 'creditors' });
  const overdueInv = (S.txns || []).filter(x => x.type === 'invoice' && E.docStatus(S, x, t).key === 'overdue');
  const unrec = (S.bankLines || []).filter(b => b.status === 'unreconciled');
  const ct = E.ctEstimate(S, cy);
  let vatTile;
  if (S.company.vatRegistered) {
    const per = E.vatPeriods(S.company, t).filter(x => !(S.vatReturns || []).some(r => r.from === x.from && r.status === 'filed'));
    const next = per[0];
    if (next) { const r = E.vatReturn(S, next); vatTile = `<button class="tile" data-go="vat"><span class="k">VAT ${fdateShort(next.from)} – ${fdateShort(next.to)}</span><span class="v">${money(r.boxes[5])}</span><span class="s">${r.boxes[5] >= 0 ? 'Payable' : 'Repayable'} · due ${fdate(next.due)}</span></button>`; }
    else vatTile = `<button class="tile" data-go="vat"><span class="k">VAT</span><span class="v">Up to date</span><span class="s">All returns filed</span></button>`;
  } else {
    const rt = E.rollingTurnover(S, t); const pct = Math.min(100, Math.round(rt.total / rt.threshold * 100));
    vatTile = `<button class="tile" data-go="vat"><span class="k">VAT threshold</span><span class="v">${pct}%</span><span class="s">${money0(rt.total)} of £90,000 · rolling 12 months</span></button>`;
  }
  const divRows = E.DIVISIONS.map(d => ({ d, inc: p.totals.income.cols[d.id] || 0, gp: p.totals.grossProfit.cols[d.id] || 0, np: p.totals.netProfit.cols[d.id] || 0 }));
  const maxInc = Math.max(1, ...divRows.map(r => r.inc));

  // attention list
  const att = [];
  if (unrec.length) att.push(['bank', 'warn', `${plural(unrec.length, 'bank line')} to reconcile`, money(unrec.reduce((s, b) => s + E.P(b.amount), 0))]);
  if (overdueInv.length) att.push(['invoices', 'bad', `${plural(overdueInv.length, 'invoice')} overdue`, money(overdueInv.reduce((s, x) => s + E.docStatus(S, x, t).due, 0))]);
  const drafts = (S.txns || []).filter(x => x.type === 'invoice' && x.status === 'draft');
  if (drafts.length) att.push(['invoices', '', `${plural(drafts.length, 'draft invoice')} not sent`, '']);
  const billsDue = (S.txns || []).filter(x => x.type === 'bill' && posted(x) && x.dueDate && x.dueDate <= E.addDays(t, 7) && E.docStatus(S, x, t).due > 0);
  if (billsDue.length) att.push(['bills', 'warn', `${plural(billsDue.length, 'bill')} due within 7 days`, money(billsDue.reduce((s, x) => s + E.docStatus(S, x, t).due, 0))]);
  const unposted = (S.payrollRuns || []).filter(r => r.status !== 'posted');
  if (unposted.length) att.push(['payroll', '', `${plural(unposted.length, 'payroll run')} not posted to the ledger`, '']);
  const soon = E.addDays(t, 60);
  (S.staff || []).filter(s => s.active !== false).forEach(s => {
    if (s.rtwExpiry && s.rtwExpiry <= soon) att.push(['staff', s.rtwExpiry < t ? 'bad' : 'warn', `${s.name}: right to work ${s.rtwExpiry < t ? 'expired' : 'expires'} ${fdate(s.rtwExpiry)}`, '']);
    if (s.firstAidExpiry && s.firstAidExpiry <= soon) att.push(['staff', 'warn', `${s.name}: first aid certificate ${s.firstAidExpiry < t ? 'expired' : 'expires'} ${fdate(s.firstAidExpiry)}`, '']);
    if (s.foodHygieneExpiry && s.foodHygieneExpiry <= soon) att.push(['staff', 'warn', `${s.name}: food hygiene ${s.foodHygieneExpiry < t ? 'expired' : 'expires'} ${fdate(s.foodHygieneExpiry)}`, '']);
  });
  (S.company.directors || []).forEach(d => { const l = E.dla(S, d.dla); if (l.overdrawn) att.push(['dla', 'bad', `${d.name}'s loan account is overdrawn`, money(-l.balance)]); });

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; })();
  const first = (store.user.name || '').split(' ')[0];

  return head(`${greeting}${first && MODE !== 'demo' ? ', ' + first : ''}`, `${esc(S.company.name)} · financial year ${fdate(cy.from)} to ${fdate(cy.to)}`, divisionControl()) + `
  <div class="stack">
    <div class="tiles three">
      <button class="tile" data-go="bank"><span class="k">Cash at bank</span><span class="v">${money(bal('1200') + bal('1210') + bal('1230'))}</span><span class="s">${unrec.length ? plural(unrec.length, 'line') + ' waiting to reconcile' : 'Fully reconciled'}</span></button>
      <button class="tile" data-go="invoices"><span class="k">Owed to you</span><span class="v">${money(deb.totals.total)}</span><span class="s">${overdueInv.length ? overdueInv.length + ' overdue' : 'Nothing overdue'}</span></button>
      <button class="tile" data-go="bills"><span class="k">You owe suppliers</span><span class="v">${money(cred.totals.total)}</span><span class="s">${plural(cred.rows.length, 'supplier')}</span></button>
      ${vatTile}
      <button class="tile" data-go="pnl"><span class="k">${UI.div === 'all' ? 'Profit this year' : divName(UI.div) + ' profit this year'}</span><span class="v${colVal(p.totals.netProfit) < 0 ? ' neg' : ''}">${money(colVal(p.totals.netProfit))}</span><span class="s">Sales ${money0(colVal(p.totals.income))} · before tax</span></button>
      <button class="tile" data-go="notes"><span class="k">Corporation tax estimate</span><span class="v">${money(ct.tax)}</span><span class="s">${esc(ct.band)}</span></button>
    </div>
    <div class="row-2">
      <section class="panel"><div class="panel-head"><h2>Net profit by month</h2><span class="sub">${UI.div === 'all' ? 'All divisions' : divName(UI.div)} · before tax</span></div><div class="panel-body">${monthChart(cy)}</div></section>
      <section class="panel"><div class="panel-head"><h2>Divisions</h2><span class="sub">This financial year</span></div><div class="panel-body"><div class="bars">
        ${divRows.map(r => `<div class="bar-row"><span><span class="dot ${r.d.id}"></span> ${r.d.name}</span><div class="bar-track" data-tip="${r.d.name}: sales ${money(r.inc)}, gross profit ${money(r.gp)}, net profit ${money(r.np)}"><div class="bar-fill" style="width:${Math.max(1, r.inc / maxInc * 100)}%;background:var(--d-${r.d.id})"></div></div><span class="num">${money0(r.inc)}</span></div>`).join('')}
      </div>
      <div class="table-wrap" style="margin-top:14px"><table class="t"><thead><tr><th>Division</th><th class="num">Sales</th><th class="num">Gross profit</th><th class="num">Net profit</th></tr></thead><tbody>
        ${divRows.map(r => `<tr><td><span class="dot ${r.d.id}"></span> ${r.d.name}</td>${td0(r.inc)}${td0(r.gp)}${td0(r.np)}</tr>`).join('')}
        <tr><td class="muted">Central overheads</td><td></td><td></td>${td0(p.totals.netProfit.cols.none || 0)}</tr>
        <tr class="total"><td>Company</td>${td0(p.totals.income.total)}${td0(p.totals.grossProfit.total)}${td0(p.totals.netProfit.total)}</tr>
      </tbody></table></div></div></section>
    </div>
    <section class="panel"><div class="panel-head"><h2>Needs attention</h2><span class="sub">${att.length ? plural(att.length, 'item') : 'All clear'}</span></div>
      <div class="list">${att.length ? att.map(([pg, lvl, text, amt]) => `<button class="list-row" data-go="${pg}"><span class="pill ${lvl}">${ico(lvl === 'bad' || lvl === 'warn' ? 'warn' : 'info')}</span><span class="grow title">${esc(text)}</span><span class="num muted">${amt}</span></button>`).join('') : emptyState('Nothing waiting', 'Every bank line is reconciled and nothing is overdue.')}</div>
    </section>
  </div>`;
};
PAGES.home.mount = () => {};

function niceStep(range) { const raw = range / 4; const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1)))); const n = raw / mag; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag; }
function monthChart(cy) {
  const months = []; let m = cy.from.slice(0, 7) + '-01'; const end = E.parse(today()) < E.parse(cy.to) ? today() : cy.to;
  while (m <= end && months.length < 13) { const to = E.endOfMonth(m); const p = E.pnl(S, { from: m < cy.from ? cy.from : m, to }); months.push({ m, v: colVal(p.totals.netProfit) }); m = E.addMonths(m, 1); }
  if (!months.length) return emptyState('No months yet', 'Profit appears here once the first month has transactions.');
  const W = 640, H = 230, L = 64, R = 12, T = 12, B = 30;
  const vals = months.map(x => x.v / 100); const maxV = Math.max(0, ...vals), minV = Math.min(0, ...vals);
  const step = niceStep(Math.max(1, maxV - minV)); const top = Math.ceil(maxV / step) * step || step; const bot = Math.floor(minV / step) * step;
  const y = (v) => T + (top - v) / (top - bot) * (H - T - B);
  const bw = (W - L - R) / months.length; const ticks = []; for (let v = bot; v <= top + 1e-9; v += step) ticks.push(v);
  const color = UI.div === 'all' ? 'var(--tint)' : `var(--d-${UI.div})`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Net profit by month">
    <g class="grid">${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v < 0 ? '−' : ''}£${Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(Math.abs(v) % 1000 ? 1 : 0) + 'k' : Math.abs(v)}</text>`).join('')}</g>
    <line class="zero" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>
    ${months.map((x, i) => { const v = x.v / 100; const bx = L + i * bw + bw * 0.2; const w = bw * 0.6; const y0 = y(0), y1 = y(v); const h = Math.max(1, Math.abs(y1 - y0)); const ry = Math.min(y0, y1);
      return `<g class="col"><rect class="b${v < 0 ? ' neg' : ''}" x="${bx}" y="${ry}" width="${w}" height="${h}" rx="3" style="${v < 0 ? '' : 'fill:' + color}"/><rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" data-tip="${E.parse(x.m).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}: ${money(x.v)}"/><text x="${L + i * bw + bw / 2}" y="${H - 10}" text-anchor="middle">${E.parse(x.m).toLocaleDateString('en-GB', { month: 'short' })}</text></g>`; }).join('')}
  </svg>`;
}

// ---------- Sales invoices ----------
PAGES.invoices = function () {
  const t = today(); const tab = UI.tab.invoices || 'all';
  const docs = (S.txns || []).filter(x => (x.type === 'invoice' || x.type === 'credit_note') && matchesDiv(x)).map(x => ({ x, st: E.docStatus(S, x, t) }));
  const counts = {}; docs.forEach(d => { counts[d.st.key] = (counts[d.st.key] || 0) + 1; });
  const shown = docs.filter(d => tab === 'all' ? true : tab === 'awaiting' ? ['awaiting', 'part'].includes(d.st.key) : d.st.key === tab)
    .sort((a, b) => (b.x.date || '').localeCompare(a.x.date || '') || (b.x.ref || '').localeCompare(a.x.ref || ''));
  const sumDue = (keys) => docs.filter(d => keys.includes(d.st.key) && d.x.type === 'invoice').reduce((s, d) => s + d.st.due, 0);
  const tabs = [['all', 'All'], ['draft', 'Draft'], ['awaiting', 'Awaiting payment'], ['overdue', 'Overdue'], ['paid', 'Paid']];
  return head('Invoices', 'Every invoice carries a division, so sales split cleanly across Events, Pies, Butchery and Hire.',
    (can.edit() ? `<button class="btn primary" data-act="newDoc" data-type="invoice">${ico('plus')} New invoice</button><button class="btn" data-act="newDoc" data-type="credit_note">Credit note</button>` : '')) + `
  <div class="stack">
    <div class="tiles">
      <div class="tile"><span class="k">Awaiting payment</span><span class="v">${money(sumDue(['awaiting', 'part']))}</span><span class="s">${plural((counts.awaiting || 0) + (counts.part || 0), 'invoice')}</span></div>
      <div class="tile"><span class="k">Overdue</span><span class="v${sumDue(['overdue']) ? ' neg' : ''}">${money(sumDue(['overdue']))}</span><span class="s">${plural(counts.overdue || 0, 'invoice')}</span></div>
      <div class="tile"><span class="k">Drafts</span><span class="v">${counts.draft || 0}</span><span class="s">Not yet numbered or sent</span></div>
      <div class="tile"><span class="k">Next invoice number</span><span class="v">${esc((S.company.invoicePrefix || '') + (S.company.nextInvoiceNo || 1))}</span><span class="s">One sequence across all divisions</span></div>
    </div>
    <section class="panel">
      <div class="panel-head"><div class="seg">${tabs.map(([k, l]) => `<button data-act="tab" data-page="invoices" data-id="${k}" class="${tab === k ? 'on' : ''}">${l}${k !== 'all' && counts[k === 'awaiting' ? 'awaiting' : k] ? ` <span class="badge">${k === 'awaiting' ? (counts.awaiting || 0) + (counts.part || 0) : counts[k]}</span>` : ''}</button>`).join('')}</div>${divisionControl()}</div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Number</th><th>Customer</th><th>Division</th><th>Job</th><th>Date</th><th>Due</th><th class="num">Total</th><th class="num">Outstanding</th><th>Status</th></tr></thead><tbody>
      ${shown.length ? shown.map(({ x, st }) => `<tr class="click" data-act="openDoc" data-id="${x.id}"><td>${x.ref ? esc(x.ref) : '<span class="faint">Draft</span>'}${x.type === 'credit_note' ? ' <span class="pill">Credit</span>' : ''}${lockedDate(x.date) ? ' ' + ico('lock').replace('<svg', '<svg style="width:12px;height:12px;stroke:var(--fg-3);fill:none;stroke-width:2;vertical-align:-1px"') : ''}</td><td>${esc(contactName(x.contactId))}</td><td>${divChip(x.division)}</td><td class="mono">${esc(x.jobCode || '')}</td><td>${fdate(x.date)}</td><td>${fdate(x.dueDate)}</td>${td$(x.type === 'credit_note' ? -st.gross : st.gross)}${td$(st.due)}<td>${statusPill(st)}</td></tr>`).join('') : `<tr><td colspan="9">${emptyState('No invoices here', tab === 'all' ? 'Create the first invoice to start the sales ledger.' : 'Nothing matches this filter.')}</td></tr>`}
      </tbody></table></div>
    </section>
  </div>`;
};
ACT.tab = (el) => { UI.tab[el.dataset.page] = el.dataset.id; render(); };

// ---------- Bills ----------
PAGES.bills = function () {
  const t = today(); const tab = UI.tab.bills || 'all';
  const docs = (S.txns || []).filter(x => (x.type === 'bill' || x.type === 'supplier_credit') && matchesDiv(x)).map(x => ({ x, st: E.docStatus(S, x, t) }));
  const shown = docs.filter(d => tab === 'all' ? true : tab === 'awaiting' ? ['awaiting', 'part'].includes(d.st.key) : d.st.key === tab).sort((a, b) => (b.x.date || '').localeCompare(a.x.date || ''));
  const tabs = [['all', 'All'], ['draft', 'Draft'], ['awaiting', 'To pay'], ['overdue', 'Overdue'], ['paid', 'Paid']];
  const due = docs.filter(d => ['awaiting', 'part', 'overdue'].includes(d.st.key)).reduce((s, d) => s + d.st.due, 0);
  return head('Bills', 'Supplier invoices you have received. Card and bank spends that never had an invoice are coded on the Bank page.',
    (can.edit() ? `<button class="btn primary" data-act="newDoc" data-type="bill">${ico('plus')} New bill</button><button class="btn" data-act="newDoc" data-type="supplier_credit">Supplier credit</button>` : '')) + `
  <section class="panel">
    <div class="panel-head"><div class="seg">${tabs.map(([k, l]) => `<button data-act="tab" data-page="bills" data-id="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><span class="sub">${money(due)} to pay</span>${divisionControl()}</div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Supplier</th><th>Reference</th><th>Division</th><th>Date</th><th>Due</th><th class="num">Total</th><th class="num">Outstanding</th><th>Status</th></tr></thead><tbody>
    ${shown.length ? shown.map(({ x, st }) => `<tr class="click" data-act="openDoc" data-id="${x.id}"><td>${esc(contactName(x.contactId) || x.description)}</td><td class="mono">${esc(x.ref || '')}</td><td>${divChip(x.division)}</td><td>${fdate(x.date)}</td><td>${fdate(x.dueDate)}</td>${td$(st.gross)}${td$(st.due)}<td>${statusPill(st)}</td></tr>`).join('') : `<tr><td colspan="8">${emptyState('No bills here', '')}</td></tr>`}
    </tbody></table></div>
  </section>`;
};

// ---------- Contacts ----------
function contactsPage(kind) {
  const t = today(); const cy = E.companyYear(S.company, t);
  const types = kind === 'customer' ? ['invoice', 'receipt'] : ['bill', 'spend'];
  const rows = (S.contacts || []).filter(c => c.kind === kind || c.kind === 'both').map(c => {
    const docs = (S.txns || []).filter(x => x.contactId === c.id && posted(x));
    const year = docs.filter(x => types.includes(x.type) && E.inRange(x.date, cy.from, cy.to)).reduce((s, x) => s + E.txnGross(x), 0);
    const out = docs.filter(x => x.type === (kind === 'customer' ? 'invoice' : 'bill')).reduce((s, x) => s + E.docStatus(S, x, t).due, 0);
    return { c, year, out, n: docs.length };
  }).filter(r => UI.div === 'all' || r.c.division === UI.div).sort((a, b) => b.year - a.year || a.c.name.localeCompare(b.c.name));
  return head(kind === 'customer' ? 'Customers' : 'Suppliers', null, `${divisionControl()}${can.edit() ? `<button class="btn primary" data-act="editContact" data-kind="${kind}">${ico('plus')} New ${kind}</button>` : ''}`) + `
  <section class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Usual division</th><th class="num">${kind === 'customer' ? 'Sales' : 'Spend'} this year</th><th class="num">Outstanding</th><th class="num">Transactions</th></tr></thead><tbody>
  ${rows.length ? rows.map(r => `<tr class="click" data-act="editContact" data-id="${r.c.id}"><td>${esc(r.c.name)}</td><td>${r.c.division ? divChip(r.c.division) : '<span class="faint">—</span>'}</td>${td$(r.year)}${td$(r.out)}<td class="num">${r.n}</td></tr>`).join('') : `<tr><td colspan="5">${emptyState('None yet', '')}</td></tr>`}
  </tbody></table></div></section>`;
}
PAGES.customers = () => contactsPage('customer');
PAGES.suppliers = () => contactsPage('supplier');

// ---------- Bank ----------
function suggestFor(bl) {
  const amt = E.P(bl.amount); const t = today();
  const docs = (S.txns || []).filter(x => (amt > 0 ? x.type === 'invoice' : x.type === 'bill') && posted(x));
  const refHit = docs.find(x => x.ref && ((bl.reference || '') + ' ' + (bl.counterparty || '')).toUpperCase().includes(String(x.ref).toUpperCase()) && E.docStatus(S, x, t).due === Math.abs(amt));
  const amtHit = refHit || docs.find(x => E.docStatus(S, x, t).due === Math.abs(amt));
  if (amtHit) return { kind: 'match', doc: amtHit, text: `Matches ${amtHit.type === 'invoice' ? 'invoice' : 'bill'} ${amtHit.ref || ''} · ${contactName(amtHit.contactId)}` };
  const hay = `${bl.counterparty || ''} ${bl.reference || ''}`.toUpperCase();
  const rule = (S.rules || []).find(r => r.match && hay.includes(String(r.match).toUpperCase()) && (!r.direction || r.direction === 'any' || (r.direction === 'in') === (amt > 0)));
  if (rule) return { kind: 'rule', rule, text: `Rule: ${acctLabel(rule.account)} · ${vatShort(rule.vatCode)}${rule.division ? ' · ' + divName(rule.division) : ''}` };
  return null;
}
PAGES.bank = function () {
  const tab = UI.tab.bank || 'reconcile';
  const tb = E.trialBalance(S, {}); const ledgerBank = (tb.rows.find(r => r.code === '1200') || { balance: 0 }).balance;
  const unrec = (S.bankLines || []).filter(b => b.status === 'unreconciled').sort((a, b) => a.date.localeCompare(b.date));
  const unrecTotal = unrec.reduce((s, b) => s + E.P(b.amount), 0);
  const stmt = S.starlingBalance != null ? E.P(S.starlingBalance) : null;
  const diff = stmt == null ? null : stmt - unrecTotal - ledgerBank;
  const tabs = [['reconcile', 'Reconcile'], ['statement', 'Bank feed'], ['coded', 'Spend & receive money']];
  let body = '';
  if (tab === 'reconcile') {
    body = `<section class="panel"><div class="panel-head"><h2>Starling business account</h2><div class="head-actions">${S.lastSync ? `<span class="sub">Synced ${fts(S.lastSync)}</span>` : ''}<button class="btn" data-act="syncBank">${ico('refresh')} Sync now</button>${unrec.some(b => suggestFor(b)) && can.edit() ? `<button class="btn primary" data-act="acceptAll">${ico('check')} Accept all suggestions</button>` : ''}</div></div>
      <div class="panel-body"><dl class="kv">
        <dt>Statement balance</dt><dd class="num" style="text-align:left">${stmt == null ? '<span class="faint">Sync to fetch</span>' : money(stmt)}</dd>
        <dt>Less unreconciled lines</dt><dd class="num" style="text-align:left">${money(-unrecTotal)}</dd>
        <dt>Balance in the books</dt><dd class="num" style="text-align:left">${money(ledgerBank)}</dd>
        <dt>Difference</dt><dd>${diff == null ? '—' : diff === 0 ? `<span class="pill good">${ico('check')} Agrees to the penny</span>` : `<span class="pill bad">${money(diff)}</span>`}</dd>
      </dl></div>
      <div class="list">${unrec.length ? unrec.map(b => { const sg = suggestFor(b); return `<div class="list-row" style="flex-wrap:wrap">
          <div class="grow" style="min-width:200px"><div class="title">${esc(b.counterparty || 'Unknown')}</div><div class="meta">${fdate(b.date)} · ${esc(b.reference || '')}${sg ? ` · <span style="color:var(--tint)">${esc(sg.text)}</span>` : ''}</div></div>
          <div class="num" style="min-width:110px;font-weight:650${E.P(b.amount) < 0 ? '' : ';color:var(--good)'}">${money(E.P(b.amount))}</div>
          ${can.edit() ? `<div class="head-actions">${sg ? `<button class="btn sm primary" data-act="acceptLine" data-id="${b.id}">Accept</button>` : ''}<button class="btn sm tinted" data-act="codeLine" data-id="${b.id}">Code</button><button class="btn sm" data-act="matchLine" data-id="${b.id}">Match</button><button class="btn sm plain" data-act="excludeLine" data-id="${b.id}">Exclude</button></div>` : ''}
        </div>`; }).join('') : emptyState('All reconciled', 'Every line on the bank feed is matched to the books.')}</div></section>`;
  } else if (tab === 'statement') {
    const lines = (S.bankLines || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    body = `<section class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Counterparty</th><th>Reference</th><th class="num">Amount</th><th>Status</th><th>Posted as</th></tr></thead><tbody>
      ${lines.map(b => { const tx = (S.txns || []).find(x => x.id === b.txnId); return `<tr${tx ? ` class="click" data-act="openDoc" data-id="${tx.id}"` : ''}><td>${fdate(b.date)}</td><td>${esc(b.counterparty)}</td><td class="muted">${esc(b.reference)}</td>${td$(E.P(b.amount))}<td><span class="pill ${b.status === 'reconciled' ? 'good' : b.status === 'excluded' ? '' : 'warn'}">${b.status === 'reconciled' ? 'Reconciled' : b.status === 'excluded' ? 'Excluded' : 'Unreconciled'}</span></td><td class="muted">${tx ? esc(tx.type.replace('_', ' ') + (tx.ref ? ' ' + tx.ref : '')) : ''}</td></tr>`; }).join('')}
      </tbody></table></div></section>`;
  } else {
    const coded = (S.txns || []).filter(x => (x.type === 'receipt' || x.type === 'spend' || x.type === 'transfer') && matchesDiv(x)).sort((a, b) => b.date.localeCompare(a.date));
    body = `<section class="panel"><div class="panel-head"><span class="sub">Money in and out coded straight from the bank, without an invoice or bill.</span><div class="head-actions">${divisionControl()}${can.edit() ? `<button class="btn" data-act="newDoc" data-type="receipt">Receive money</button><button class="btn" data-act="newDoc" data-type="spend">Spend money</button>` : ''}</div></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Division</th><th>VAT</th><th class="num">Amount</th></tr></thead><tbody>
    ${coded.map(x => { const l0 = (x.lines || [])[0] || {}; const g = E.txnGross(x) * (x.type === 'spend' ? -1 : 1); return `<tr class="click" data-act="openDoc" data-id="${x.id}"><td>${fdate(x.date)}</td><td>${esc(x.description || contactName(x.contactId))}</td><td class="muted">${(x.lines || []).length > 1 ? 'Split' : esc(acctLabel(l0.account))}</td><td>${divChip(x.division || l0.division)}</td><td>${(x.lines || []).length > 1 ? 'Split' : vatShort(l0.vatCode)}</td>${td$(g)}</tr>`; }).join('')}
    </tbody></table></div></section>`;
  }
  return head('Bank & reconcile', 'The Starling feed comes in automatically. Each line is matched to an invoice or bill, or coded to an account with its VAT and division.') + `
    <div class="stack"><div class="seg">${tabs.map(([k, l]) => `<button data-act="tab" data-page="bank" data-id="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'reconcile' && unrec.length ? ` <span class="badge">${unrec.length}</span>` : ''}</button>`).join('')}</div>${body}</div>`;
};

// ---------- VAT ----------
PAGES.vat = function () {
  const t = today(); const c = S.company;
  if (!c.vatRegistered) {
    const rt = E.rollingTurnover(S, t); const pct = Math.min(100, rt.total / rt.threshold * 100);
    return head('VAT', 'Not VAT registered. Turnover is watched against the registration threshold every day.') + `
    <div class="stack">
      <section class="panel"><div class="panel-head"><h2>Registration threshold</h2><span class="sub">Rolling 12 months ${fdate(rt.from)} – ${fdate(rt.to)}</span></div><div class="panel-body">
        <div style="font:650 30px/1.2 var(--font-display);font-variant-numeric:tabular-nums">${money0(rt.total)} <span class="muted" style="font-size:16px;font-weight:500">of £90,000</span></div>
        <div class="bar-track" style="height:14px;margin:12px 0"><div class="bar-fill" style="width:${pct}%;background:${pct > 85 ? 'var(--bad)' : pct > 65 ? 'var(--warn)' : 'var(--good)'}"></div></div>
        <p class="muted" style="margin:0">Taxable turnover only: exempt and outside-the-scope income are left out. You must register within 30 days of the end of any month where the past 12 months pass £90,000, or straight away if you expect to pass it in the next 30 days alone.</p>
      </div></section>
      ${callout('', 'When you register, enter the VAT number, effective date, scheme and stagger in <a href="#settings" data-go="settings">Settings</a>. Every transaction from that date picks up VAT codes, and quarterly returns appear here automatically. Transactions already entered keep their codes, so nothing needs re-keying.')}
    </div>`;
  }
  const periods = E.vatPeriods(c, E.addMonths(t, 3)).reverse();
  const key = UI.sel.vat || (periods.find(p => p.from <= t && !(S.vatReturns || []).some(r => r.from === p.from && r.status === 'filed') && p.to < t) || periods.find(p => p.from <= t) || periods[0] || {}).key;
  const period = periods.find(p => p.key === key);
  const filedRec = period && (S.vatReturns || []).find(r => r.from === period.from && r.status === 'filed');
  const ret = period ? E.vatReturn(S, period) : null;
  const B = ret ? (filedRec ? Object.assign({}, ret.boxes, filedRec.boxes) : ret.boxes) : {};
  const changed = filedRec && ret && Object.keys(ret.boxes).some(k => ret.boxes[k] !== filedRec.boxes[k]);
  const schemeName = { standard: 'Standard (invoice basis)', cash: 'Cash accounting', flat: `Flat rate ${c.flatRate}%` }[c.vatScheme || 'standard'];
  const boxes = [
    [1, 'VAT due on sales and other outputs', ''], [2, 'VAT due on acquisitions from the EU', 'Northern Ireland goods only'], [3, 'Total VAT due', 'Box 1 + box 2'],
    [4, 'VAT reclaimed on purchases and other inputs', c.vatScheme === 'flat' ? 'Capital goods over £2,000 only' : ''], [5, 'Net VAT to pay HMRC or reclaim', 'Box 3 − box 4'],
    [6, 'Total value of sales excluding VAT', c.vatScheme === 'flat' ? 'Flat rate turnover, VAT inclusive' : 'Whole pounds'], [7, 'Total value of purchases excluding VAT', 'Whole pounds'],
    [8, 'Supplies of goods to the EU', 'Northern Ireland only'], [9, 'Acquisitions of goods from the EU', 'Northern Ireland only']
  ];
  const byCode = {}; (ret ? ret.entries : []).forEach(e => { const k = e.kind + '|' + e.code; byCode[k] = byCode[k] || { kind: e.kind, code: e.code, net: 0, vat: 0, n: 0 }; byCode[k].net += e.net; byCode[k].vat += e.vat; byCode[k].n++; });
  const status = (p) => { const f = (S.vatReturns || []).find(r => r.from === p.from && r.status === 'filed'); if (f) return '<span class="pill good">Filed</span>'; if (p.from > t) return '<span class="pill">Future</span>'; if (p.to >= t) return '<span class="pill info">Open</span>'; return p.due < t ? '<span class="pill bad">Overdue</span>' : '<span class="pill warn">Ready to file</span>'; };
  return head('VAT', `${esc(c.vatNumber || '')} · ${schemeName} · registered from ${fdate(c.vatRegDate)}`, can.file() && period && !filedRec && period.to < t ? `<button class="btn" data-act="exportVat" data-key="${period.key}">${ico('down')} Export return</button><button class="btn primary" data-act="fileVat" data-key="${period.key}">Mark as filed</button>` : period ? `<button class="btn" data-act="exportVat" data-key="${period.key}">${ico('down')} Export return</button>` : '') + `
  <div class="stack">
    <div class="row-2">
      <section class="panel"><div class="panel-head"><h2>${period ? `${fdate(period.from)} – ${fdate(period.to)}` : 'No periods yet'}</h2>${period ? `<span class="sub">Due ${fdate(period.due)} · ${status(period)}</span>` : ''}</div>
        ${changed ? `<div class="panel-body">${callout('bad', 'Figures recalculated today differ from the filed return. Something dated inside this period changed after filing; check the audit trail.')}</div>` : ''}
        ${filedRec ? `<div class="panel-body" style="padding-bottom:6px">${callout('good', `Filed ${fts(filedRec.filedAt)} by ${esc(filedRec.filedBy || '')}${filedRec.receipt ? ' · ' + esc(filedRec.receipt) : ''}. The period is locked.`)}</div>` : ''}
        <div class="vat-form">${period ? boxes.map(([n, l, s]) => `<div class="vat-box${n === 5 ? ' key' : ''}"><span class="n">${n}</span><span class="lbl">${l}${s ? `<small>${s}</small>` : ''}</span><span class="amt">${n >= 6 ? money0(B[n]) : money(B[n])}</span></div>`).join('') : ''}</div>
      </section>
      <section class="panel"><div class="panel-head"><h2>Periods</h2></div><div class="list">
        ${periods.map(p => `<button class="list-row" data-act="vatPeriod" data-key="${p.key}" style="${p.key === key ? 'background:var(--tint-soft)' : ''}"><span class="grow"><span class="title">${fdateShort(p.from)} – ${fdate(p.to)}</span><span class="meta">Due ${fdate(p.due)}</span></span>${status(p)}</button>`).join('')}
      </div></section>
    </div>
    ${ret ? `<section class="panel"><div class="panel-head"><h2>How the boxes are made up</h2><span class="sub">${ret.entries.length} tax-point entries · ${c.vatScheme === 'cash' ? 'dated by payment' : 'dated by invoice'}</span></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Side</th><th>VAT code</th><th class="num">Entries</th><th class="num">Net</th><th class="num">VAT</th><th>Boxes</th></tr></thead><tbody>
      ${Object.values(byCode).sort((a, b) => a.kind.localeCompare(b.kind) || a.code.localeCompare(b.code)).map(r => `<tr><td>${r.kind === 'sale' ? 'Sales' : 'Purchases'}</td><td>${esc(E.VAT_CODES[r.code].label)}</td><td class="num">${r.n}</td>${td$(r.net)}${td$(r.vat)}<td class="muted">${r.kind === 'sale' ? '1, 6' : '4, 7'}</td></tr>`).join('') || `<tr><td colspan="6">${emptyState('Nothing in this period yet', '')}</td></tr>`}
      </tbody></table></div></section>` : ''}
    ${callout('', 'This system prepares and exports the return; it does not submit to HMRC. Your accountant imports the exported CSV into MTD-recognised software. HMRC accepts CSV import and export as a digital link (VAT Notice 700/22), so the chain from bank feed to submitted return stays digital with no re-keying.')}
  </div>`;
};
ACT.vatPeriod = (el) => { UI.sel.vat = el.dataset.key; render(); };

// ---------- Payroll ----------
PAGES.payroll = function () {
  const ty = E.taxYearStart(today());
  const runs = (S.payrollRuns || []).slice().sort((a, b) => b.payDate.localeCompare(a.payDate));
  const yr = runs.filter(r => E.taxYearStart(r.payDate) === ty);
  const tot = (k) => yr.reduce((s, r) => s + (r.lines || []).reduce((a, l) => a + E.P(l[k]), 0), 0);
  const ea = yr.reduce((s, r) => s + E.P(r.eaOffset), 0);
  const pill = (s) => s === 'posted' ? '<span class="pill good">Posted</span>' : s === 'final' ? '<span class="pill info">Final figures</span>' : '<span class="pill warn">Estimate</span>';
  return head('Payroll', `Hours and pay rates are captured here and exported to the payroll provider, who runs RTI. Their final figures come back and post to the ledger as one journal per run.`, can.edit() ? `<button class="btn primary" data-act="editRun">${ico('plus')} New pay run</button>` : '') + `
  <div class="stack">
    <div class="tiles">
      <div class="tile"><span class="k">Gross pay ${E.taxYearLabel(ty)}</span><span class="v">${money(tot('gross'))}</span><span class="s">${plural(yr.length, 'run')}</span></div>
      <div class="tile"><span class="k">PAYE and employee NIC</span><span class="v">${money(tot('paye') + tot('eeNic'))}</span><span class="s">Deducted from pay</span></div>
      <div class="tile"><span class="k">Employer NIC</span><span class="v">${money(tot('erNic'))}</span><span class="s">15% above £${E.PAYROLL.monthly.ST}/month</span></div>
      <div class="tile"><span class="k">Employment Allowance</span><span class="v">${money(ea)}</span><span class="s">of £10,500 used this tax year</span></div>
    </div>
    <section class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>Pay date</th><th>Period</th><th class="num">Staff</th><th class="num">Hours</th><th class="num">Gross</th><th class="num">PAYE + NIC</th><th class="num">Employer NIC</th><th class="num">Net pay</th><th>Status</th></tr></thead><tbody>
    ${runs.length ? runs.map(r => { const s = (k) => (r.lines || []).reduce((a, l) => a + E.P(l[k]), 0); return `<tr class="click" data-act="editRun" data-id="${r.id}"><td>${fdate(r.payDate)}</td><td class="muted">${fdateShort(r.periodFrom)} – ${fdate(r.periodTo)}</td><td class="num">${(r.lines || []).length}</td><td class="num">${(r.lines || []).reduce((a, l) => a + (+l.hours || 0), 0)}</td>${td$(s('gross'))}${td$(s('paye') + s('eeNic'))}${td$(s('erNic'))}${td$(s('net'))}<td>${pill(r.status)}</td></tr>`; }).join('') : `<tr><td colspan="9">${emptyState('No pay runs yet', 'Add staff first, then create a pay run from their hours.')}</td></tr>`}
    </tbody></table></div></section>
    ${callout('', `Estimates use ${E.PAYROLL.taxYear} rates on a Week 1/Month 1 basis: personal allowance £12,570, employee NIC 8% above £${E.PAYROLL.monthly.PT}/month, employer NIC 15% above £${E.PAYROLL.monthly.ST}/month. Casual staff on irregular hours can be paid rolled-up holiday pay at 12.07%, shown as its own line on the payslip.`)}
  </div>`;
};

// ---------- Staff ----------
PAGES.staff = function () {
  const t = today(); const soon = E.addDays(t, 60);
  const exp = (d) => !d ? '' : d < t ? `<span class="pill bad">Expired</span>` : d <= soon ? `<span class="pill warn">${fdateShort(d)}</span>` : '';
  const list = (S.staff || []).filter(s => UI.div === 'all' || s.division === UI.div).sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name));
  return head('Staff', 'Employment records, right to work, emergency contacts, allergies and certificates in one place.', `${divisionControl()}${can.edit() ? `<button class="btn primary" data-act="editStaff">${ico('plus')} Add staff</button>` : ''}`) + `
  <section class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Role</th><th>Division</th><th class="num">Rate</th><th>Right to work</th><th>Allergies</th><th>Emergency contact</th><th>Certificates</th></tr></thead><tbody>
  ${list.length ? list.map(s => `<tr class="click" data-act="editStaff" data-id="${s.id}"><td>${esc(s.name)}${s.active === false ? ' <span class="pill">Left</span>' : ''}</td><td class="muted">${esc(s.role || '')}</td><td>${divChip(s.division)}</td><td class="num">${s.payRate ? '£' + (+s.payRate).toFixed(2) : '—'}</td><td>${s.rtwDate ? `<span class="pill good">${ico('check')} ${esc(s.rtwDoc || 'Checked')}</span> ${exp(s.rtwExpiry)}` : '<span class="pill bad">Not recorded</span>'}</td><td>${s.allergies && !/^none$/i.test(s.allergies) ? `<span class="pill warn">${esc(s.allergies)}</span>` : '<span class="faint">None</span>'}</td><td class="muted">${esc(s.emergencyName || '—')}${s.emergencyPhone ? ' · ' + esc(s.emergencyPhone) : ''}</td><td>${s.foodHygiene ? `<span class="pill">${esc(s.foodHygiene)}</span> ` : ''}${s.firstAid ? '<span class="pill">First aid</span> ' : ''}${exp(s.foodHygieneExpiry)}${exp(s.firstAidExpiry)}</td></tr>`).join('') : `<tr><td colspan="8">${emptyState('No staff yet', '')}</td></tr>`}
  </tbody></table></div></section>`;
};

// ---------- Mileage ----------
PAGES.mileage = function () {
  const ty = UI.sel.mileageYear || E.taxYearStart(today());
  const claims = E.mileageClaims(S, ty);
  const trips = claims.flatMap(c => c.trips).sort((a, b) => b.date.localeCompare(a.date));
  const unclaimed = trips.filter(x => !x.claimTxnId);
  return head('Mileage', `HMRC approved mileage rates: 45p a mile for the first 10,000 business miles in a tax year, 25p after, plus 5p per passenger. Tax year ${E.taxYearLabel(ty)}.`, `${can.edit() ? `<button class="btn" data-act="trackTrip">${ico('car')} Track a trip</button><button class="btn primary" data-act="editTrip">${ico('plus')} Log a trip</button>` : ''}`) + `
  <div class="stack">
    <div class="tiles">${claims.length ? claims.map(c => `<div class="tile"><span class="k">${esc(c.driver)}</span><span class="v">${c.miles.toLocaleString('en-GB')} mi</span><span class="s">Claim ${money(c.claim)} · ${c.miles > 10000 ? 'over' : Math.max(0, 10000 - c.miles).toLocaleString('en-GB') + ' mi left at'} 45p</span></div>`).join('') : '<div class="tile"><span class="k">No trips this tax year</span><span class="v">0 mi</span></div>'}</div>
    <section class="panel"><div class="panel-head"><h2>Trips</h2><div class="head-actions">${unclaimed.length && can.edit() ? `<button class="btn tinted" data-act="postMileage">Post ${plural(unclaimed.length, 'unclaimed trip')}</button>` : ''}</div></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Driver</th><th>Journey</th><th>Purpose</th><th>Job</th><th class="num">Miles</th><th>Rate</th><th class="num">Claim</th><th>Recorded</th><th>Claimed</th></tr></thead><tbody>
    ${trips.length ? trips.map(x => `<tr class="click" data-act="editTrip" data-id="${x.id}"><td>${fdate(x.date)}</td><td>${esc(x.driver)}</td><td class="wrap">${esc(x.from || '')} → ${esc(x.to || '')}</td><td class="muted">${esc(x.purpose || '')}</td><td class="mono">${esc(x.jobCode || '')}</td><td class="num">${(+x.miles).toLocaleString('en-GB')}</td><td>${x.rate}</td>${td$(x.claimP)}<td>${x.method === 'gps' ? '<span class="pill info">GPS</span>' : '<span class="pill">Manual</span>'}</td><td>${x.claimTxnId ? '<span class="pill good">Posted</span>' : '<span class="pill warn">No</span>'}</td></tr>`).join('') : `<tr><td colspan="10">${emptyState('No trips', '')}</td></tr>`}
    </tbody></table></div></section>
  </div>`;
};

// ---------- Directors' loans ----------
PAGES.dla = function () {
  const dirs = S.company.directors || [];
  const cy = E.companyYear(S.company, today());
  const bs = E.balanceSheet(S, { at: today() }); const ct = E.ctEstimate(S, cy);
  const reserves = bs.totals.equity - ((bs.equity.find(r => r.code === '3000') || {}).amount || 0) - ct.tax;
  return head("Directors' loans", 'Money a director puts in or takes out, expenses paid personally, mileage owed and dividends credited all run through these accounts.', can.edit() ? `<button class="btn" data-act="dividend">Declare dividend</button><button class="btn primary" data-act="newJournal">${ico('plus')} Journal</button>` : (can.journal() ? `<button class="btn primary" data-act="newJournal">${ico('plus')} Journal</button>` : '')) + `
  <div class="stack">
    <div class="tiles">${dirs.map(d => { const l = E.dla(S, d.dla); return `<div class="tile"><span class="k">${esc(d.name)} · ${d.share}% shareholder</span><span class="v${l.overdrawn ? ' neg' : ''}">${money(Math.abs(l.balance))}</span><span class="s">${l.balance >= 0 ? 'Company owes the director' : 'Director owes the company'}</span></div>`; }).join('')}
      <div class="tile"><span class="k">Distributable reserves (estimate)</span><span class="v">${money(reserves)}</span><span class="s">Retained profit less corporation tax estimate</span></div></div>
    ${dirs.some(d => E.dla(S, d.dla).overdrawn) ? callout('bad', 'An overdrawn director’s loan still outstanding nine months and one day after the year end triggers a section 455 tax charge, and a balance over £10,000 at any point is a benefit in kind. Clear it with a dividend, salary or repayment before then.') : ''}
    ${dirs.map(d => { const l = E.dla(S, d.dla); return `<section class="panel"><div class="panel-head"><h2>${esc(d.name)}</h2><span class="sub">${acctLabel(d.dla)}</span></div><div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Description</th><th class="num">Owed to director</th><th class="num">Owed to company</th><th class="num">Balance</th></tr></thead><tbody>
      ${l.lines.length ? l.lines.map(r => `<tr class="click" data-act="openDoc" data-id="${r.txnId}"><td>${fdate(r.date)}</td><td>${esc(r.desc || r.ref)}</td><td class="num">${r.credit ? money(r.credit) : ''}</td><td class="num">${r.debit ? money(r.debit) : ''}</td>${td$(r.balance)}</tr>`).join('') : `<tr><td colspan="5">${emptyState('No movements', '')}</td></tr>`}
      </tbody></table></div></section>`; }).join('')}
  </div>`;
};

// ---------- Fixed assets ----------
PAGES.assets = function () {
  const rows = E.ledger(S, {}).filter(p => ['0010', '0020', '0030'].includes(p.account));
  const dep = E.ledger(S, {}).filter(p => ['0011', '0021', '0031'].includes(p.account));
  const cat = { '0010': 'Kitchen equipment', '0020': 'Motor vehicle', '0030': 'Hire stock' };
  const by = (code) => rows.filter(r => r.account === code).reduce((s, r) => s + r.debit - r.credit, 0);
  const dby = (code) => dep.filter(r => r.account === code).reduce((s, r) => s + r.debit - r.credit, 0);
  return head('Fixed assets', 'Built from purchases coded to the fixed asset accounts. Kitchen equipment and hire stock qualify for the 100% Annual Investment Allowance; cars do not.') + `
  <div class="stack">
    <div class="tiles">${Object.entries(cat).map(([code, name]) => `<div class="tile"><span class="k">${name}</span><span class="v">${money(by(code) + dby(String(+code + 1).padStart(4, '0')))}</span><span class="s">Cost ${money(by(code))} · depreciation ${money(-dby(String(+code + 1).padStart(4, '0')))}</span></div>`).join('')}</div>
    <section class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Asset</th><th>Category</th><th>Division</th><th>Supplier</th><th class="num">Cost</th><th>Capital allowance</th></tr></thead><tbody>
    ${rows.length ? rows.map(r => `<tr class="click" data-act="openDoc" data-id="${r.txnId}"><td>${fdate(r.date)}</td><td>${esc(r.desc)}</td><td>${cat[r.account]}</td><td>${divChip(r.division)}</td><td class="muted">${esc(contactName(r.contactId))}</td>${td$(r.debit - r.credit)}<td>${r.account === '0020' ? '<span class="pill warn">Writing down allowance — check CO₂</span>' : '<span class="pill good">AIA 100%</span>'}</td></tr>`).join('') : `<tr><td colspan="7">${emptyState('No fixed assets', 'Code a purchase to 0010, 0020 or 0030 and it appears here.')}</td></tr>`}
    </tbody></table></div></section>
    ${callout('', 'Depreciation is left to year end: your accountant posts it as a journal to 8500 and the matching depreciation account, and it is added back for corporation tax.')}
  </div>`;
};

// ---------- Job codes ----------
function jobFigures(code) {
  const led = E.ledger(S, {}).filter(p => p.jobCode === code); const acc = ACC();
  let rev = 0, cost = 0;
  led.forEach(p => { const a = acc[p.account]; if (!a) return; if (a.type === 'income') rev += p.credit - p.debit; else if (a.type === 'cos' || a.type === 'overhead') cost += p.debit - p.credit; });
  const miles = (S.mileage || []).filter(m => m.jobCode === code).reduce((s, m) => s + (+m.miles || 0), 0);
  const mileCost = E.P(miles * 0.45);
  return { rev, cost, miles, mileCost, profit: rev - cost - mileCost };
}
PAGES.jobs = function () {
  const list = (S.jobCodes || []).filter(j => UI.div === 'all' || j.division === UI.div).sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));
  return head('Job codes', 'The same code ties an event’s invoice, its shopping, its staff hours and its mileage together, so each job shows its real margin.', `${divisionControl()}${can.edit() ? `<button class="btn primary" data-act="editJob">${ico('plus')} New job code</button>` : ''}`) + `
  <section class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>Code</th><th>Job</th><th>Division</th><th>Date</th><th class="num">Sales</th><th class="num">Direct costs</th><th class="num">Mileage</th><th class="num">Profit</th><th class="num">Margin</th></tr></thead><tbody>
  ${list.length ? list.map(j => { const f = jobFigures(j.code); return `<tr class="click" data-act="editJob" data-id="${esc(j.code)}"><td class="mono">${esc(j.code)}</td><td>${esc(j.name)}</td><td>${divChip(j.division)}</td><td>${fdate(j.eventDate)}</td>${td$(f.rev)}${td$(f.cost)}${td$(f.mileCost)}${td$(f.profit)}<td class="num">${f.rev ? Math.round(f.profit / f.rev * 100) + '%' : '—'}</td></tr>`; }).join('') : `<tr><td colspan="9">${emptyState('No job codes', '')}</td></tr>`}
  </tbody></table></div></section>`;
};

// ---------- Reports ----------
function pnlTable(p, single) {
  const cols = single ? [single] : E.DIV_IDS.concat(['none']);
  const hd = `<tr><th>Account</th>${cols.map(c => `<th class="num">${c === 'none' ? 'Unallocated' : `<span class="dot ${c}"></span> ${divName(c)}`}</th>`).join('')}${single ? '' : '<th class="num">Total</th>'}</tr>`;
  const row = (l) => `<tr class="click" data-act="glAccount" data-code="${l.code}"><td>${l.code} · ${esc(l.name)}</td>${cols.map(c => td$(l.cols[c] || 0)).join('')}${single ? '' : td$(l.total)}</tr>`;
  const sub = (label, o, cls) => `<tr class="${cls || 'sub'}"><td>${label}</td>${cols.map(c => td$(o.cols[c] || 0)).join('')}${single ? '' : td$(o.total)}</tr>`;
  const grp = (label) => `<tr class="group"><td colspan="${cols.length + 2}">${label}</td></tr>`;
  return `<table class="t"><thead>${hd}</thead><tbody>
    ${grp('Turnover')}${p.income.map(row).join('')}${sub('Total turnover', p.totals.income)}
    ${grp('Cost of sales')}${p.cos.map(row).join('')}${sub('Total cost of sales', p.totals.cos)}
    ${sub('Gross profit', p.totals.grossProfit, 'total')}
    ${grp('Overheads')}${p.overheads.map(row).join('')}${sub('Total overheads', p.totals.overheads)}
    ${sub('Net profit before tax', p.totals.netProfit, 'total')}
  </tbody></table>`;
}
PAGES.pnl = function () {
  const per = currentPeriod(); const p = E.pnl(S, per);
  const ct = UI.div === 'all' ? E.ctEstimate(S, per) : null;
  return head('Profit & loss', `${fdate(per.from)} – ${fdate(per.to)} · by division`, `${divisionControl()}<button class="btn" data-act="csv" data-report="pnl">${ico('down')} CSV</button>`) + `
  <div class="stack">${periodControl()}
    <section class="panel"><div class="table-wrap">${pnlTable(p, UI.div === 'all' ? null : UI.div)}</div></section>
    ${ct ? `<section class="panel"><div class="panel-head"><h2>Corporation tax estimate</h2><span class="sub">${esc(ct.band)}</span></div><div class="panel-body"><dl class="kv">
      <dt>Profit before tax</dt><dd>${money(ct.pbt)}</dd><dt>Add back depreciation</dt><dd>${money(ct.depreciationAddBack)}</dd><dt>Less Annual Investment Allowance</dt><dd>${money(-ct.aia)}</dd><dt>Taxable profit (estimate)</dt><dd><strong>${money(ct.taxable)}</strong></dd><dt>Corporation tax</dt><dd><strong>${money(ct.tax)}</strong></dd>
      <dt>Limits used</dt><dd>${money0(ct.lower)} / ${money0(ct.upper)} after period length and ${S.company.associatedCompanies || 0} associated companies</dd></dl></div></section>` : ''}
  </div>`;
};
PAGES.balance = function () {
  const per = currentPeriod(); const b = E.balanceSheet(S, { at: per.to < today() ? per.to : today() });
  const rows = (arr, neg) => arr.map(r => `<tr class="click" data-act="glAccount" data-code="${r.code.slice(0, 4)}"><td>${esc(r.code)} · ${esc(r.name)}</td>${td$(neg ? -r.amount : r.amount)}</tr>`).join('');
  return head('Balance sheet', `As at ${fdate(b.at)}`, `<button class="btn" data-act="csv" data-report="balance">${ico('down')} CSV</button>`) + `
  <div class="stack">${periodControl()}
  <section class="panel"><div class="panel-head"><h2>${esc(S.company.name)}</h2>${b.balanced ? `<span class="pill good">${ico('check')} Balances</span>` : '<span class="pill bad">Does not balance</span>'}</div><div class="table-wrap"><table class="t"><tbody>
    <tr class="group"><td colspan="2">Fixed assets</td></tr>${rows(b.fixed)}<tr class="sub"><td>Total fixed assets</td>${td$(b.totals.fixed)}</tr>
    <tr class="group"><td colspan="2">Current assets</td></tr>${rows(b.current)}<tr class="sub"><td>Total current assets</td>${td$(b.totals.current)}</tr>
    <tr class="group"><td colspan="2">Creditors: due within one year</td></tr>${rows(b.liabilities)}<tr class="sub"><td>Total creditors</td>${td$(b.totals.liabilities)}</tr>
    <tr class="sub"><td>Net current assets</td>${td$(b.totals.netCurrent)}</tr>
    <tr class="total"><td>Net assets</td>${td$(b.totals.netAssets)}</tr>
    <tr class="group"><td colspan="2">Capital and reserves</td></tr>${rows(b.equity)}<tr><td>Profit and loss account</td>${td$(b.profitToDate)}</tr>
    <tr class="total"><td>Shareholders' funds</td>${td$(b.totals.equity)}</tr>
  </tbody></table></div></section></div>`;
};
PAGES.tb = function () {
  const per = currentPeriod(); const at = per.to < today() ? per.to : today(); const tb = E.trialBalance(S, { to: at });
  return head('Trial balance', `As at ${fdate(at)} · every account, debits against credits`, `<button class="btn" data-act="csv" data-report="tb">${ico('down')} CSV</button>`) + `
  <div class="stack">${periodControl()}
  <section class="panel"><div class="panel-head"><span></span>${tb.balanced ? `<span class="pill good">${ico('check')} Debits equal credits</span>` : '<span class="pill bad">Out of balance</span>'}</div><div class="table-wrap"><table class="t"><thead><tr><th>Code</th><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>
  ${tb.rows.map(r => `<tr class="click" data-act="glAccount" data-code="${r.code}"><td class="mono">${r.code}</td><td>${esc(r.name)}</td><td class="num">${r.debit ? money(r.debit) : ''}</td><td class="num">${r.credit ? money(r.credit) : ''}</td></tr>`).join('')}
  <tr class="total"><td></td><td>Total</td>${td$(tb.totals.debit)}${td$(tb.totals.credit)}</tr></tbody></table></div></section></div>`;
};
ACT.glAccount = (el) => { UI.sel.gl = el.dataset.code; go('gl'); };
PAGES.gl = function () {
  const per = currentPeriod(); const code = UI.sel.gl || '1200';
  const open = E.ledger(S, { to: E.addDays(per.from, -1), account: code }).reduce((s, p) => s + p.debit - p.credit, 0);
  const rows = E.ledger(S, { from: per.from, to: per.to, account: code }); let bal = open;
  return head('General ledger', 'Every posting to one account, with its running balance.', `<button class="btn" data-act="csv" data-report="gl">${ico('down')} Full ledger CSV</button>`) + `
  <div class="stack"><div class="head-actions" style="justify-content:space-between"><select class="input" style="max-width:420px" data-on="glAcc" aria-label="Account">${accountOptions(code)}</select>${periodControl()}</div>
  <section class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Type</th><th>Ref</th><th>Description</th><th>Contact</th><th>Division</th><th>VAT</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead><tbody>
  <tr class="sub"><td>${fdate(per.from)}</td><td colspan="8">Opening balance</td>${td$(open)}</tr>
  ${rows.map(p => { bal += p.debit - p.credit; return `<tr class="click" data-act="openDoc" data-id="${p.txnId}"><td>${fdate(p.date)}</td><td class="muted">${esc(p.type.replace('_', ' '))}</td><td class="mono">${esc(p.ref)}</td><td class="wrap">${esc(p.desc)}</td><td class="muted">${esc(contactName(p.contactId))}</td><td>${p.division ? `<span class="dot ${p.division}"></span> ${divName(p.division)}` : ''}</td><td>${p.vatCode ? vatShort(p.vatCode) : ''}</td><td class="num">${p.debit ? money(p.debit) : ''}</td><td class="num">${p.credit ? money(p.credit) : ''}</td>${td$(bal)}</tr>`; }).join('')}
  <tr class="total"><td colspan="9">Closing balance</td>${td$(bal)}</tr></tbody></table></div></section></div>`;
};
INPUT.glAcc = (el) => { UI.sel.gl = el.value; render(); };
PAGES.aged = function () {
  const kind = UI.tab.aged || 'debtors'; const at = today(); const a = E.aged(S, { at, kind });
  return head('Aged debts', `As at ${fdate(at)} · by days past the due date`, `<div class="seg"><button data-act="tab" data-page="aged" data-id="debtors" class="${kind === 'debtors' ? 'on' : ''}">Owed to you</button><button data-act="tab" data-page="aged" data-id="creditors" class="${kind === 'creditors' ? 'on' : ''}">You owe</button></div><button class="btn" data-act="csv" data-report="aged">${ico('down')} CSV</button>`) + `
  <section class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>${kind === 'debtors' ? 'Customer' : 'Supplier'}</th><th class="num">Not yet due</th><th class="num">1–30 days</th><th class="num">31–60</th><th class="num">61–90</th><th class="num">Over 90</th><th class="num">Total</th></tr></thead><tbody>
  ${a.rows.length ? a.rows.map(r => `<tr class="click" data-act="editContact" data-id="${r.contactId || ''}"><td>${esc(contactName(r.contactId) || 'No contact')}</td>${a.buckets.map(b => r[b] ? td$(r[b]) : '<td></td>').join('')}${td$(r.total)}</tr>`).join('') : `<tr><td colspan="7">${emptyState('Nothing outstanding', '')}</td></tr>`}
  <tr class="total"><td>Total</td>${a.buckets.map(b => td$(a.totals[b])).join('')}${td$(a.totals.total)}</tr></tbody></table></div></section>`;
};

// ---------- Audit ----------
PAGES.audit = function () {
  const f = UI.filter.audit || '';
  const rows = (S.audit || []).slice().sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).filter(a => !f || `${a.user} ${a.action} ${a.summary} ${a.entity}`.toLowerCase().includes(f.toLowerCase())).slice(0, 500);
  return head('Audit trail', MODE === 'live' ? 'Written by the database itself on every insert, change and delete. Nobody can edit or remove an entry, including the owner.' : 'Every change records who made it, when, and the before and after values.', `<button class="btn" data-act="csv" data-report="audit">${ico('down')} CSV</button>`) + `
  <div class="stack"><input class="input" style="max-width:360px" placeholder="Filter by person, action or record" value="${esc(f)}" data-on="auditFilter" aria-label="Filter audit trail">
  <section class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead><tbody>
  ${rows.length ? rows.map(a => `<tr${a.before || a.after ? ` class="click" data-act="auditDetail" data-id="${a.id}"` : ''}><td>${fts(a.ts)}</td><td>${esc(a.user)}</td><td><span class="pill ${a.action === 'delete' ? 'bad' : a.action === 'create' ? 'good' : 'info'}">${esc(a.action)}</span></td><td class="muted">${esc(a.entity)}</td><td class="wrap">${esc(a.summary || '')}</td></tr>`).join('') : `<tr><td colspan="5">${emptyState('No entries', '')}</td></tr>`}
  </tbody></table></div></section></div>`;
};
INPUT.auditFilter = (el) => { UI.filter.audit = el.value; render(); };
ACT.auditDetail = (el) => {
  const a = (S.audit || []).find(x => String(x.id) === el.dataset.id); if (!a) return;
  openSheet({ title: `${a.action} · ${a.entity}`, size: 'wide', body: `<dl class="kv"><dt>When</dt><dd>${fts(a.ts)}</dd><dt>Who</dt><dd>${esc(a.user)}</dd><dt>Summary</dt><dd>${esc(a.summary || '')}</dd></dl>
    <div class="grid cols-2"><div><div class="nav-label" style="padding-left:0">Before</div><div class="code-view">${esc(a.before ? JSON.stringify(a.before, null, 2) : '—')}</div></div><div><div class="nav-label" style="padding-left:0">After</div><div class="code-view">${esc(a.after ? JSON.stringify(a.after, null, 2) : '—')}</div></div></div>` });
};
