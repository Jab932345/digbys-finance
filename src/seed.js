/* ============================================================
   Demo company — fictional figures for the accountant walkthrough.
   Deterministic: the same data every load.
   ============================================================ */
(function (root) {
  'use strict';
  const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.Engine;

  function DemoSeed(today) {
    today = today || E.iso(new Date());
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const between = (a, b) => Math.round((a + rnd() * (b - a)) * 100) / 100;
    let n = 0; const id = (p) => `${p}_${(++n).toString(36).padStart(4, '0')}`;

    const company = {
      name: "Digby's & Co Limited", tradingName: "Digby's", companyNo: '16XXXXXX', utr: '00000 00000',
      regOffice: 'Unit 3, Example Farm, Southam, Warwickshire CV47 0XX', registeredIn: 'England and Wales',
      email: 'accounts@digbysevents.co.uk', phone: '01926 000000',
      incorporated: '2026-04-01', yearEnd: '03-31', associatedCompanies: 0,
      vatRegistered: true, vatNumber: 'GB 000 0000 00', vatRegDate: '2026-04-01', vatScheme: 'standard', vatStagger: 1, flatRate: 12.5, frsFirstYearDiscount: false,
      lockDate: '2026-06-30',
      bankName: 'Starling Bank', bankAccountName: "Digby's & Co Limited", bankSort: '60-83-71', bankAccountNo: '00000000',
      invoicePrefix: 'INV-', nextInvoiceNo: 188, paymentTerms: 30,
      directors: [{ name: 'James Brierley', share: 70, dla: '2300' }, { name: 'Mike Jeffries', share: 30, dla: '2301' }],
      demo: true
    };

    const contacts = [
      ['c_bvh', 'customer', 'Bishops Itchington Village Hall', 'hire'],
      ['c_fsh', 'customer', 'Fosse Farm Shop', 'pies'],
      ['c_wfs', 'customer', 'Welsh Road Farm Shop', 'pies'],
      ['c_hlf', 'customer', 'Hill Lane Farm', 'butchery'],
      ['c_lgf', 'customer', 'Ladbroke Grange Farm', 'butchery'],
      ['c_kph', 'customer', 'Kineton Parish Hall', 'hire'],
      ['s_pw', 'supplier', 'Produce Warriors', 'events'],
      ['s_bk', 'supplier', 'Booker Wholesale', null],
      ['s_ox', 'supplier', 'Oxhay Farm', 'butchery'],
      ['s_pl', 'supplier', 'Plato Hire', 'events'],
      ['s_ml', 'supplier', 'Shipton Mill', 'pies'],
      ['s_pk', 'supplier', 'Vegware', 'pies'],
      ['s_ll', 'supplier', 'Unit landlord', null],
      ['s_ins', 'supplier', 'Simply Business', null],
      ['s_acc', 'supplier', 'Accountant', null],
      ['s_hmrc', 'supplier', 'HM Revenue & Customs', null],
      ['s_ce', 'supplier', 'Commercial Catering Equipment Ltd', 'events'],
      ['s_cr', 'supplier', 'Steelite crockery', 'hire']
    ].map(([cid, kind, name, division]) => ({ id: cid, kind, name, division, email: '', phone: '', address: '', termsDays: 30 }));

    const jobCodes = [];
    const txns = [];
    const bankLines = [];
    const mileage = [];
    const payrollRuns = [];
    const audit = [];

    const T = (o) => { const t = Object.assign({ id: id('t'), status: 'approved', createdAt: o.date + 'T09:00:00Z', createdBy: 'james@digbysevents.co.uk' }, o); txns.push(t); return t; };
    const line = (account, amount, vatCode, division, extra) => {
      const c = E.calcLine(amount, vatCode, !!(extra && extra.inclusive));
      return Object.assign({ id: id('l'), account, vatCode, net: c.net, vat: c.vat, division: division || null }, extra || {}, { inclusive: undefined });
    };
    const bankLine = (t, amountSigned, counterparty, reference, status) => {
      const b = { id: 'sl_' + t.id, account: '1200', date: t.date, amount: E.r2(amountSigned), counterparty, reference: reference || '', category: '', status: status || 'reconciled', txnId: t.id };
      bankLines.push(b); t.bankLineId = b.id; return b;
    };
    const gross = (t) => E.L(E.txnGross(t));
    let invNo = 150;
    const invoice = (date, contactId, division, jobCode, lines, desc) => {
      invNo++;
      return T({ type: 'invoice', date, dueDate: E.addDays(date, 30), contactId, division, jobCode, ref: 'INV-' + invNo, description: desc, lines, sentAt: date });
    };
    const pay = (inv, date, amount, ref) => {
      if (date > today) return null;
      const amt = amount == null ? gross(inv) : amount;
      const p = T({ type: 'customer_payment', date, contactId: inv.contactId, amount: amt, allocations: [{ txnId: inv.id, amount: amt }], description: 'Payment ' + inv.ref, ref: ref || inv.ref, division: inv.division });
      bankLine(p, amt, (contacts.find(c => c.id === inv.contactId) || {}).name, inv.ref);
      return p;
    };
    const bill = (date, contactId, ref, lines, desc, division) => T({ type: 'bill', date, dueDate: E.addDays(date, 30), contactId, ref, description: desc, lines, division });
    const payBill = (b, date) => {
      if (date > today) return null;
      const amt = gross(b);
      const p = T({ type: 'supplier_payment', date, contactId: b.contactId, amount: amt, allocations: [{ txnId: b.id, amount: amt }], description: 'Payment ' + b.ref, ref: b.ref });
      bankLine(p, -amt, (contacts.find(c => c.id === b.contactId) || {}).name, b.ref);
      return p;
    };
    const spend = (date, contactId, lines, desc, division, ref) => {
      if (date > today) return null;
      const t = T({ type: 'spend', date, contactId, lines, description: desc, division, ref: ref || '' });
      bankLine(t, -gross(t), (contacts.find(c => c.id === contactId) || {}).name || desc, ref || desc);
      return t;
    };
    const receipt = (date, contactId, lines, desc, division, counterparty) => {
      if (date > today) return null;
      const t = T({ type: 'receipt', date, contactId, lines, description: desc, division });
      bankLine(t, gross(t), counterparty || desc, desc);
      return t;
    };

    // --- opening: share capital and director funding ---
    receipt('2026-04-01', null, [line('3000', 70, 'OS', null, { description: '70 ordinary £1 shares — J Brierley' }), line('3000', 30, 'OS', null, { description: '30 ordinary £1 shares — M Jeffries' })], 'Share capital subscribed', null, 'BRIERLEY J');
    receipt('2026-04-02', null, [line('2300', 5000, 'OS', null, { description: 'Director loan to company' })], 'Director funding — J Brierley', null, 'BRIERLEY J');
    receipt('2026-04-03', null, [line('2301', 3000, 'OS', null, { description: 'Director loan to company' })], 'Director funding — M Jeffries', null, 'JEFFRIES M');

    // --- fixed assets ---
    const rat = bill('2026-04-10', 's_ce', 'CCE-8812', [line('0010', 6500, 'S20', 'events', { description: 'Rational iCombi Classic 6-1/1, refurbished', capitalGoods: true })], 'Combi oven', 'events');
    payBill(rat, '2026-04-24');
    const cro = bill('2026-04-14', 's_cr', 'STL-20417', [line('0030', 4800, 'S20', 'hire', { description: 'Hire stock: 120 place settings', capitalGoods: true })], 'Hire stock', 'hire');
    payBill(cro, '2026-05-12');

    // --- monthly trading ---
    const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    const kinds = [['Wedding', 92], ['Wake', 60], ['Private dining', 24], ['Celebration', 110]];
    const surnames = ['Harrington', 'Ashby', 'Fenwick', 'Okoro', 'Whitlock', 'Mercer', 'Pryce', 'Langley', 'Doherty', 'Achterberg', 'Sandys', 'Rowell', 'Hext', 'Castell', 'Brough', 'Tanner', 'Vane', 'Ellery'];
    let evN = 0;
    months.forEach((m, mi) => {
      const d = (day) => `${m}-${String(day).padStart(2, '0')}`;
      // Events: three jobs a month
      [6, 14, 23].forEach((day, k) => {
        const [kind, covers0] = kinds[(mi + k) % kinds.length];
        const sur = surnames[evN++ % surnames.length];
        const name = kind === 'Wedding' ? `${sur} wedding` : kind === 'Wake' ? `${sur} family wake` : kind === 'Private dining' ? `${sur} private dinner` : `${sur} celebration`;
        const cid = 'c_ev' + evN;
        contacts.push({ id: cid, kind: 'customer', name: kind === 'Wedding' ? `${sur} wedding party` : `${sur} family`, division: 'events', email: '', phone: '', address: '', termsDays: 30 });
        const covers = Math.round(covers0 * (0.8 + rnd() * 0.4));
        const jc = `EV-${m.slice(2, 4)}${m.slice(5)}-${String(k + 1).padStart(2, '0')}`;
        jobCodes.push({ code: jc, name: `${name}`, division: 'events', client: cid, eventDate: d(day + 3), status: 'complete' });
        const pp = kind === 'Wake' ? 13.99 / 1.2 : kind === 'Wedding' ? 58 : kind === 'Private dining' ? 75 : 32;
        const lines = [line('4000', E.r2(covers * pp), 'S20', 'events', { description: `${kind} catering — ${covers} covers`, jobCode: jc, qty: covers, unitPrice: E.r2(pp) })];
        if (kind !== 'Wake') lines.push(line('4000', E.r2(Math.ceil(covers / 20) * 4 * 18 * 6), 'S20', 'events', { description: 'Service staff', jobCode: jc }));
        if (kind === 'Wedding' || kind === 'Celebration') lines.push(line('4030', E.r2(covers * 2.4), 'S20', 'hire', { description: 'Crockery & cutlery hire', jobCode: jc }));
        const inv = invoice(d(day), cid, 'events', jc, lines, `${name}`);
        // 40% deposit then balance; the latest jobs stay open for the aged debtors report
        const g = gross(inv);
        const dep = E.r2(g * 0.4);
        pay(inv, d(Math.min(day + 2, 28)), dep, inv.ref + ' deposit');
        if (!(mi === 5 && k >= 1)) pay(inv, E.addDays(d(day), 24 + Math.round(rnd() * 10)), E.r2(g - dep), inv.ref + ' balance');
        // direct costs for the job
        const pw = bill(d(Math.max(1, day - 2)), 's_pw', 'PW-' + (4100 + mi * 10 + k), [line('5000', between(140, 420), 'Z0', 'events', { description: 'Herbs, veg, dairy', jobCode: jc })], 'Produce Warriors', 'events');
        payBill(pw, E.addDays(pw.date, 14));
        spend(d(Math.max(1, day - 1)), 's_bk', [
          line('5000', between(180, 520), 'Z0', 'events', { description: 'Dry goods & proteins', jobCode: jc }),
          line('5020', between(30, 90), 'S20', 'events', { description: 'Disposables', jobCode: jc })
        ], 'Booker — job shop', 'events', 'BOOKER LTD');
        mileage.push({ id: id('m'), date: d(day + 3), driver: 'James Brierley', from: 'Prep unit, Southam', to: name, purpose: `${kind} service`, miles: Math.round(18 + rnd() * 40), passengers: 1, jobCode: jc, division: 'events', method: rnd() > 0.4 ? 'gps' : 'manual' });
      });
      // Pies: weekly market/card payouts + farm shop wholesale
      [3, 10, 17, 24].forEach(day => receipt(d(day), null, [line('4010', between(260, 520), 'Z0', 'pies', { description: 'Cold pies — market & collection' })], 'SumUp payout — pies', 'pies', 'SUMUP PAYMENTS'));
      ['c_fsh', 'c_wfs'].forEach((cid, k) => {
        const qty = Math.round(60 + rnd() * 80);
        const inv = invoice(d(26 + k), cid, 'pies', null, [line('4010', E.r2(qty * 3.2), 'Z0', 'pies', { description: `Wholesale pies × ${qty}`, qty, unitPrice: 3.2 })], 'Wholesale pies');
        if (mi < 5) pay(inv, E.addDays(inv.date, 21 + k * 6));
      });
      const ml = bill(d(5), 's_ml', 'SM-' + (900 + mi), [line('5000', between(160, 260), 'Z0', 'pies', { description: 'Flour, lard, butter' })], 'Pastry ingredients', 'pies');
      payBill(ml, E.addDays(ml.date, 20));
      spend(d(8), 's_pk', [line('5020', between(55, 110), 'S20', 'pies', { description: 'Pie boxes & labels' })], 'Pie packaging', 'pies', 'VEGWARE');
      // Butchery: cut & pack for farms + meat boxes
      ['c_hlf', 'c_lgf'].forEach((cid, k) => {
        const head = 2 + Math.round(rnd() * 3);
        const inv = invoice(d(11 + k * 7), cid, 'butchery', null, [line('4020', E.r2(head * 95), 'Z0', 'butchery', { description: `Cut, pack & label — ${head} lambs`, qty: head, unitPrice: 95 })], 'Butchery services');
        if (mi < 5) pay(inv, E.addDays(inv.date, 18));
      });
      const ox = bill(d(2), 's_ox', 'OX-' + (300 + mi), [line('5010', between(600, 1100), 'Z0', 'butchery', { description: 'Beef quarters' })], 'Oxhay Farm beef', 'butchery');
      payBill(ox, E.addDays(ox.date, 28));
      receipt(d(20), null, [line('4020', between(700, 1350), 'Z0', 'butchery', { description: 'Meat boxes — collection day' })], 'SumUp payout — meat boxes', 'butchery', 'SUMUP PAYMENTS');
      // Hire: two hall hires a month
      ['c_bvh', 'c_kph'].forEach((cid, k) => {
        const settings = 40 + Math.round(rnd() * 60);
        const inv = invoice(d(9 + k * 10), cid, 'hire', null, [
          line('4030', E.r2(settings * 2.1), 'S20', 'hire', { description: `Place settings × ${settings} (washed on return)`, qty: settings, unitPrice: 2.1 }),
          line('4030', 25, 'S20', 'hire', { description: 'Delivery & collection' })
        ], 'Crockery hire');
        if (!(mi === 4 && k === 1) && (mi < 5 || k === 0)) pay(inv, E.addDays(inv.date, 12));
      });
      // Overheads
      spend(d(1), 's_ll', [line('7100', 650, 'EX', null, { description: 'Prep unit rent' })], 'Rent', null, 'UNIT RENT');
      spend(d(15), null, [line('7200', between(140, 220), 'R5', null, { description: 'Electricity', inclusive: true })], 'Electricity', null, 'OCTOPUS ENERGY');
      spend(d(12), s('s_ins'), [line('7700', 84.5, 'EX', null, { description: 'Public & employers liability' })], 'Insurance', null, 'SIMPLY BUSINESS');
      spend(d(18), null, [line('7300', between(70, 130), 'S20', null, { description: 'Diesel', inclusive: true })], 'Fuel', null, 'SHELL');
      spend(d(4), null, [line('7502', 14, 'S20', null, { description: 'Google Workspace' })], 'Software', null, 'GOOGLE');
      spend(d(27), null, [line('7900', between(18, 34), 'EX', 'pies', { description: 'Card processing fees' })], 'SumUp fees', 'pies', 'SUMUP FEES');
      if (mi % 3 === 2) { const a = bill(d(28), 's_acc', 'ACC-' + (mi + 1), [line('7600', 450, 'S20', null, { description: 'Quarterly bookkeeping review' })], 'Accountancy'); payBill(a, E.addDays(a.date, 10)); }
      // Plato Hire for the wedding
      const pl = bill(d(5), 's_pl', 'PH-' + (77 + mi), [line('5030', between(120, 260), 'S20', 'events', { description: 'Glassware hire' })], 'Plato Hire', 'events');
      payBill(pl, E.addDays(pl.date, 30));
      // Supplier runs
      mileage.push({ id: id('m'), date: d(19), driver: 'James Brierley', from: 'Prep unit, Southam', to: 'Oxhay Farm', purpose: 'Carcass collection', miles: 46, passengers: 0, jobCode: null, division: 'butchery', method: 'gps' });
    });
    function s(x) { return x; }

    // --- payroll: monthly runs, paid on the last working day ---
    const staff = [
      { id: 'st_1', name: 'Ellie Marsh', role: 'Chef de partie', division: 'events', payRate: 15.5, payFrequency: 'monthly', taxCode: '1257L', niNumber: 'QQ 12 34 56 C', dob: '1996-03-14', start: '2026-04-01', rolledUpHoliday: true, rtwDoc: 'UK passport', rtwDate: '2026-03-28', email: 'ellie@example.com', phone: '07700 900001', address: '1 Example Road, Southam', bankSort: '00-00-00', bankAccount: '00000001', bankName: 'Monzo', emergencyName: 'Dan Marsh', emergencyRel: 'Partner', emergencyPhone: '07700 900101', allergies: 'None', dietary: 'Vegetarian', medical: '', foodHygiene: 'Level 3', foodHygieneExpiry: '2028-02-01', firstAid: true, firstAidExpiry: '2027-06-01', driving: true, drivingCats: 'B', uniform: 'Jacket M', notes: '', active: true },
      { id: 'st_2', name: 'Tom Haddon', role: 'Front of house', division: 'events', payRate: 12.71, payFrequency: 'monthly', taxCode: '1257L', niNumber: 'QQ 22 33 44 D', dob: '2004-09-02', start: '2026-04-01', rolledUpHoliday: true, rtwDoc: 'UK passport', rtwDate: '2026-03-30', email: 'tom@example.com', phone: '07700 900002', address: '2 Example Road, Southam', bankSort: '00-00-00', bankAccount: '00000002', bankName: 'Starling', emergencyName: 'Ruth Haddon', emergencyRel: 'Mother', emergencyPhone: '07700 900102', allergies: 'Peanuts (EpiPen carried)', dietary: '', medical: 'EpiPen in bag', foodHygiene: 'Level 2', foodHygieneExpiry: '2027-04-01', firstAid: false, driving: false, uniform: 'Waistcoat S', notes: '', active: true },
      { id: 'st_3', name: 'Priya Shah', role: 'Butchery assistant', division: 'butchery', payRate: 14, payFrequency: 'monthly', taxCode: 'BR', niNumber: 'QQ 98 76 54 A', dob: '1990-11-20', start: '2026-05-01', rolledUpHoliday: true, rtwDoc: 'Share code', rtwDate: '2026-04-25', rtwExpiry: '2027-04-25', email: 'priya@example.com', phone: '07700 900003', address: '3 Example Road, Leamington', bankSort: '00-00-00', bankAccount: '00000003', bankName: 'HSBC', emergencyName: 'Raj Shah', emergencyRel: 'Brother', emergencyPhone: '07700 900103', allergies: '', dietary: 'Halal', medical: '', foodHygiene: 'Level 2', foodHygieneExpiry: '2027-09-01', firstAid: true, firstAidExpiry: '2026-11-15', driving: true, drivingCats: 'B, BE', uniform: 'Apron L', notes: 'Second job — BR code', active: true },
      { id: 'st_4', name: 'Sam Okafor', role: 'Pie baker', division: 'pies', payRate: 13.25, payFrequency: 'monthly', taxCode: '1257L', niNumber: 'QQ 55 66 77 B', dob: '1999-07-07', start: '2026-04-15', rolledUpHoliday: true, rtwDoc: 'UK birth certificate + NI letter', rtwDate: '2026-04-10', email: 'sam@example.com', phone: '07700 900004', address: '4 Example Road, Southam', bankSort: '00-00-00', bankAccount: '00000004', bankName: 'Barclays', emergencyName: 'Grace Okafor', emergencyRel: 'Sister', emergencyPhone: '07700 900104', allergies: 'Shellfish', dietary: '', medical: '', foodHygiene: 'Level 2', foodHygieneExpiry: '2027-01-10', firstAid: false, driving: true, drivingCats: 'B', uniform: 'Jacket L', notes: '', active: true }
    ];
    let eaUsed = 0;
    months.forEach((m, mi) => {
      const payDate = E.endOfMonth(m + '-01');
      const lines = staff.filter(st => st.start <= payDate).map(st => {
        const hours = Math.round((st.division === 'events' ? 48 : 36) + rnd() * 30);
        const basic = E.P(hours * st.payRate);
        const holiday = st.rolledUpHoliday ? Math.round(basic * E.PAYROLL.holidayRolledUp) : 0;
        const est = E.payrollEstimate(E.L(basic + holiday), 'monthly', st.taxCode);
        return { staffId: st.id, name: st.name, hours, rate: st.payRate, basic: E.L(basic), holiday: E.L(holiday), gross: E.L(est.gross), paye: E.L(est.paye), eeNic: E.L(est.eeNic), erNic: E.L(est.erNic), pension: 0, erPension: 0, net: E.L(est.net), division: st.division };
      });
      const erTotal = lines.reduce((s2, l) => s2 + E.P(l.erNic), 0);
      const ea = Math.min(erTotal, E.PAYROLL.employmentAllowance * 100 - eaUsed); eaUsed += ea;
      const run = { id: id('pr'), periodFrom: m + '-01', periodTo: payDate, payDate, frequency: 'monthly', status: mi < 5 ? 'posted' : 'final', lines, eaOffset: E.L(ea), source: 'Payroll bureau figures', createdAt: payDate + 'T10:00:00Z' };
      payrollRuns.push(run);
      if (run.status === 'posted') {
        const j = E.payrollJournal(run);
        const t = T({ type: 'payroll', date: payDate, description: `Payroll ${m}`, ref: 'PAY-' + m, lines: j.lines, payrollRunId: run.id });
        run.txnId = t.id;
        const netTotal = lines.reduce((s2, l) => s2 + E.P(l.net), 0);
        spend(payDate, null, [line('2220', E.L(netTotal), 'OS', null, { description: 'Net wages' })], `Net wages ${m}`, null, 'WAGES ' + m);
        const hmrc = E.L(lines.reduce((s2, l) => s2 + E.P(l.paye) + E.P(l.eeNic) + E.P(l.erNic), 0) - ea);
        if (hmrc > 0) spend(E.addDays(payDate, 22), 's_hmrc', [line('2210', hmrc, 'OS', null, { description: 'PAYE & NIC' })], `HMRC PAYE ${m}`, null, 'HMRC PAYE');
      }
    });

    // --- mileage claims to director's loan (quarterly) ---
    [['2026-06-30', '2026-04-01'], ['2026-09-30', '2026-07-01']].forEach(([to, from]) => {
      const trips = mileage.filter(x => x.date >= from && x.date <= to);
      const miles = trips.reduce((s2, x) => s2 + x.miles, 0);
      const pass = trips.reduce((s2, x) => s2 + x.miles * (x.passengers || 0), 0);
      const amt = E.r2(miles * 0.45 + pass * 0.05);
      const t = T({ type: 'journal', date: to, ref: 'MIL-' + to.slice(0, 7), description: `Mileage claim ${from} to ${to} — J Brierley`, lines: [
        { account: '7304', debit: amt, credit: 0, description: `${miles} business miles at 45p` },
        { account: '2300', debit: 0, credit: amt, description: "Owed to director" }] });
      trips.forEach(x => x.claimTxnId = t.id);
    });

    // --- Q1 VAT return filed: clear the control accounts and pay HMRC ---
    const st0 = { company, txns, accounts: E.DEFAULT_ACCOUNTS };
    const q1 = E.vatReturn(st0, { from: '2026-04-01', to: '2026-06-30' });
    const b = q1.boxes;
    const vj = T({ type: 'journal', date: '2026-06-30', ref: 'VAT-2026Q1', description: 'VAT return Apr–Jun 2026', lines: [
      { account: '2200', debit: E.L(b[1]), credit: 0, description: 'Box 1 output VAT' },
      { account: '2201', debit: 0, credit: E.L(b[4]), description: 'Box 4 input VAT' },
      b[5] >= 0 ? { account: '2202', debit: 0, credit: E.L(b[5]), description: 'Box 5 due to HMRC' } : { account: '2202', debit: E.L(-b[5]), credit: 0, description: 'Box 5 repayable' }
    ] });
    const vatReturns = [{ id: 'vr_q1', from: '2026-04-01', to: '2026-06-30', boxes: b, status: 'filed', filedAt: '2026-08-04T11:20:00Z', filedBy: 'Accountant', receipt: 'MTD receipt 1234567890', journalId: vj.id }];
    if (b[5] > 0) spend('2026-08-06', 's_hmrc', [line('2202', E.L(b[5]), 'OS', null, { description: 'VAT Apr–Jun 2026' })], 'HMRC VAT payment', null, 'HMRC VAT');
    else receipt('2026-08-12', 's_hmrc', [line('2202', E.L(-b[5]), 'OS', null, { description: 'VAT repayment Apr–Jun 2026' })], 'HMRC VAT repayment', null, 'HMRC VAT');

    // --- number invoices in date order, one unbroken sequence ---
    const invs = txns.filter(t => t.type === 'invoice').sort((a, c) => a.date < c.date ? -1 : a.date > c.date ? 1 : 0);
    const remap = {}; let seq = 120;
    invs.forEach(t => { const nw = 'INV-' + (seq++); remap[t.ref] = nw; t.ref = nw; });
    company.nextInvoiceNo = seq;
    const swap = (str) => String(str || '').replace(/INV-\d+/g, m => remap[m] || m);
    txns.forEach(t => { if (t.type !== 'invoice') { t.ref = swap(t.ref); t.description = swap(t.description); } });
    bankLines.forEach(b => { b.reference = swap(b.reference); });

    // --- October: lines waiting on the bank feed ---
    const openInv = txns.filter(t => t.type === 'invoice' && t.date >= '2026-09-01').sort((a, c) => a.date < c.date ? -1 : 1);
    const target = openInv.find(t => E.docStatus({ txns }, t, today).due > 0 && t.division === 'hire');
    const unrec = [
      { date: '2026-10-01', amount: -650, counterparty: 'UNIT RENT', reference: 'Oct rent' },
      { date: '2026-10-02', amount: -94.6, counterparty: 'PRODUCE WARRIORS', reference: 'PW-4171' },
      { date: '2026-10-03', amount: 412.5, counterparty: 'SUMUP PAYMENTS', reference: 'Payout' },
      { date: '2026-10-05', amount: -152.18, counterparty: 'BOOKER LTD', reference: 'Card 4417' },
      { date: '2026-10-06', amount: target ? E.L(E.docStatus({ txns }, target, today).due) : 233.4, counterparty: target ? (contacts.find(c => c.id === target.contactId) || { name: 'Hire customer' }).name.toUpperCase() : 'HIRE CUSTOMER', reference: target ? target.ref : 'Hire' },
      { date: '2026-10-07', amount: -71.2, counterparty: 'SHELL', reference: 'Fuel' },
      { date: '2026-10-07', amount: 1000, counterparty: 'BRIERLEY J', reference: 'Business' }
    ].filter(x => x.date <= today);
    unrec.forEach((x, i) => bankLines.push({ id: 'sl_new_' + i, account: '1200', date: x.date, amount: x.amount, counterparty: x.counterparty, reference: x.reference, category: '', status: 'unreconciled', txnId: null }));

    const rules = [
      { id: 'r1', match: 'PRODUCE WARRIORS', direction: 'out', action: 'code', account: '5000', vatCode: 'Z0', division: 'events', contactId: 's_pw' },
      { id: 'r2', match: 'BOOKER', direction: 'out', action: 'code', account: '5000', vatCode: 'Z0', division: 'events', contactId: 's_bk' },
      { id: 'r3', match: 'SUMUP PAYMENTS', direction: 'in', action: 'code', account: '4010', vatCode: 'Z0', division: 'pies' },
      { id: 'r4', match: 'BRIERLEY', direction: 'in', action: 'code', account: '2300', vatCode: 'OS', division: null },
      { id: 'r5', match: 'UNIT RENT', direction: 'out', action: 'code', account: '7100', vatCode: 'EX', division: null, contactId: 's_ll' },
      { id: 'r6', match: 'SHELL', direction: 'out', action: 'code', account: '7300', vatCode: 'S20', division: null, inclusive: true }
    ];

    const users = [
      { email: 'james@digbysevents.co.uk', name: 'James Brierley', role: 'owner' },
      { email: 'mike@example.com', name: 'Mike Jeffries', role: 'director' },
      { email: 'accountant@example.com', name: 'Your accountant', role: 'accountant' }
    ];

    txns.slice(-6).forEach(t => audit.push({ id: id('a'), ts: (t.createdAt || t.date + 'T09:00:00Z'), user: 'james@digbysevents.co.uk', action: 'create', entity: 'txn', entityId: t.id, summary: `${t.type} ${t.ref || t.description || ''}`.trim() }));
    audit.push({ id: id('a'), ts: '2026-08-04T11:20:00Z', user: 'accountant@example.com', action: 'file', entity: 'vat_return', entityId: 'vr_q1', summary: 'VAT return Apr–Jun 2026 marked filed; period locked to 30 Jun 2026' });

    const starlingBalance = E.r2(bankLines.reduce((s2, x) => s2 + x.amount, 0));

    return { company, accounts: E.DEFAULT_ACCOUNTS.map(a => Object.assign({}, a)), contacts, jobCodes, txns, bankLines, staff, payrollRuns, mileage, vatReturns, rules, users, audit, starlingBalance };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = DemoSeed;
  else root.DemoSeed = DemoSeed;
})(typeof window !== 'undefined' ? window : globalThis);
