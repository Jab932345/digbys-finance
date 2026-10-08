/* ============================================================
   Accountant export pack, report CSVs, system notes
   ============================================================ */
function exportFiles(per) {
  const at = per.to < today() ? per.to : today();
  const acc = ACC();
  const txById = {}; (S.txns || []).forEach(t => txById[t.id] = t);
  const files = [];
  const add = (name, desc, cols, rows) => files.push({ name, desc, rows: rows.length, csv: toCSV(cols, rows) });
  const staffById = {}; (S.staff || []).forEach(s => staffById[s.id] = s);

  const gl = E.ledger(S, { from: per.from, to: per.to });
  add('general_ledger.csv', 'Every double-entry posting: one row per debit or credit', [
    { h: 'date', v: 'date' }, { h: 'transaction_id', v: 'txnId' }, { h: 'type', v: 'type' }, { h: 'reference', v: 'ref' },
    { h: 'contact', v: r => contactName(r.contactId) }, { h: 'description', v: 'desc' },
    { h: 'account_code', v: 'account' }, { h: 'account_name', v: r => acctName(r.account) }, { h: 'account_type', v: r => (acc[r.account] || {}).type || '' },
    { h: 'debit', v: r => dec(r.debit) }, { h: 'credit', v: r => dec(r.credit) },
    { h: 'vat_code', v: r => r.vatCode || '' }, { h: 'line_net', v: r => r.vatCode ? dec(r.net) : '' }, { h: 'line_vat', v: r => r.vatCode ? dec(r.vat) : '' },
    { h: 'division', v: r => r.division || '' }, { h: 'job_code', v: r => r.jobCode || '' },
    { h: 'bank_line_id', v: r => (txById[r.txnId] || {}).bankLineId || '' }, { h: 'created_by', v: r => (txById[r.txnId] || {}).createdBy || '' },
    { h: 'created_at', v: r => (txById[r.txnId] || {}).createdAt || '' }, { h: 'updated_at', v: r => (txById[r.txnId] || {}).updatedAt || '' }
  ], gl);

  const lineRows = [];
  (S.txns || []).filter(t => E.inRange(t.date, per.from, per.to) && !['journal', 'payroll', 'customer_payment', 'supplier_payment', 'transfer'].includes(t.type)).forEach(t => {
    const st = ['invoice', 'bill', 'credit_note', 'supplier_credit'].includes(t.type) ? E.docStatus(S, t, at) : null;
    (t.lines || []).forEach((l, i) => lineRows.push({ t, l, i, st }));
  });
  add('transactions.csv', 'Invoices, bills, credits and coded bank items at line level with VAT', [
    { h: 'date', v: r => r.t.date }, { h: 'due_date', v: r => r.t.dueDate || '' }, { h: 'type', v: r => r.t.type }, { h: 'status', v: r => r.t.status || 'approved' },
    { h: 'reference', v: r => r.t.ref || '' }, { h: 'contact', v: r => contactName(r.t.contactId) }, { h: 'description', v: r => r.t.description || '' },
    { h: 'line', v: r => r.i + 1 }, { h: 'line_description', v: r => r.l.description || '' }, { h: 'account_code', v: r => r.l.account }, { h: 'account_name', v: r => acctName(r.l.account) },
    { h: 'quantity', v: r => r.l.qty == null ? '' : r.l.qty }, { h: 'unit_price', v: r => r.l.unitPrice == null ? '' : (+r.l.unitPrice).toFixed(2) },
    { h: 'net', v: r => dec(E.P(r.l.net)) }, { h: 'vat_code', v: r => r.l.vatCode || '' }, { h: 'vat_rate', v: r => ((E.VAT_CODES[r.l.vatCode] || {}).rate || 0) * 100 },
    { h: 'vat', v: r => dec(E.P(r.l.vat)) }, { h: 'gross', v: r => dec(E.P(r.l.net) + E.P(r.l.vat)) },
    { h: 'division', v: r => r.l.division || r.t.division || '' }, { h: 'job_code', v: r => r.l.jobCode || r.t.jobCode || '' },
    { h: 'document_outstanding', v: r => r.st && r.i === 0 ? dec(r.st.due) : '' }, { h: 'transaction_id', v: r => r.t.id }
  ], lineRows);

  const tb = E.trialBalance(S, { to: at });
  add('trial_balance.csv', `Trial balance at ${at}`, [{ h: 'account_code', v: 'code' }, { h: 'account_name', v: 'name' }, { h: 'account_type', v: 'type' }, { h: 'debit', v: r => dec(r.debit) }, { h: 'credit', v: r => dec(r.credit) }],
    tb.rows.concat([{ code: '', name: 'TOTAL', type: '', debit: tb.totals.debit, credit: tb.totals.credit }]));

  const p = E.pnl(S, per); const pcols = E.DIV_IDS.concat(['none']);
  const prow = (label, o, code) => Object.assign({ code: code || '', label }, ...pcols.map(c => ({ [c]: dec(o.cols[c] || 0) })), { total: dec(o.total) });
  const prows = [].concat(p.income.map(l => prow(l.name, l, l.code)), [prow('Total turnover', p.totals.income)], p.cos.map(l => prow(l.name, l, l.code)), [prow('Total cost of sales', p.totals.cos), prow('Gross profit', p.totals.grossProfit)], p.overheads.map(l => prow(l.name, l, l.code)), [prow('Total overheads', p.totals.overheads), prow('Net profit before tax', p.totals.netProfit)]);
  add('profit_and_loss.csv', 'Profit and loss with a column per division', [{ h: 'account_code', v: 'code' }, { h: 'line', v: 'label' }].concat(pcols.map(c => ({ h: c === 'none' ? 'unallocated' : c, v: c }))).concat([{ h: 'total', v: 'total' }]), prows);

  const b = E.balanceSheet(S, { at });
  const brows = [].concat(b.fixed.map(r => ['Fixed assets', r]), b.current.map(r => ['Current assets', r]), b.liabilities.map(r => ['Creditors within one year', r]), b.equity.map(r => ['Capital and reserves', r]), [['Capital and reserves', { code: '', name: 'Profit and loss account', amount: b.profitToDate }]]);
  add('balance_sheet.csv', `Balance sheet at ${at}`, [{ h: 'section', v: r => r[0] }, { h: 'account_code', v: r => r[1].code }, { h: 'account_name', v: r => r[1].name }, { h: 'amount', v: r => dec(r[1].amount) }],
    brows.concat([['Net assets', { code: '', name: 'Net assets', amount: b.totals.netAssets }], ["Shareholders' funds", { code: '', name: "Shareholders' funds", amount: b.totals.equity }]]));

  if (S.company.vatRegistered) {
    const periods = E.vatPeriods(S.company, at).filter(x => x.to >= per.from && x.from <= per.to);
    add('vat_returns.csv', 'Nine-box VAT returns for each period in range', [{ h: 'period_from', v: 'from' }, { h: 'period_to', v: 'to' }, { h: 'due', v: 'due' }, { h: 'status', v: 'status' }].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ h: 'box_' + n, v: r => dec(r.boxes[n]) }))).concat([{ h: 'filed_at', v: 'filedAt' }, { h: 'receipt', v: 'receipt' }, { h: 'scheme', v: () => S.company.vatScheme || 'standard' }]),
      periods.map(x => { const f = (S.vatReturns || []).find(r => r.from === x.from && r.status === 'filed'); const r = E.vatReturn(S, x); return Object.assign({}, x, { boxes: f ? f.boxes : r.boxes, status: f ? 'filed' : (x.to < today() ? 'ready' : 'open'), filedAt: f ? f.filedAt : '', receipt: f ? f.receipt : '' }); }));
    const ve = E.vatEntries(S).filter(e => E.inRange(e.date, per.from, per.to));
    add('vat_detail.csv', 'Every VAT entry by tax point date', [{ h: 'tax_point', v: 'date' }, { h: 'side', v: 'kind' }, { h: 'reference', v: 'ref' }, { h: 'description', v: 'desc' }, { h: 'account_code', v: 'account' }, { h: 'vat_code', v: 'code' }, { h: 'net', v: r => dec(r.net) }, { h: 'vat', v: r => dec(r.vat) }, { h: 'gross', v: r => dec(r.gross) }, { h: 'division', v: r => r.division || '' }, { h: 'transaction_id', v: 'txnId' }], ve);
  }

  ['debtors', 'creditors'].forEach(kind => {
    const a = E.aged(S, { at, kind }); const rows = []; a.rows.forEach(r => r.docs.forEach(d => rows.push(Object.assign({ contact: contactName(r.contactId) }, d))));
    add(`aged_${kind}.csv`, `Outstanding ${kind === 'debtors' ? 'sales invoices' : 'bills'} at ${at}`, [{ h: 'contact', v: 'contact' }, { h: 'reference', v: 'ref' }, { h: 'date', v: 'date' }, { h: 'due_date', v: 'dueDate' }, { h: 'bucket', v: 'bucket' }, { h: 'outstanding', v: r => dec(r.due) }], rows);
  });

  const docCols = [{ h: 'reference', v: r => r.ref || '' }, { h: 'type', v: 'type' }, { h: 'status', v: r => E.docStatus(S, r, at).label }, { h: 'date', v: 'date' }, { h: 'due_date', v: r => r.dueDate || '' }, { h: 'contact', v: r => contactName(r.contactId) }, { h: 'division', v: r => r.division || '' }, { h: 'job_code', v: r => r.jobCode || '' }, { h: 'net', v: r => dec(E.lineTotals(r.lines).net) }, { h: 'vat', v: r => dec(E.lineTotals(r.lines).vat) }, { h: 'gross', v: r => dec(E.lineTotals(r.lines).gross) }, { h: 'paid', v: r => dec(E.allocatedTo(S, r.id)) }, { h: 'outstanding', v: r => dec(E.docStatus(S, r, at).due) }];
  add('sales_invoices.csv', 'Sales invoices and credit notes', docCols, (S.txns || []).filter(t => ['invoice', 'credit_note'].includes(t.type) && E.inRange(t.date, per.from, per.to)));
  add('bills.csv', 'Supplier bills and credits', docCols, (S.txns || []).filter(t => ['bill', 'supplier_credit'].includes(t.type) && E.inRange(t.date, per.from, per.to)));

  add('bank_feed.csv', 'Starling feed lines and how each was posted', [{ h: 'date', v: 'date' }, { h: 'counterparty', v: 'counterparty' }, { h: 'reference', v: 'reference' }, { h: 'amount', v: r => (+r.amount).toFixed(2) }, { h: 'status', v: 'status' }, { h: 'transaction_id', v: r => r.txnId || '' }, { h: 'bank_line_id', v: 'id' }], (S.bankLines || []).filter(bl => E.inRange(bl.date, per.from, per.to)).sort((x, y) => x.date.localeCompare(y.date)));

  add('chart_of_accounts.csv', 'Nominal codes in use', [{ h: 'account_code', v: 'code' }, { h: 'account_name', v: 'name' }, { h: 'account_type', v: 'type' }, { h: 'default_vat_code', v: 'vatDefault' }, { h: 'archived', v: r => r.archived ? 'yes' : 'no' }], S.accounts || []);
  add('contacts.csv', 'Customers and suppliers', [{ h: 'id', v: 'id' }, { h: 'type', v: 'kind' }, { h: 'name', v: 'name' }, { h: 'email', v: 'email' }, { h: 'phone', v: 'phone' }, { h: 'address', v: 'address' }, { h: 'vat_number', v: r => r.vatNumber || '' }, { h: 'usual_division', v: r => r.division || '' }], S.contacts || []);
  add('fixed_assets.csv', 'Additions and disposals on the fixed asset accounts', [{ h: 'date', v: 'date' }, { h: 'description', v: 'desc' }, { h: 'account_code', v: 'account' }, { h: 'account_name', v: r => acctName(r.account) }, { h: 'cost', v: r => dec(r.debit - r.credit) }, { h: 'supplier', v: r => contactName(r.contactId) }, { h: 'division', v: r => r.division || '' }, { h: 'aia_eligible', v: r => r.account === '0020' ? 'check' : 'yes' }, { h: 'transaction_id', v: 'txnId' }], E.ledger(S, { to: at }).filter(x => ['0010', '0020', '0030'].includes(x.account)));

  const payRows = []; (S.payrollRuns || []).filter(r => E.inRange(r.payDate, per.from, per.to)).forEach(r => (r.lines || []).forEach(l => payRows.push(Object.assign({ run: r }, l))));
  add('payroll.csv', 'Pay runs per employee (input for RTI and reconciliation)', [{ h: 'pay_date', v: r => r.run.payDate }, { h: 'period_from', v: r => r.run.periodFrom }, { h: 'period_to', v: r => r.run.periodTo }, { h: 'frequency', v: r => r.run.frequency }, { h: 'status', v: r => r.run.status }, { h: 'employee', v: r => staffName(r.staffId) }, { h: 'ni_number', v: r => (staffById[r.staffId] || {}).niNumber || '' }, { h: 'tax_code', v: r => (staffById[r.staffId] || {}).taxCode || '' }, { h: 'hours', v: 'hours' }, { h: 'rate', v: r => (+r.rate || 0).toFixed(2) }, { h: 'basic', v: r => dec(E.P(r.basic)) }, { h: 'holiday_pay', v: r => dec(E.P(r.holiday)) }, { h: 'gross', v: r => dec(E.P(r.gross)) }, { h: 'paye', v: r => dec(E.P(r.paye)) }, { h: 'employee_nic', v: r => dec(E.P(r.eeNic)) }, { h: 'employer_nic', v: r => dec(E.P(r.erNic)) }, { h: 'employee_pension', v: r => dec(E.P(r.pension)) }, { h: 'employer_pension', v: r => dec(E.P(r.erPension)) }, { h: 'net_pay', v: r => dec(E.P(r.net)) }, { h: 'division', v: r => r.division || '' }], payRows);

  const mRows = []; [E.taxYearStart(per.from), E.taxYearStart(at)].filter((v, i, a) => a.indexOf(v) === i).forEach(ty => E.mileageClaims(S, ty).forEach(c => c.trips.filter(tr => E.inRange(tr.date, per.from, per.to)).forEach(tr => mRows.push(tr))));
  add('mileage.csv', 'Business journeys at HMRC approved mileage rates', [{ h: 'date', v: 'date' }, { h: 'driver', v: 'driver' }, { h: 'from', v: 'from' }, { h: 'to', v: 'to' }, { h: 'purpose', v: 'purpose' }, { h: 'miles', v: 'miles' }, { h: 'passengers', v: r => r.passengers || 0 }, { h: 'rate_band', v: 'rate' }, { h: 'claim', v: r => dec(r.claimP) }, { h: 'job_code', v: r => r.jobCode || '' }, { h: 'recorded_by', v: 'method' }, { h: 'posted_transaction', v: r => r.claimTxnId || '' }], mRows);

  const dRows = []; (S.company.directors || []).forEach(d => E.dla(S, d.dla).lines.filter(r => E.inRange(r.date, per.from, per.to)).forEach(r => dRows.push(Object.assign({ director: d.name }, r))));
  add('directors_loans.csv', "Director's loan account movements (positive balance = company owes the director)", [{ h: 'director', v: 'director' }, { h: 'date', v: 'date' }, { h: 'reference', v: 'ref' }, { h: 'description', v: 'desc' }, { h: 'owed_to_director', v: r => dec(r.credit) }, { h: 'owed_to_company', v: r => dec(r.debit) }, { h: 'balance', v: r => dec(r.balance) }], dRows);

  add('job_profitability.csv', 'Sales, direct costs and mileage per job code', [{ h: 'job_code', v: 'code' }, { h: 'name', v: 'name' }, { h: 'division', v: r => r.division || '' }, { h: 'event_date', v: r => r.eventDate || '' }, { h: 'sales', v: r => dec(jobFigures(r.code).rev) }, { h: 'direct_costs', v: r => dec(jobFigures(r.code).cost) }, { h: 'mileage_cost', v: r => dec(jobFigures(r.code).mileCost) }, { h: 'profit', v: r => dec(jobFigures(r.code).profit) }], S.jobCodes || []);

  add('audit_trail.csv', 'Who changed what and when', [{ h: 'timestamp', v: 'ts' }, { h: 'user', v: 'user' }, { h: 'action', v: 'action' }, { h: 'record_type', v: 'entity' }, { h: 'record_id', v: 'entityId' }, { h: 'summary', v: 'summary' }], (S.audit || []).filter(a => (a.ts || '').slice(0, 10) >= per.from && (a.ts || '').slice(0, 10) <= per.to));

  return files;
}

function readme(per, files) {
  const c = S.company;
  return [
    `${c.name} — accounting export`,
    `Company number ${c.companyNo || '—'} · UTR ${c.utr || '—'} · ${c.vatRegistered ? 'VAT ' + c.vatNumber + ' (' + (c.vatScheme || 'standard') + ' scheme, stagger ' + (c.vatStagger || 1) + ')' : 'Not VAT registered'}`,
    `Period ${per.from} to ${per.to} · financial year end ${c.yearEnd || '03-31'} · produced ${new Date().toISOString()} by ${store.user.email}`,
    `Period lock date: ${c.lockDate || 'none'}`, '',
    'Conventions',
    '- Accruals basis, double entry. general_ledger.csv balances: total debits equal total credits.',
    '- Dates are ISO 8601 (YYYY-MM-DD). Amounts are GBP to two decimal places, no currency symbol; credits are positive in the credit column.',
    '- Every line carries a division (events, pies, butchery, hire, or blank for central overheads) and, where relevant, a job code.',
    '- VAT codes: S20 standard 20%, R5 reduced 5%, Z0 zero-rated, EX exempt, NV no VAT charged by supplier, OS outside the scope, NR before VAT registration.',
    '- VAT boxes 6 to 9 are in whole pounds. Boxes 1 to 5 are to the penny.',
    '- transaction_id links every ledger row back to its source document and to bank_feed.csv.',
    '- Files are UTF-8 with a byte order mark so spreadsheet software reads the pound sign correctly.', '',
    'Files',
    ...files.map(f => `- ${f.name} (${f.rows} rows): ${f.desc}`),
    '- backup.json: the complete data set, for re-import or archive.'
  ].join('\r\n') + '\r\n';
}

PAGES.export = function () {
  const per = currentPeriod(); const files = exportFiles(per);
  const hc = E.healthChecks(S, today()); const bs = E.balanceSheet(S, { at: per.to < today() ? per.to : today() });
  const checks = [
    [hc.tb.balanced, 'Trial balance: debits equal credits'],
    [bs.balanced, 'Balance sheet balances'],
    [!hc.issues.some(i => /unbalanced/.test(i.text)), 'Every transaction balances on its own'],
    [!(S.bankLines || []).some(b => b.status === 'unreconciled' && b.date <= per.to), 'Bank reconciled to the end of the period'],
    [!(S.payrollRuns || []).some(r => r.status !== 'posted' && r.payDate <= per.to), 'Every pay run in the period posted'],
    [!S.company.vatRegistered || !E.vatPeriods(S.company, per.to).some(x => x.to <= per.to && x.to >= per.from && !(S.vatReturns || []).some(r => r.from === x.from && r.status === 'filed')), 'VAT returns in the period filed']
  ];
  return head('Export pack', 'One zip of CSV files your accountant can import into any software, with a README describing every file.', `<button class="btn primary" data-act="exportZip">${ico('down')} Download pack (.zip)</button>`) + `
  <div class="stack">${periodControl()}
    <section class="panel"><div class="panel-head"><h2>Checks before export</h2><span class="sub">${checks.filter(c => c[0]).length} of ${checks.length} pass</span></div><div class="list">
      ${checks.map(([ok, label]) => `<div class="list-row"><span class="pill ${ok ? 'good' : 'warn'}">${ico(ok ? 'check' : 'warn')}</span><span class="grow">${label}</span></div>`).join('')}
    </div></section>
    <section class="panel"><div class="panel-head"><h2>Files</h2><span class="sub">${files.length + 2} files · ${fdate(per.from)} – ${fdate(per.to)}</span></div><div class="table-wrap"><table class="t"><thead><tr><th>File</th><th>Contents</th><th class="num">Rows</th><th></th></tr></thead><tbody>
      <tr><td class="mono">README.txt</td><td class="wrap">Company details, conventions and file list</td><td></td><td><button class="btn sm" data-act="previewFile" data-name="README.txt">Preview</button></td></tr>
      ${files.map(f => `<tr><td class="mono">${f.name}</td><td class="wrap">${esc(f.desc)}</td><td class="num">${f.rows}</td><td><div class="head-actions"><button class="btn sm" data-act="previewFile" data-name="${f.name}">Preview</button><button class="btn sm plain" data-act="saveOne" data-name="${f.name}">${ico('down')}</button></div></td></tr>`).join('')}
      <tr><td class="mono">backup.json</td><td class="wrap">Complete data set for archive or re-import</td><td></td><td><button class="btn sm plain" data-act="saveBackup">${ico('down')}</button></td></tr>
    </tbody></table></div></section>
  </div>`;
};
ACT.previewFile = (el) => {
  const per = currentPeriod(); const files = exportFiles(per);
  const content = el.dataset.name === 'README.txt' ? readme(per, files) : (files.find(f => f.name === el.dataset.name) || {}).csv || '';
  const lines = content.replace(/^﻿/, '').split(/\r?\n/); const shown = lines.slice(0, 40).join('\n');
  openSheet({ title: el.dataset.name, size: 'wide', body: `<div class="code-view" style="max-height:60vh">${esc(shown)}${lines.length > 40 ? `\n… ${lines.length - 40} more lines` : ''}</div>`, foot: `<button class="btn primary" data-act="saveOne" data-name="${esc(el.dataset.name)}">${ico('down')} Download</button>` });
};
ACT.saveOne = async (el) => {
  const per = currentPeriod(); const files = exportFiles(per);
  if (el.dataset.name === 'README.txt') return saveFile('README.txt', readme(per, files), 'text/plain');
  const f = files.find(x => x.name === el.dataset.name); if (f) await saveFile(f.name, f.csv, 'text/csv');
};
ACT.saveBackup = () => saveFile(`digbys-backup-${today()}.json`, JSON.stringify(backupData(), null, 2), 'application/json');
function backupData() { const o = {}; ['company', 'accounts', 'contacts', 'jobCodes', 'txns', 'bankLines', 'staff', 'payrollRuns', 'mileage', 'vatReturns', 'rules'].forEach(k => o[k] = S[k]); o.exportedAt = nowIso(); o.exportedBy = store.user.email; return o; }
ACT.exportZip = async () => {
  if (!window.JSZip) throw new Error('The zip library did not load. Download the files one at a time instead.');
  const per = currentPeriod(); const files = exportFiles(per); const zip = new window.JSZip();
  const folder = `digbys-co-${per.from}-to-${per.to}`;
  zip.file(`${folder}/README.txt`, readme(per, files));
  files.forEach(f => zip.file(`${folder}/${f.name}`, f.csv));
  zip.file(`${folder}/backup.json`, JSON.stringify(backupData(), null, 2));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  await saveFile(`${folder}.zip`, blob, 'application/zip');
};

// one-click CSVs from report pages
ACT.csv = async (el) => {
  const per = currentPeriod(); const files = exportFiles(per);
  const map = { pnl: 'profit_and_loss.csv', balance: 'balance_sheet.csv', tb: 'trial_balance.csv', gl: 'general_ledger.csv', audit: 'audit_trail.csv', aged: `aged_${UI.tab.aged || 'debtors'}.csv` };
  const f = files.find(x => x.name === map[el.dataset.report]); if (f) await saveFile(f.name, f.csv, 'text/csv');
};

// ---------- System notes for the accountant ----------
PAGES.notes = function () {
  const c = S.company; const cy = E.companyYear(c, today()); const hc = E.healthChecks(S, today());
  const n = (k) => (S[k] || []).length;
  return head('System notes', 'How the books are kept, written for your accountant.', `<button class="btn" data-go="export">${ico('box')} Export pack</button>`) + `
  <div class="stack">
    <section class="panel"><div class="panel-head"><h2>Business</h2></div><div class="panel-body"><dl class="kv">
      <dt>Name</dt><dd>${esc(c.name)}</dd><dt>Status</dt><dd>${isLtd() ? 'Limited company' : `Sole trader (${esc(c.ownerName || 'James Brierley')}) until incorporation; the same books carry on into Digby's & Co Limited from the incorporation date`}</dd><dt>Books start</dt><dd>${fdate(c.booksStart || c.incorporated)}</dd><dt>Company number</dt><dd>${esc(c.companyNo || '—')}</dd><dt>UTR</dt><dd>${esc(c.utr || '—')}</dd>
      <dt>Registered office</dt><dd>${esc(c.regOffice || '—')}</dd><dt>Incorporated</dt><dd>${fdate(c.incorporated)}</dd><dt>Financial year</dt><dd>${fdate(cy.from)} – ${fdate(cy.to)}</dd>
      <dt>Shareholders</dt><dd>${(c.directors || []).map(d => `${esc(d.name)} ${d.share}%`).join(', ')}</dd>
      <dt>VAT</dt><dd>${c.vatRegistered ? `${esc(c.vatNumber)} · ${esc(c.vatScheme || 'standard')} scheme · from ${fdate(c.vatRegDate)} · stagger ${c.vatStagger || 1}` : 'Not registered'}</dd>
      <dt>Locked to</dt><dd>${c.lockDate ? fdate(c.lockDate) : 'Nothing locked'}</dd>
      <dt>Records</dt><dd>${n('txns')} transactions · ${n('bankLines')} bank lines · ${n('contacts')} contacts · ${n('staff')} staff · ${n('payrollRuns')} pay runs</dd>
      <dt>Integrity</dt><dd>${hc.tb.balanced ? '<span class="pill good">Trial balance agrees</span>' : '<span class="pill bad">Trial balance out</span>'} ${hc.issues.length ? hc.issues.map(i => `<span class="pill ${i.level === 'critical' ? 'bad' : 'warn'}">${esc(i.text)}</span>`).join(' ') : ''}</dd>
    </dl></div></section>
    <section class="panel"><div class="panel-body doc-copy" style="padding-top:18px">
      <h3>Basis and structure</h3>
      <p>Full double entry on the accruals basis. Sales invoices post to trade debtors and bills to trade creditors on their document date; payments clear them through allocations, so part payments and deposits are tracked against each invoice. Bank items with no invoice are coded straight to an account. Manual journals are available to the accountant role for year-end adjustments, accruals, prepayments and depreciation.</p>
      <p>The chart of accounts follows the familiar four-digit layout: 0xxx fixed assets, 1xxx current assets, 2xxx liabilities, 3xxx capital, 4xxx sales, 5xxx cost of sales, 7xxx–8xxx overheads. Sales have one nominal per venture (4000 events, 4010 pies, 4020 butchery, 4030 hire).</p>
      <h3>Divisions and job codes</h3>
      <p>Every line carries a division: Events, Pies, Butchery or Hire, or none for central overheads. The profit and loss runs with a column per division, so each venture can be read on its own or split into a separate company later without re-keying. Payroll journals split wage costs by each employee's division. Job codes tie an event's invoice, purchases and mileage together for per-job margin.</p>
      <h3>VAT</h3>
      <p>Each line holds a VAT code, net and VAT amount. The return is built from tax-point entries: invoice date on the standard scheme, payment date on cash accounting, and gross turnover at the flat rate (with capital goods over £2,000 reclaimed separately) on the flat rate scheme. Box 5 reconciles to movements on 2200 and 2201. Filing a return posts a journal clearing both to 2202 VAT control and locks the period.</p>
      <p>The system does not submit to HMRC. The export pack's vat_returns.csv and vat_detail.csv import into MTD-recognised software. CSV import and export count as a digital link under VAT Notice 700/22; copy and paste does not, so the figures should be imported rather than re-typed.</p>
      <h3>Bank</h3>
      <p>The Starling business account feeds in through Starling's API. Each line is matched to an invoice or bill, or coded with an account, VAT code and division, and keeps a link to the transaction it created. The Bank page reconciles the statement balance to the ledger to the penny.</p>
      <h3>Payroll</h3>
      <p>Hours and rates are captured per employee and exported as payroll.csv. RTI submissions are made by the payroll provider in HMRC-recognised software; their final figures are entered back and posted as one journal per run (gross wages and employer NIC by division, PAYE/NIC to 2210, net pay to 2220, Employment Allowance offset).</p>
      <h3>Controls</h3>
      <ul>
        <li>Sign-in is required. Each person has a role: owner, director, bookkeeper or accountant. The accountant can read everything, post journals, mark VAT returns filed and move the lock date, but cannot change or delete trading entries.</li>
        <li>Period lock: nothing dated on or before the lock date can be added, changed or deleted. The database enforces this as well as the screen.</li>
        <li>Audit trail: the database records every insert, change and delete with the user, time and the full before and after values. Entries cannot be edited or removed.</li>
        <li>Sales invoices use one unbroken number sequence across all divisions. Draft invoices are not numbered and post nothing.</li>
        <li>Records are retained for at least six years from the end of the financial year they relate to.</li>
      </ul>
      <h3>Rates built in (${E.PAYROLL.taxYear})</h3>
      <p>Corporation tax 19% to £50,000, 25% from £250,000, marginal relief between (3/200), limits divided by associated companies and scaled for short periods. VAT registration threshold £90,000. Employer NIC 15% above £5,000 a year, employee NIC 8% between £12,570 and £50,270, Employment Allowance £10,500. Approved mileage 45p for the first 10,000 miles, then 25p, plus 5p per passenger.</p>
      <h3>Outside this system</h3>
      <p>Statutory accounts and filing at Companies House, the CT600, RTI submissions and the MTD VAT submission itself are done in the accountant's own software from the export pack. Year-end adjustments come back in as journals.</p>
    </div></section>
  </div>`;
};
