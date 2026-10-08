/* ============================================================
   Digby's & Co — ledger engine
   Pure functions. No DOM. Runs in the browser and in Node tests.
   All aggregation is done in integer pence.
   ============================================================ */
(function (root) {
  'use strict';

  // ---------- money ----------
  const P = (x) => Math.round((+x || 0) * 100);            // pounds -> pence
  const L = (p) => Math.round(p) / 100;                     // pence -> pounds
  const r2 = (x) => Math.round((+x || 0) * 100) / 100;

  // ---------- reference data ----------
  const DIVISIONS = [
    { id: 'events',   name: 'Events',   strap: 'Events & Catering' },
    { id: 'pies',     name: 'Pies',     strap: 'Pies' },
    { id: 'butchery', name: 'Butchery', strap: 'Butchery' },
    { id: 'hire',     name: 'Hire',     strap: 'Crockery & Cutlery Hire' }
  ];
  const DIV_IDS = DIVISIONS.map(d => d.id);

  // inBoxes: counts in VAT boxes 6/7 (net values). OS and NR are excluded.
  const VAT_CODES = {
    S20: { rate: 0.20, label: 'Standard 20%',            short: '20%',  inBoxes: true },
    R5:  { rate: 0.05, label: 'Reduced 5%',              short: '5%',   inBoxes: true },
    Z0:  { rate: 0,    label: 'Zero-rated 0%',           short: '0%',   inBoxes: true },
    EX:  { rate: 0,    label: 'Exempt',                  short: 'Ex',   inBoxes: true },
    NV:  { rate: 0,    label: 'No VAT charged by supplier', short: 'No VAT', inBoxes: true },
    OS:  { rate: 0,    label: 'Outside the scope',       short: 'O/S',  inBoxes: false },
    NR:  { rate: 0,    label: 'Not VAT registered',      short: '—',    inBoxes: false }
  };

  // Account types drive the P&L / balance sheet layout
  // income, cos, overhead | fixed, current_asset, bank, current_liability, equity
  const SYSTEM = {
    DEBTORS: '1100', BANK: '1200', CREDITORS: '2100',
    VAT_OUT: '2200', VAT_IN: '2201', VAT_HMRC: '2202',
    PAYE: '2210', NET_WAGES: '2220', PENSION: '2230',
    DLA_JAMES: '2300', DLA_MIKE: '2301',
    SHARE_CAPITAL: '3000', RETAINED: '3100', DIVIDENDS: '3200',
    WAGES: '7000', ER_NIC: '7006', MILEAGE: '7304'
  };

  const DEFAULT_ACCOUNTS = [
    ['0010','Kitchen equipment & machinery','fixed','S20'],
    ['0011','Kitchen equipment — depreciation','fixed','OS'],
    ['0020','Motor vehicles','fixed','S20'],
    ['0021','Motor vehicles — depreciation','fixed','OS'],
    ['0030','Hire stock — crockery & cutlery','fixed','S20'],
    ['0031','Hire stock — depreciation','fixed','OS'],
    ['1001','Stock','current_asset','OS'],
    ['1100','Trade debtors','current_asset','OS'],
    ['1103','Prepayments','current_asset','OS'],
    ['1200','Starling business account','bank','OS'],
    ['1210','Cash','bank','OS'],
    ['1230','Card takings clearing','bank','OS'],
    ['2100','Trade creditors','current_liability','OS'],
    ['2109','Accruals','current_liability','OS'],
    ['2200','VAT on sales (output)','current_liability','OS'],
    ['2201','VAT on purchases (input)','current_liability','OS'],
    ['2202','VAT control — HMRC','current_liability','OS'],
    ['2210','PAYE & NIC due to HMRC','current_liability','OS'],
    ['2220','Net wages payable','current_liability','OS'],
    ['2230','Pension contributions due','current_liability','OS'],
    ['2300',"Director's loan — James Brierley",'current_liability','OS'],
    ['2301',"Director's loan — Mike Jeffries",'current_liability','OS'],
    ['2400','Deposits & deferred income','current_liability','OS'],
    ['2500','Corporation tax','current_liability','OS'],
    ['3000','Share capital','equity','OS'],
    ['3100','Retained earnings','equity','OS'],
    ['3200','Dividends','equity','OS'],
    ['4000','Sales — events & catering','income','S20'],
    ['4010','Sales — pies','income','Z0'],
    ['4020','Sales — butchery','income','Z0'],
    ['4030','Sales — crockery & cutlery hire','income','S20'],
    ['4090','Sales — consultancy','income','S20'],
    ['4900','Other income','income','OS'],
    ['5000','Food & ingredients','cos','Z0'],
    ['5010','Meat & carcasses','cos','Z0'],
    ['5020','Packaging & disposables','cos','S20'],
    ['5030','Equipment & crockery hire-in','cos','S20'],
    ['5040','Drinks','cos','S20'],
    ['5050','Venue & event costs','cos','S20'],
    ['5060','Freelance & agency staff','cos','NV'],
    ['7000','Gross wages','overhead','OS'],
    ['7006',"Employer's NIC",'overhead','OS'],
    ['7007',"Employer's pension",'overhead','OS'],
    ['7100','Rent — prep unit','overhead','EX'],
    ['7200','Utilities','overhead','R5'],
    ['7300','Fuel & vehicle running','overhead','S20'],
    ['7304','Mileage allowance (AMAP)','overhead','OS'],
    ['7400','Travel & subsistence','overhead','S20'],
    ['7500','Phone & internet','overhead','S20'],
    ['7502','Software & subscriptions','overhead','S20'],
    ['7600','Accountancy & legal','overhead','S20'],
    ['7700','Insurance','overhead','EX'],
    ['7800','Repairs & maintenance','overhead','S20'],
    ['7900','Bank & card fees','overhead','EX'],
    ['8000','Advertising & marketing','overhead','S20'],
    ['8100','Cleaning & laundry','overhead','S20'],
    ['8200','Small equipment & smallwares','overhead','S20'],
    ['8300','Licences, permits & fees','overhead','OS'],
    ['8400','Sundry expenses','overhead','S20'],
    ['8500','Depreciation','overhead','OS']
  ].map(([code, name, type, vat]) => ({ code, name, type, vatDefault: vat, archived: false }));

  const INCOME_FOR_DIVISION = { events: '4000', pies: '4010', butchery: '4020', hire: '4030' };

  // 2026-27 payroll figures (HMRC rates and thresholds for employers 2026 to 2027)
  const PAYROLL = {
    taxYear: '2026-27',
    personalAllowance: 12570, basicBand: 37700,
    weekly:  { LEL: 129, PT: 242, ST: 96,  UEL: 967 },
    monthly: { LEL: 559, PT: 1048, ST: 417, UEL: 4189 },
    eeRate: 0.08, eeUpper: 0.02, erRate: 0.15,
    employmentAllowance: 10500,
    holidayRolledUp: 0.1207
  };
  const AMAP = { first: 0.45, after: 0.25, threshold: 10000, passenger: 0.05 };
  const CT = { small: 0.19, main: 0.25, lower: 50000, upper: 250000, fraction: 3 / 200 };
  const VAT_THRESHOLD = 90000;

  // ---------- dates ----------
  const iso = (d) => {
    const x = (d instanceof Date) ? d : new Date(d);
    return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())).toISOString().slice(0, 10);
  };
  const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, n) => { const d = parse(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); };
  const endOfMonth = (s) => { const d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const inRange = (date, from, to) => (!from || date >= from) && (!to || date <= to);

  // UK income tax year: 6 April – 5 April. Returns the starting year (2026 for 2026-27).
  const taxYearStart = (s) => { const d = parse(s); const y = d.getFullYear(); const start = new Date(y, 3, 6); return d >= start ? y : y - 1; };
  const taxYearLabel = (y) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;

  // Company accounting year containing `date`. yearEnd 'MM-DD'.
  function companyYear(company, date) {
    const [m, d] = (company.yearEnd || '03-31').split('-').map(Number);
    const dt = parse(date);
    let end = new Date(dt.getFullYear(), m - 1, d);
    if (dt > end) end = new Date(dt.getFullYear() + 1, m - 1, d);
    let start = new Date(end.getFullYear() - 1, m - 1, d + 1);
    let from = iso(start);
    if (company.incorporated && company.incorporated > from) from = company.incorporated;
    return { from, to: iso(end) };
  }

  // ---------- transactions ----------
  const SALES_TYPES = ['invoice', 'credit_note', 'receipt'];
  const PURCHASE_TYPES = ['bill', 'supplier_credit', 'spend'];
  const POSTED = (t) => t.status !== 'draft' && t.status !== 'void' && !t.deleted;

  function lineTotals(lines) {
    let net = 0, vat = 0;
    (lines || []).forEach(l => { net += P(l.net); vat += P(l.vat); });
    return { net, vat, gross: net + vat };
  }
  function txnGross(t) {
    if (['customer_payment', 'supplier_payment', 'transfer'].includes(t.type)) return P(t.amount);
    if (t.type === 'journal' || t.type === 'payroll') return (t.lines || []).reduce((s, l) => s + P(l.debit), 0);
    return lineTotals(t.lines).gross;
  }

  function vatActive(company, date) {
    return !!(company && company.vatRegistered && company.vatRegDate && date >= company.vatRegDate);
  }

  // Build one line's net/vat from an entered amount
  function calcLine(amount, code, inclusive) {
    const rate = (VAT_CODES[code] || VAT_CODES.NR).rate;
    const a = P(amount);
    if (!rate) return { net: L(a), vat: 0 };
    if (inclusive) { const vat = Math.round(a * rate / (1 + rate)); return { net: L(a - vat), vat: L(vat) }; }
    return { net: L(a), vat: L(Math.round(a * rate)) };
  }

  // ---------- double entry ----------
  // Every posted transaction becomes balanced debit/credit lines.
  function postings(t) {
    if (!POSTED(t)) return [];
    const out = [];
    const base = { txnId: t.id, date: t.date, type: t.type, ref: t.ref || '', contactId: t.contactId || null, desc: t.description || '' };
    const push = (account, dr, cr, extra) => {
      if (!dr && !cr) return;
      out.push(Object.assign({}, base, { account, debit: dr || 0, credit: cr || 0, division: t.division || null, jobCode: t.jobCode || null, vatCode: null, net: 0, vat: 0 }, extra || {}));
    };
    const bank = t.bankAccount || SYSTEM.BANK;
    const lines = t.lines || [];
    const tot = lineTotals(lines);
    const lineExtra = (l) => ({ division: l.division || t.division || null, jobCode: l.jobCode || t.jobCode || null, vatCode: l.vatCode || null, net: P(l.net), vat: P(l.vat), desc: l.description || t.description || '' });

    switch (t.type) {
      case 'invoice':
        push(SYSTEM.DEBTORS, tot.gross, 0);
        lines.forEach(l => { push(l.account, 0, P(l.net), lineExtra(l)); if (P(l.vat)) push(SYSTEM.VAT_OUT, 0, P(l.vat), lineExtra(l)); });
        break;
      case 'credit_note':
        push(SYSTEM.DEBTORS, 0, tot.gross);
        lines.forEach(l => { push(l.account, P(l.net), 0, lineExtra(l)); if (P(l.vat)) push(SYSTEM.VAT_OUT, P(l.vat), 0, lineExtra(l)); });
        break;
      case 'bill':
        push(SYSTEM.CREDITORS, 0, tot.gross);
        lines.forEach(l => { push(l.account, P(l.net), 0, lineExtra(l)); if (P(l.vat)) push(SYSTEM.VAT_IN, P(l.vat), 0, lineExtra(l)); });
        break;
      case 'supplier_credit':
        push(SYSTEM.CREDITORS, tot.gross, 0);
        lines.forEach(l => { push(l.account, 0, P(l.net), lineExtra(l)); if (P(l.vat)) push(SYSTEM.VAT_IN, 0, P(l.vat), lineExtra(l)); });
        break;
      case 'receipt':
        push(bank, tot.gross, 0);
        lines.forEach(l => { push(l.account, 0, P(l.net), lineExtra(l)); if (P(l.vat)) push(SYSTEM.VAT_OUT, 0, P(l.vat), lineExtra(l)); });
        break;
      case 'spend':
        push(bank, 0, tot.gross);
        lines.forEach(l => { push(l.account, P(l.net), 0, lineExtra(l)); if (P(l.vat)) push(SYSTEM.VAT_IN, P(l.vat), 0, lineExtra(l)); });
        break;
      case 'customer_payment':
        push(bank, P(t.amount), 0); push(SYSTEM.DEBTORS, 0, P(t.amount));
        break;
      case 'supplier_payment':
        push(SYSTEM.CREDITORS, P(t.amount), 0); push(bank, 0, P(t.amount));
        break;
      case 'transfer':
        push(t.toAccount, P(t.amount), 0); push(t.fromAccount || bank, 0, P(t.amount));
        break;
      case 'journal':
      case 'payroll':
        lines.forEach(l => push(l.account, P(l.debit), P(l.credit), { division: l.division || t.division || null, jobCode: l.jobCode || t.jobCode || null, desc: l.description || t.description || '' }));
        break;
    }
    return out;
  }

  function ledger(state, opts) {
    opts = opts || {};
    const rows = [];
    (state.txns || []).forEach(t => {
      if (!inRange(t.date, opts.from, opts.to)) return;
      postings(t).forEach(p => {
        if (opts.division && opts.division !== 'all') {
          if (opts.division === 'none' ? p.division : p.division !== opts.division) return;
        }
        if (opts.account && p.account !== opts.account) return;
        rows.push(p);
      });
    });
    rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    return rows;
  }

  const accountMap = (state) => { const m = {}; (state.accounts || DEFAULT_ACCOUNTS).forEach(a => { m[a.code] = a; }); return m; };
  const isPL = (type) => type === 'income' || type === 'cos' || type === 'overhead';

  function trialBalance(state, opts) {
    const acc = accountMap(state);
    const bal = {};
    ledger(state, { to: opts && opts.to, from: opts && opts.from }).forEach(p => {
      bal[p.account] = (bal[p.account] || 0) + p.debit - p.credit;
    });
    const rows = Object.keys(bal).sort().map(code => ({
      code, name: (acc[code] || {}).name || code, type: (acc[code] || {}).type || 'unknown',
      debit: bal[code] > 0 ? bal[code] : 0, credit: bal[code] < 0 ? -bal[code] : 0, balance: bal[code]
    })).filter(r => r.balance !== 0);
    const totals = rows.reduce((s, r) => ({ debit: s.debit + r.debit, credit: s.credit + r.credit }), { debit: 0, credit: 0 });
    return { rows, totals, balanced: totals.debit === totals.credit };
  }

  // Profit & loss with a column per division
  function pnl(state, opts) {
    const acc = accountMap(state);
    const cols = DIV_IDS.concat(['none']);
    const lines = {};
    ledger(state, { from: opts.from, to: opts.to }).forEach(p => {
      const a = acc[p.account]; if (!a || !isPL(a.type)) return;
      const col = DIV_IDS.includes(p.division) ? p.division : 'none';
      lines[p.account] = lines[p.account] || { code: p.account, name: a.name, type: a.type, cols: {}, total: 0 };
      // income shown positive when credit; costs positive when debit
      const v = a.type === 'income' ? p.credit - p.debit : p.debit - p.credit;
      lines[p.account].cols[col] = (lines[p.account].cols[col] || 0) + v;
      lines[p.account].total += v;
    });
    const group = (type) => Object.values(lines).filter(l => l.type === type).sort((a, b) => a.code < b.code ? -1 : 1);
    const sum = (arr) => { const s = { total: 0, cols: {} }; cols.forEach(c => s.cols[c] = 0); arr.forEach(l => { s.total += l.total; cols.forEach(c => s.cols[c] += (l.cols[c] || 0)); }); return s; };
    const income = group('income'), cos = group('cos'), overheads = group('overhead');
    const ti = sum(income), tc = sum(cos), to = sum(overheads);
    const sub = (a, b) => { const s = { total: a.total - b.total, cols: {} }; cols.forEach(c => s.cols[c] = a.cols[c] - b.cols[c]); return s; };
    const gp = sub(ti, tc), np = sub(gp, to);
    return { cols, income, cos, overheads, totals: { income: ti, cos: tc, grossProfit: gp, overheads: to, netProfit: np } };
  }

  function balanceSheet(state, opts) {
    const at = opts.at;
    const acc = accountMap(state);
    const tb = trialBalance(state, { to: at });
    const pick = (types) => tb.rows.filter(r => types.includes(r.type));
    const fixed = pick(['fixed']).map(r => ({ code: r.code, name: r.name, amount: r.balance }));
    const current = pick(['current_asset', 'bank']).map(r => ({ code: r.code, name: r.name, amount: r.balance }));
    // VAT accounts net into one figure so the sheet reads like a set of accounts
    const liabRows = pick(['current_liability']);
    const vatNet = liabRows.filter(r => ['2200', '2201', '2202'].includes(r.code)).reduce((s, r) => s - r.balance, 0);
    const liabilities = liabRows.filter(r => !['2200', '2201', '2202'].includes(r.code)).map(r => ({ code: r.code, name: r.name, amount: -r.balance }));
    if (vatNet !== 0) liabilities.unshift({ code: '2200-2202', name: 'VAT', amount: vatNet });
    const equityRows = pick(['equity']).map(r => ({ code: r.code, name: r.name, amount: -r.balance }));
    const plToDate = tb.rows.filter(r => isPL(r.type)).reduce((s, r) => s - r.balance, 0);
    const tFixed = fixed.reduce((s, r) => s + r.amount, 0);
    const tCurrent = current.reduce((s, r) => s + r.amount, 0);
    const tLiab = liabilities.reduce((s, r) => s + r.amount, 0);
    const netAssets = tFixed + tCurrent - tLiab;
    const tEquity = equityRows.reduce((s, r) => s + r.amount, 0) + plToDate;
    void acc;
    return { at, fixed, current, liabilities, equity: equityRows, profitToDate: plToDate,
      totals: { fixed: tFixed, current: tCurrent, liabilities: tLiab, netCurrent: tCurrent - tLiab, netAssets, equity: tEquity },
      balanced: netAssets === tEquity };
  }

  // ---------- allocations / invoice status ----------
  function allocatedTo(state, txnId) {
    let paid = 0;
    (state.txns || []).forEach(t => {
      if (!POSTED(t)) return;
      (t.allocations || []).forEach(a => { if (a.txnId === txnId) paid += P(a.amount); });
    });
    return paid;
  }
  function docStatus(state, t, today) {
    if (t.status === 'void') return { key: 'void', label: 'Void', due: 0, paid: 0, gross: txnGross(t) };
    if (t.status === 'draft') return { key: 'draft', label: 'Draft', due: txnGross(t), paid: 0, gross: txnGross(t) };
    const gross = txnGross(t);
    const paid = (t.type === 'credit_note' || t.type === 'supplier_credit') ? (t.allocations || []).reduce((s, a) => s + P(a.amount), 0) : allocatedTo(state, t.id);
    const due = gross - paid;
    if (due <= 0) return { key: 'paid', label: 'Paid', due: 0, paid, gross };
    const overdue = t.dueDate && t.dueDate < (today || iso(new Date()));
    if (paid > 0) return { key: overdue ? 'overdue' : 'part', label: overdue ? 'Overdue' : 'Part paid', due, paid, gross };
    return { key: overdue ? 'overdue' : 'awaiting', label: overdue ? 'Overdue' : 'Awaiting payment', due, paid, gross };
  }

  function aged(state, opts) {
    const at = opts.at; const kinds = opts.kind === 'creditors' ? ['bill'] : ['invoice'];
    const buckets = ['current', '1-30', '31-60', '61-90', '90+'];
    const byContact = {};
    (state.txns || []).filter(t => kinds.includes(t.type) && POSTED(t) && t.date <= at).forEach(t => {
      const st = docStatus(state, t, at); if (st.due <= 0) return;
      const late = t.dueDate ? daysBetween(t.dueDate, at) : 0;
      const b = late <= 0 ? 'current' : late <= 30 ? '1-30' : late <= 60 ? '31-60' : late <= 90 ? '61-90' : '90+';
      const c = byContact[t.contactId || 'none'] = byContact[t.contactId || 'none'] || { contactId: t.contactId, docs: [], total: 0 };
      buckets.forEach(k => c[k] = c[k] || 0);
      c[b] += st.due; c.total += st.due; c.docs.push({ id: t.id, ref: t.ref, date: t.date, dueDate: t.dueDate, due: st.due, bucket: b });
    });
    const rows = Object.values(byContact).sort((a, b) => b.total - a.total);
    const totals = { total: 0 }; buckets.forEach(k => totals[k] = 0);
    rows.forEach(r => { totals.total += r.total; buckets.forEach(k => totals[k] += r[k]); });
    return { buckets, rows, totals };
  }

  // ---------- VAT ----------
  // Quarter-end months by stagger: 1 = Mar/Jun/Sep/Dec, 2 = Apr/Jul/Oct/Jan, 3 = May/Aug/Nov/Feb
  function vatPeriods(company, upto) {
    if (!company.vatRegistered || !company.vatRegDate) return [];
    const stagger = +company.vatStagger || 1;
    const ends = [[3, 6, 9, 12], [1, 4, 7, 10], [2, 5, 8, 11]][stagger - 1];
    const periods = [];
    let start = company.vatRegDate;
    let guard = 0;
    while (start <= upto && guard++ < 200) {
      const d = parse(start);
      let y = d.getFullYear(), m = d.getMonth() + 1;
      while (!ends.includes(m)) { m++; if (m > 12) { m = 1; y++; } }
      const end = iso(new Date(y, m, 0));
      const due = addDays(addMonths(endOfMonth(end), 1), 7);
      periods.push({ key: `${start}_${end}`, from: start, to: end, due });
      start = addDays(end, 1);
    }
    return periods;
  }

  // Tax-point entries for the VAT return. Cash accounting moves invoice/bill VAT to payment dates.
  function vatEntries(state) {
    const company = state.company || {};
    const scheme = company.vatScheme || 'standard';
    const byId = {}; (state.txns || []).forEach(t => byId[t.id] = t);
    const out = [];
    const emit = (t, l, date, frac, sign) => {
      const code = l.vatCode || 'NR'; const meta = VAT_CODES[code] || VAT_CODES.NR;
      if (!meta.inBoxes) return;
      if (!vatActive(company, date)) return;
      const kind = (SALES_TYPES.includes(t.type)) ? 'sale' : 'purchase';
      out.push({ txnId: t.id, ref: t.ref || '', date, kind, code, account: l.account,
        net: Math.round(P(l.net) * frac) * sign, vat: Math.round(P(l.vat) * frac) * sign,
        gross: Math.round((P(l.net) + P(l.vat)) * frac) * sign, desc: l.description || t.description || '', division: l.division || t.division || null,
        capital: !!l.capitalGoods });
    };
    (state.txns || []).forEach(t => {
      if (!POSTED(t)) return;
      const sign = (t.type === 'credit_note' || t.type === 'supplier_credit') ? -1 : 1;
      if (['receipt', 'spend'].includes(t.type)) { (t.lines || []).forEach(l => emit(t, l, t.date, 1, 1)); return; }
      if (['invoice', 'bill', 'credit_note', 'supplier_credit'].includes(t.type)) {
        if (scheme !== 'cash') { (t.lines || []).forEach(l => emit(t, l, t.date, 1, sign)); return; }
        return; // cash scheme: handled from payments below
      }
      if (scheme === 'cash' && ['customer_payment', 'supplier_payment'].includes(t.type)) {
        (t.allocations || []).forEach(a => {
          const doc = byId[a.txnId]; if (!doc || !POSTED(doc)) return;
          const gross = txnGross(doc); if (!gross) return;
          const frac = P(a.amount) / gross;
          (doc.lines || []).forEach(l => emit(doc, l, t.date, frac, 1));
        });
      }
    });
    return out;
  }

  function vatReturn(state, period) {
    const company = state.company || {};
    const entries = vatEntries(state).filter(e => inRange(e.date, period.from, period.to));
    const sales = entries.filter(e => e.kind === 'sale'), purchases = entries.filter(e => e.kind === 'purchase');
    const sum = (arr, k) => arr.reduce((s, e) => s + e[k], 0);
    let b1, b4, b6, b7, frs = null;
    if ((company.vatScheme || 'standard') === 'flat') {
      const firstYearEnd = addDays(addMonths(company.vatRegDate, 12), -1);
      const rate = (+company.flatRate || 12.5) - (company.frsFirstYearDiscount && period.from <= firstYearEnd ? 1 : 0);
      const turnover = sum(sales, 'gross');
      b1 = Math.round(turnover * rate / 100);
      const capital = purchases.filter(e => e.capital && e.gross >= 200000);
      b4 = sum(capital, 'vat');
      b6 = turnover; b7 = sum(capital, 'net');
      frs = { rate, turnover };
    } else {
      b1 = sum(sales, 'vat'); b4 = sum(purchases, 'vat');
      b6 = sum(sales, 'net'); b7 = sum(purchases, 'net');
    }
    const whole = (p) => Math.trunc(p / 100) * 100; // boxes 6–9 in whole pounds
    const boxes = { 1: b1, 2: 0, 3: b1, 4: b4, 5: b1 - b4, 6: whole(b6), 7: whole(b7), 8: 0, 9: 0 };
    return { period, scheme: company.vatScheme || 'standard', boxes, entries, frs };
  }

  // Rolling 12-month taxable turnover for the registration test
  function rollingTurnover(state, at) {
    const from = addDays(addMonths(at, -12), 1);
    let total = 0;
    (state.txns || []).forEach(t => {
      if (!POSTED(t) || !inRange(t.date, from, at)) return;
      if (!['invoice', 'credit_note', 'receipt'].includes(t.type)) return;
      const sign = t.type === 'credit_note' ? -1 : 1;
      (t.lines || []).forEach(l => {
        const a = accountMap(state)[l.account];
        if (a && a.type === 'income' && l.vatCode !== 'EX' && l.vatCode !== 'OS') total += sign * P(l.net);
      });
    });
    return { from, to: at, total, threshold: VAT_THRESHOLD * 100 };
  }

  // ---------- corporation tax estimate ----------
  function ctEstimate(state, opts) {
    const p = pnl(state, { from: opts.from, to: opts.to });
    const pbt = p.totals.netProfit.total;
    const led = ledger(state, { from: opts.from, to: opts.to });
    const depn = led.filter(x => x.account === '8500').reduce((s, x) => s + x.debit - x.credit, 0);
    const aia = led.filter(x => ['0010', '0030'].includes(x.account)).reduce((s, x) => s + x.debit - x.credit, 0);
    const taxable = Math.max(0, pbt + depn - Math.max(0, aia));
    const days = daysBetween(opts.from, opts.to) + 1;
    const divisor = 1 + (+((state.company || {}).associatedCompanies) || 0);
    const scale = Math.min(1, days / 365);
    const lower = CT.lower * 100 * scale / divisor, upper = CT.upper * 100 * scale / divisor;
    let tax, band;
    if (taxable <= lower) { tax = taxable * CT.small; band = 'Small profits rate 19%'; }
    else if (taxable >= upper) { tax = taxable * CT.main; band = 'Main rate 25%'; }
    else { tax = taxable * CT.main - CT.fraction * (upper - taxable); band = 'Main rate less marginal relief'; }
    return { pbt, depreciationAddBack: depn, aia: Math.max(0, aia), taxable, tax: Math.round(tax), band, lower: Math.round(lower), upper: Math.round(upper) };
  }

  // ---------- director's loan ----------
  function dla(state, account) {
    const rows = ledger(state, { account });
    let bal = 0;
    const lines = rows.map(r => { bal += r.credit - r.debit; return Object.assign({}, r, { balance: bal }); });
    return { account, lines, balance: bal, overdrawn: bal < 0 };
  }

  // ---------- payroll (estimate, Week 1 / Month 1 basis) ----------
  function payrollEstimate(gross, freq, taxCode) {
    const t = freq === 'monthly' ? PAYROLL.monthly : PAYROLL.weekly;
    const periods = freq === 'monthly' ? 12 : 52;
    const g = P(gross);
    const code = String(taxCode || '1257L').toUpperCase().trim();
    let allowance = 0, flat = null;
    if (code === 'BR') flat = 0.20; else if (code === 'D0') flat = 0.40; else if (code === 'D1') flat = 0.45; else if (code === '0T' || code === 'NT') allowance = 0;
    else { const n = parseInt(code, 10); allowance = isNaN(n) ? PAYROLL.personalAllowance : n * 10; }
    let paye = 0;
    if (code === 'NT') paye = 0;
    else if (flat !== null) paye = Math.floor(g * flat);
    else {
      const taxable = Math.max(0, g - Math.round(allowance * 100 / periods));
      const band = Math.round(PAYROLL.basicBand * 100 / periods);
      paye = Math.floor(Math.min(taxable, band) * 0.20 + Math.max(0, taxable - band) * 0.40);
    }
    const PT = t.PT * 100, UEL = t.UEL * 100, ST = t.ST * 100;
    const ee = g > PT ? Math.round((Math.min(g, UEL) - PT) * PAYROLL.eeRate + Math.max(0, g - UEL) * PAYROLL.eeUpper) : 0;
    const er = g > ST ? Math.round((g - ST) * PAYROLL.erRate) : 0;
    return { gross: g, paye, eeNic: ee, erNic: er, net: g - paye - ee, aboveLEL: g >= t.LEL * 100 };
  }

  // Payroll run -> journal lines (pence in, pounds out)
  function payrollJournal(run) {
    const tot = { gross: 0, paye: 0, eeNic: 0, erNic: 0, pension: 0, erPension: 0, net: 0 };
    (run.lines || []).forEach(l => { Object.keys(tot).forEach(k => tot[k] += P(l[k])); });
    const ea = P(run.eaOffset);
    const j = [];
    const add = (account, dr, cr, description, division) => { if (dr || cr) j.push({ account, debit: L(dr), credit: L(cr), description, division: division || null }); };
    // Wage costs are split by division so each venture's P&L carries its own labour
    const byDiv = {};
    (run.lines || []).forEach(l => { const k = l.division || ''; const d = byDiv[k] = byDiv[k] || { gross: 0, erNic: 0, erPension: 0 }; d.gross += P(l.gross); d.erNic += P(l.erNic); d.erPension += P(l.erPension); });
    Object.keys(byDiv).sort().forEach(k => {
      const name = k ? (DIVISIONS.find(d => d.id === k) || { name: k }).name : 'Unallocated';
      add(SYSTEM.WAGES, byDiv[k].gross, 0, 'Gross wages — ' + name, k);
      add(SYSTEM.ER_NIC, byDiv[k].erNic, 0, "Employer's NIC — " + name, k);
      add('7007', byDiv[k].erPension, 0, "Employer's pension — " + name, k);
    });
    add(SYSTEM.PAYE, 0, tot.paye + tot.eeNic + tot.erNic, 'PAYE and NIC due');
    add(SYSTEM.PENSION, 0, tot.pension + tot.erPension, 'Pension due');
    add(SYSTEM.NET_WAGES, 0, tot.net, 'Net pay due to staff');
    if (ea) {
      // Employment Allowance reduces employer NIC; share it across divisions in proportion to their employer NIC
      add(SYSTEM.PAYE, ea, 0, 'Employment Allowance');
      const keys = Object.keys(byDiv).filter(k => byDiv[k].erNic > 0).sort((a, b) => byDiv[b].erNic - byDiv[a].erNic);
      const erTot = keys.reduce((s, k) => s + byDiv[k].erNic, 0);
      let left = ea;
      keys.forEach((k, i) => { const part = i === keys.length - 1 ? left : Math.round(ea * byDiv[k].erNic / erTot); left -= part; add(SYSTEM.ER_NIC, 0, part, 'Employment Allowance', k); });
      if (!keys.length) add(SYSTEM.ER_NIC, 0, ea, 'Employment Allowance');
    }
    return { lines: j, totals: tot };
  }

  // ---------- mileage ----------
  function mileageClaims(state, taxYear) {
    const per = {};
    (state.mileage || []).filter(m => taxYearStart(m.date) === taxYear).sort((a, b) => a.date < b.date ? -1 : 1).forEach(m => {
      const k = m.driver || 'Unknown';
      const d = per[k] = per[k] || { driver: k, miles: 0, claim: 0, trips: [] };
      const miles = +m.miles || 0;
      const at45 = Math.max(0, Math.min(miles, AMAP.threshold - d.miles));
      const at25 = miles - at45;
      const claim = P(at45 * AMAP.first + at25 * AMAP.after + miles * (+m.passengers || 0) * AMAP.passenger);
      d.miles += miles; d.claim += claim;
      d.trips.push(Object.assign({}, m, { claimP: claim, rate: at25 > 0 ? (at45 > 0 ? 'mixed' : '25p') : '45p' }));
    });
    return Object.values(per);
  }

  // ---------- integrity checks the accountant will run ----------
  function healthChecks(state, today) {
    const issues = [];
    const tb = trialBalance(state, {});
    if (!tb.balanced) issues.push({ level: 'critical', text: 'Trial balance does not balance' });
    (state.txns || []).forEach(t => {
      if (!POSTED(t)) return;
      const ps = postings(t);
      const dr = ps.reduce((s, p) => s + p.debit, 0), cr = ps.reduce((s, p) => s + p.credit, 0);
      if (dr !== cr) issues.push({ level: 'critical', text: `Transaction ${t.ref || t.id} is unbalanced` });
      (t.lines || []).forEach(l => {
        if (['invoice', 'bill', 'receipt', 'spend', 'credit_note', 'supplier_credit'].includes(t.type)) {
          if (!l.account) issues.push({ level: 'serious', text: `${t.ref || t.description || t.id}: line without an account` });
          const code = VAT_CODES[l.vatCode];
          if (code && code.rate && vatActive(state.company, t.date)) {
            const expect = Math.round(P(l.net) * code.rate);
            if (Math.abs(expect - P(l.vat)) > 2) issues.push({ level: 'warning', text: `${t.ref || t.description}: VAT differs from ${code.short} of net by more than 2p` });
          }
        }
      });
    });
    const unrec = (state.bankLines || []).filter(b => b.status === 'unreconciled').length;
    if (unrec) issues.push({ level: 'warning', text: `${unrec} bank line${unrec === 1 ? '' : 's'} not reconciled` });
    return { issues, tb };
  }

  const Engine = {
    P, L, r2, iso, parse, addDays, addMonths, endOfMonth, daysBetween, inRange, taxYearStart, taxYearLabel, companyYear,
    DIVISIONS, DIV_IDS, VAT_CODES, SYSTEM, DEFAULT_ACCOUNTS, INCOME_FOR_DIVISION, PAYROLL, AMAP, CT, VAT_THRESHOLD,
    SALES_TYPES, PURCHASE_TYPES, POSTED, lineTotals, txnGross, vatActive, calcLine,
    postings, ledger, accountMap, trialBalance, pnl, balanceSheet, allocatedTo, docStatus, aged,
    vatPeriods, vatEntries, vatReturn, rollingTurnover, ctEstimate, dla, payrollEstimate, payrollJournal, mileageClaims, healthChecks
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
