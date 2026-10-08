/* ============================================================
   Contacts, staff, payroll, mileage, jobs, dividends, VAT filing
   ============================================================ */
ACT.editContact = (el) => {
  const ex = (S.contacts || []).find(c => c.id === el.dataset.id);
  const c = ex ? clone(ex) : { id: uid(), kind: el.dataset.kind || 'customer', name: '', division: UI.div !== 'all' ? UI.div : null, termsDays: 30 };
  const docs = ex ? (S.txns || []).filter(t => t.contactId === c.id && E.POSTED(t)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12) : [];
  const ro = !can.edit();
  const sh = openSheet({ title: ex ? c.name : `New ${c.kind}`, body: `<div class="grid cols-2">
      ${field('Name', inp('name', c.name, 'text', ro ? 'readonly' : ''), 2)}
      ${field('Type', sel('kind', ['customer', 'supplier', 'both'].map(k => `<option value="${k}"${c.kind === k ? ' selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join(''), ro ? 'disabled' : ''))}
      ${field('Usual division', sel('division', divOptions(c.division), ro ? 'disabled' : ''))}
      ${field('Email', inp('email', c.email, 'email', ro ? 'readonly' : ''))}${field('Phone', inp('phone', c.phone, 'tel', ro ? 'readonly' : ''))}
      ${field('Address', area('address', c.address, ro ? 'readonly' : ''), 2)}
      ${field('VAT number', inp('vatNumber', c.vatNumber, 'text', ro ? 'readonly' : ''))}${field('Payment terms (days)', inp('termsDays', c.termsDays, 'number', ro ? 'readonly' : ''))}
    </div>
    ${docs.length ? `<section class="panel"><div class="panel-head"><h2>Recent</h2></div><div class="list">${docs.map(t => `<button class="list-row" data-act="openDoc" data-id="${t.id}"><span class="grow"><span class="title">${esc(t.ref || t.description || t.type)}</span><span class="meta">${fdate(t.date)} · ${esc(t.type.replace('_', ' '))}</span></span><span class="num">${money(E.txnGross(t))}</span></button>`).join('')}</div></section>` : ''}`,
    foot: ro ? '' : `${ex ? `<button class="btn danger" data-c="del">Delete</button>` : ''}<button class="btn primary" data-c="save">Save</button>` });
  if (ro) return;
  sh.querySelector('[data-c="save"]').onclick = () => run(async () => { const f = readForm(sh); if (!f.name.trim()) throw new Error('Enter a name.'); Object.assign(c, f, { division: f.division || null }); await persist('contacts', c, 'Saved'); closeSheet(); render(); });
  const del = sh.querySelector('[data-c="del"]'); if (del) del.onclick = () => run(async () => { if ((S.txns || []).some(t => t.contactId === c.id)) throw new Error('This contact has transactions, so it stays for the record.'); if (!await confirmSheet('Delete contact', `Delete ${esc(c.name)}?`, 'Delete', true)) return; await removeRec('contacts', c.id, 'Deleted'); closeSheet(); render(); });
};

// ---------- staff ----------
ACT.editStaff = (el) => {
  const ex = (S.staff || []).find(s => s.id === el.dataset.id);
  const s = ex ? clone(ex) : { id: uid(), name: '', active: true, payFrequency: 'monthly', taxCode: '1257L', rolledUpHoliday: true, division: UI.div !== 'all' ? UI.div : null, start: today() };
  const ro = !can.edit(); const priv = can.private();
  const R = ro ? 'readonly' : ''; const D = ro ? 'disabled' : '';
  const masked = (k, v) => priv ? `<div style="display:flex;gap:6px"><input class="input" data-k="${k}" id="f-${k}" type="password" value="${esc(v || '')}" ${R} autocomplete="off"><button class="btn sm" type="button" data-reveal="${k}">Show</button></div>` : `<input class="input" value="${v ? '••••••' : ''}" readonly>`;
  const sh = openSheet({ title: ex ? s.name : 'Add staff', size: 'wide', body: `
    <div class="nav-label" style="padding-left:0">Employment</div>
    <div class="grid cols-4">${field('Full legal name', inp('name', s.name, 'text', R), 2)}${field('Role', inp('role', s.role, 'text', R))}${field('Division', sel('division', divOptions(s.division), D))}
      ${field('Start date', inp('start', s.start, 'date', R))}${field('Leaving date', inp('leaveDate', s.leaveDate, 'date', R))}${field('Pay rate £/hour', inp('payRate', s.payRate, 'number', 'step="0.01" ' + R))}${field('Paid', sel('payFrequency', ['weekly', 'monthly'].map(k => `<option value="${k}"${s.payFrequency === k ? ' selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join(''), D))}
      ${field('Tax code', inp('taxCode', s.taxCode, 'text', R))}${field('Date of birth', inp('dob', s.dob, 'date', R))}${field('NI number', masked('niNumber', s.niNumber))}<div class="field" style="align-self:end">${chk('rolledUpHoliday', s.rolledUpHoliday, 'Rolled-up holiday pay 12.07%')}</div>
      <div class="field" style="align-self:end">${chk('active', s.active !== false, 'Currently working for us')}</div></div>
    <div class="nav-label" style="padding-left:0">Right to work</div>
    <div class="grid cols-4">${field('Document checked', inp('rtwDoc', s.rtwDoc, 'text', R + ' placeholder="Passport, share code…"'), 2)}${field('Date checked', inp('rtwDate', s.rtwDate, 'date', R))}${field('Permission expires', inp('rtwExpiry', s.rtwExpiry, 'date', R))}</div>
    <div class="nav-label" style="padding-left:0">Contact and bank</div>
    <div class="grid cols-4">${field('Email', inp('email', s.email, 'email', R))}${field('Phone', inp('phone', s.phone, 'tel', R))}${field('Address', inp('address', s.address, 'text', R), 2)}
      ${field('Bank', inp('bankName', s.bankName, 'text', R))}${field('Sort code', masked('bankSort', s.bankSort))}${field('Account number', masked('bankAccount', s.bankAccount))}</div>
    <div class="nav-label" style="padding-left:0">Emergency contacts</div>
    <div class="grid cols-4">${field('Name', inp('emergencyName', s.emergencyName, 'text', R))}${field('Relationship', inp('emergencyRel', s.emergencyRel, 'text', R))}${field('Phone', inp('emergencyPhone', s.emergencyPhone, 'tel', R))}<span></span>
      ${field('Second contact', inp('emergency2Name', s.emergency2Name, 'text', R))}${field('Second contact phone', inp('emergency2Phone', s.emergency2Phone, 'tel', R))}</div>
    <div class="nav-label" style="padding-left:0">Health and food safety</div>
    <div class="grid cols-3">${field('Allergies', area('allergies', s.allergies, R))}${field('Dietary requirements', area('dietary', s.dietary, R))}${field('Medical notes relevant at work', area('medical', s.medical, R + ' placeholder="EpiPen, inhaler, diabetic…"'))}</div>
    <div class="grid cols-4">${field('Food hygiene', sel('foodHygiene', ['', 'Level 1', 'Level 2', 'Level 3', 'Level 4'].map(k => `<option value="${k}"${s.foodHygiene === k ? ' selected' : ''}>${k || 'None'}</option>`).join(''), D))}${field('Food hygiene expires', inp('foodHygieneExpiry', s.foodHygieneExpiry, 'date', R))}<div class="field" style="align-self:end">${chk('firstAid', s.firstAid, 'First aid trained')}</div>${field('First aid expires', inp('firstAidExpiry', s.firstAidExpiry, 'date', R))}
      <div class="field" style="align-self:end">${chk('driving', s.driving, 'Driving licence')}</div>${field('Licence categories', inp('drivingCats', s.drivingCats, 'text', R))}${field('Uniform size', inp('uniform', s.uniform, 'text', R))}${field('Notes', inp('notes', s.notes, 'text', R))}</div>`,
    foot: ro ? '' : `${ex ? `<button class="btn danger" data-c="del">Delete</button>` : ''}<button class="btn primary" data-c="save">Save</button>` });
  sh.addEventListener('click', (e) => { const b = e.target.closest('[data-reveal]'); if (b) { const i = $(`[data-k="${b.dataset.reveal}"]`, sh); i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? 'Show' : 'Hide'; } });
  if (ro) return;
  sh.querySelector('[data-c="save"]').onclick = () => run(async () => { const f = readForm(sh); if (!f.name.trim()) throw new Error('Enter a name.'); Object.assign(s, f, { division: f.division || null, payRate: f.payRate === '' ? null : +f.payRate, niNumber: (f.niNumber || '').toUpperCase() }); await persist('staff', s, 'Saved'); closeSheet(); render(); });
  const del = sh.querySelector('[data-c="del"]'); if (del) del.onclick = () => run(async () => { if ((S.payrollRuns || []).some(r => (r.lines || []).some(l => l.staffId === s.id))) throw new Error('This person has pay history, so the record must be kept. Untick "Currently working for us" instead.'); if (!await confirmSheet('Delete staff record', `Delete ${esc(s.name)}?`, 'Delete', true)) return; await removeRec('staff', s.id, 'Deleted'); closeSheet(); render(); });
};

// ---------- payroll runs ----------
ACT.editRun = (el) => {
  const ex = (S.payrollRuns || []).find(r => r.id === el.dataset.id);
  const t = today(); const mStart = t.slice(0, 7) + '-01';
  const r = ex ? clone(ex) : { id: uid(), periodFrom: mStart, periodTo: E.endOfMonth(mStart), payDate: E.endOfMonth(mStart), frequency: 'monthly', status: 'estimate', lines: [], claimEA: true };
  if (!ex) (S.staff || []).filter(s => s.active !== false && s.payFrequency === r.frequency).forEach(s => r.lines.push({ staffId: s.id, name: s.name, hours: 0, rate: +s.payRate || 0, division: s.division || null }));
  const ro = !can.edit() || r.status === 'posted' || lockedDate(r.payDate);
  const eaUsedBefore = (S.payrollRuns || []).filter(x => x.id !== r.id && E.taxYearStart(x.payDate) === E.taxYearStart(r.payDate)).reduce((s, x) => s + E.P(x.eaOffset), 0);
  const calc = (l) => {
    const st = (S.staff || []).find(s => s.id === l.staffId) || {};
    const basic = E.P((+l.hours || 0) * (+l.rate || 0)); const hol = st.rolledUpHoliday ? Math.round(basic * E.PAYROLL.holidayRolledUp) : 0;
    l.basic = E.L(basic); l.holiday = E.L(hol);
    if (r.status === 'estimate') { const est = E.payrollEstimate(E.L(basic + hol), r.frequency, st.taxCode); l.gross = E.L(est.gross); l.paye = E.L(est.paye); l.eeNic = E.L(est.eeNic); l.erNic = E.L(est.erNic); l.net = E.L(est.net - E.P(l.pension)); }
  };
  const totals = () => { const k = (f) => r.lines.reduce((s, l) => s + E.P(l[f]), 0); const er = k('erNic'); const ea = r.claimEA ? Math.max(0, Math.min(er, E.PAYROLL.employmentAllowance * 100 - eaUsedBefore)) : 0; r.eaOffset = E.L(ea); return { gross: k('gross'), paye: k('paye'), ee: k('eeNic'), er, net: k('net'), ea }; };
  const body = () => { r.lines.forEach(calc); const tt = totals();
    return `${r.status === 'posted' ? callout('good', 'Posted to the ledger. Delete the payroll journal from the general ledger first if this run needs to change.') : lockedDate(r.payDate) ? callout('warn', `The pay date is inside the locked period (up to ${fdate(S.company.lockDate)}). Ask your accountant to move the lock date to post this run.`) : ''}
    <div class="grid cols-4">${field('Period from', inp('periodFrom', r.periodFrom, 'date', ro ? 'readonly' : ''))}${field('Period to', inp('periodTo', r.periodTo, 'date', ro ? 'readonly' : ''))}${field('Pay date', inp('payDate', r.payDate, 'date', ro ? 'readonly' : ''))}
      ${field('Figures', sel('status', [['estimate', 'Estimate — calculated here'], ['final', 'Final — from payroll provider']].map(([k, l]) => `<option value="${k}"${r.status === k ? ' selected' : ''}>${l}</option>`).join('') + (r.status === 'posted' ? '<option value="posted" selected>Posted</option>' : ''), ro ? 'disabled' : ''))}</div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Employee</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Basic</th><th class="num">Holiday</th><th class="num">Gross</th><th class="num">PAYE</th><th class="num">Employee NIC</th><th class="num">Employer NIC</th><th class="num">Net</th></tr></thead><tbody>
    ${r.lines.map((l, i) => { const fin = r.status === 'final' && !ro; const num = (k, v) => `<input class="input num" style="width:92px;height:30px" type="number" step="0.01" data-pl="${k}" data-i="${i}" value="${v}" aria-label="${k}" ${ro ? 'readonly' : ''}>`;
      return `<tr><td>${esc(staffName(l.staffId))}<div class="faint" style="font-size:12px">${divName(l.division)}</div></td><td class="num">${num('hours', l.hours)}</td><td class="num">${num('rate', l.rate)}</td><td class="num">${money(E.P(l.basic))}</td><td class="num">${money(E.P(l.holiday))}</td>
        ${fin ? `<td class="num">${num('gross', l.gross)}</td><td class="num">${num('paye', l.paye)}</td><td class="num">${num('eeNic', l.eeNic)}</td><td class="num">${num('erNic', l.erNic)}</td><td class="num">${num('net', l.net)}</td>` : `${td$(E.P(l.gross))}${td$(E.P(l.paye))}${td$(E.P(l.eeNic))}${td$(E.P(l.erNic))}${td$(E.P(l.net))}`}</tr>`; }).join('') || `<tr><td colspan="10">${emptyState('No staff on this frequency', 'Add staff and set them to be paid ' + r.frequency + '.')}</td></tr>`}
    <tr class="total"><td colspan="5">Total</td>${td$(tt.gross)}${td$(tt.paye)}${td$(tt.ee)}${td$(tt.er)}${td$(tt.net)}</tr></tbody></table></div>
    <div class="head-actions" style="justify-content:space-between">${chk('claimEA', r.claimEA, `Offset Employment Allowance (${money(Math.max(0, E.PAYROLL.employmentAllowance * 100 - eaUsedBefore))} left this tax year)`)}<span class="muted">Due to HMRC ${money(tt.paye + tt.ee + tt.er - tt.ea)} by the 22nd of next month</span></div>`; };
  const foot = () => `<button class="btn" data-r="csv">${ico('down')} Payroll input CSV</button>${ro ? '' : `${ex ? '<button class="btn danger" data-r="del">Delete</button>' : ''}<button class="btn" data-r="save">Save</button>${r.status === 'final' ? '<button class="btn primary" data-r="post">Post to ledger</button>' : ''}`}`;
  const sh = openSheet({ title: ex ? `Pay run ${fdate(r.payDate)}` : 'New pay run', size: 'wide', sticky: !ro, body: `<div id="rb">${body()}</div>`, foot: foot() });
  const re = () => keepFocus(sh, () => { $('#rb', sh).innerHTML = body(); sh.querySelector('.sheet-foot').innerHTML = foot(); });
  sh.addEventListener('change', (e) => { const x = e.target;
    if (x.dataset.pl) { r.lines[+x.dataset.i][x.dataset.pl] = +x.value || 0; re(); }
    else if (x.dataset.k === 'claimEA') { r.claimEA = x.checked; re(); }
    else if (x.dataset.k) { r[x.dataset.k] = x.value; re(); }
  });
  sh.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; run(async () => {
    const a = b.dataset.r;
    if (a === 'csv') { const cols = [{ h: 'pay_date', v: () => r.payDate }, { h: 'employee', v: l => staffName(l.staffId) }, { h: 'ni_number', v: l => ((S.staff || []).find(s => s.id === l.staffId) || {}).niNumber || '' }, { h: 'tax_code', v: l => ((S.staff || []).find(s => s.id === l.staffId) || {}).taxCode || '' }, { h: 'hours', v: 'hours' }, { h: 'rate', v: l => (+l.rate).toFixed(2) }, { h: 'basic', v: l => (+l.basic).toFixed(2) }, { h: 'holiday_pay', v: l => (+l.holiday).toFixed(2) }, { h: 'gross', v: l => (+l.gross).toFixed(2) }];
      return saveFile(`payroll-input-${r.payDate}.csv`, toCSV(cols, r.lines), 'text/csv'); }
    if (a === 'del') { if (!await confirmSheet('Delete pay run', 'Delete this pay run?', 'Delete', true)) return; await removeRec('payrollRuns', r.id, 'Deleted'); closeSheet(); render(); return; }
    if (a === 'save') { await persist('payrollRuns', r, 'Pay run saved'); closeSheet(); render(); return; }
    if (a === 'post') {
      if (lockedDate(r.payDate)) throw new Error('The pay date is inside the locked period.');
      totals(); const j = E.payrollJournal(r);
      const t = { id: uid(), type: 'payroll', date: r.payDate, ref: 'PAY-' + r.payDate.slice(0, 7), description: `Payroll ${fdate(r.periodFrom)} – ${fdate(r.periodTo)}`, status: 'approved', lines: j.lines, payrollRunId: r.id };
      await persist('txns', t); r.status = 'posted'; r.txnId = t.id; await persist('payrollRuns', r, 'Posted to the ledger'); closeSheet(); render();
    }
  }); });
};

// ---------- mileage ----------
ACT.editTrip = (el) => {
  const ex = (S.mileage || []).find(m => m.id === el.dataset.id);
  const m = ex ? clone(ex) : Object.assign({ id: uid(), date: today(), driver: (S.company.directors || [{}])[0].name || '', miles: '', passengers: 0, method: 'manual' }, el.preset || {});
  const ro = !can.edit() || !!m.claimTxnId;
  const drivers = [...new Set([].concat((S.company.directors || []).map(d => d.name), (S.staff || []).filter(s => s.active !== false).map(s => s.name)))];
  const sh = openSheet({ title: ex ? 'Trip' : 'Log a trip', body: `${m.claimTxnId ? callout('', 'Already claimed and posted, so the trip is read only.') : ''}<div class="grid cols-2">
    ${field('Date', inp('date', m.date, 'date', ro ? 'readonly' : ''))}${field('Driver', sel('driver', drivers.map(d => `<option${d === m.driver ? ' selected' : ''}>${esc(d)}</option>`).join(''), ro ? 'disabled' : ''))}
    ${field('From', inp('from', m.from, 'text', ro ? 'readonly' : ''))}${field('To', inp('to', m.to, 'text', ro ? 'readonly' : ''))}
    ${field('Business purpose', inp('purpose', m.purpose, 'text', ro ? 'readonly' : ''), 2)}
    ${field('Miles', inp('miles', m.miles, 'number', 'step="0.1" ' + (ro ? 'readonly' : '')))}${field('Passengers', inp('passengers', m.passengers, 'number', 'min="0" ' + (ro ? 'readonly' : '')))}
    ${field('Job code', sel('jobCode', jobOptions(m.jobCode), ro ? 'disabled' : ''))}${field('Division', sel('division', divOptions(m.division), ro ? 'disabled' : ''))}</div>`,
    foot: ro ? '' : `${ex ? '<button class="btn danger" data-c="del">Delete</button>' : ''}<button class="btn primary" data-c="save">Save trip</button>` });
  if (ro) return;
  sh.querySelector('[data-c="save"]').onclick = () => run(async () => { const f = readForm(sh); if (!(+f.miles > 0)) throw new Error('Enter the miles.'); if (!f.purpose) throw new Error('HMRC needs the business purpose of each journey.'); Object.assign(m, f, { miles: +f.miles, passengers: +f.passengers || 0, jobCode: f.jobCode || null, division: f.division || null }); await persist('mileage', m, 'Trip saved'); closeSheet(); render(); });
  const del = sh.querySelector('[data-c="del"]'); if (del) del.onclick = () => run(async () => { await removeRec('mileage', m.id, 'Deleted'); closeSheet(); render(); });
};
ACT.trackTrip = () => {
  if (!navigator.geolocation) throw new Error('This device does not offer location.');
  let watch = null, last = null, miles = 0, started = Date.now(), wake = null;
  const hav = (a, b) => { const R = 3958.8, toR = (x) => x * Math.PI / 180; const dLa = toR(b.lat - a.lat), dLo = toR(b.lon - a.lon); const h = Math.sin(dLa / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const sh = openSheet({ title: 'Track a trip', size: 'narrow', sticky: true, noFocus: true, body: `<div style="text-align:center;display:grid;gap:6px;padding:18px 0"><div id="trk-mi" style="font:700 54px/1 var(--font-display);font-variant-numeric:tabular-nums">0.0</div><div class="muted">miles</div><div id="trk-st" class="faint">Waiting for GPS…</div></div>${callout('', 'Keep this screen open while driving. Readings less accurate than 60 metres are ignored.')}`,
    foot: `<button class="btn" data-t="x">Cancel</button><button class="btn primary" data-t="stop">Stop and log</button>` });
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => wake = w).catch(() => {});
  watch = navigator.geolocation.watchPosition((pos) => {
    const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    $('#trk-st', sh).textContent = `Accuracy ${Math.round(pos.coords.accuracy)} m · ${Math.round((Date.now() - started) / 60000)} min`;
    if (pos.coords.accuracy > 60) return; if (last) { const d = hav(last, p); if (d > 0.01) { miles += d; last = p; } } else last = p;
    $('#trk-mi', sh).textContent = miles.toFixed(1);
  }, (err) => { $('#trk-st', sh).textContent = err.code === 1 ? 'Location permission was refused. Allow it in the browser settings, or log the trip by hand.' : 'GPS unavailable: ' + err.message; }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
  const stop = () => { if (watch != null) navigator.geolocation.clearWatch(watch); if (wake) wake.release().catch(() => {}); };
  sh.querySelector('[data-t="x"]').onclick = () => { stop(); closeSheet(); };
  sh.querySelector('[data-t="stop"]').onclick = () => { stop(); closeSheet(); ACT.editTrip({ dataset: {}, preset: { miles: Math.round(miles * 10) / 10, method: 'gps' } }); };
};
ACT.postMileage = async () => {
  const ty = E.taxYearStart(today()); const claims = E.mileageClaims(S, ty);
  const dirs = S.company.directors || []; let posted = 0;
  for (const c of claims) {
    const open = c.trips.filter(x => !x.claimTxnId && !lockedDate(x.date)); if (!open.length) continue;
    const amt = open.reduce((s, x) => s + x.claimP, 0); const d = dirs.find(x => x.name === c.driver);
    const date = open.map(x => x.date).sort().slice(-1)[0];
    const t = { id: uid(), type: 'journal', date, ref: 'MIL-' + date.slice(0, 7), description: `Mileage claim — ${c.driver} (${open.reduce((s, x) => s + (+x.miles || 0), 0)} miles)`, status: 'approved',
      lines: [{ account: '7304', debit: E.L(amt), credit: 0, description: `${plural(open.length, 'trip')} at approved mileage rates` }, { account: d ? d.dla : '2109', debit: 0, credit: E.L(amt), description: d ? 'Owed to director' : 'Owed to employee — pay with next payroll' }] };
    await persist('txns', t);
    for (const x of open) { const m = S.mileage.find(y => y.id === x.id); m.claimTxnId = t.id; await store.save('mileage', m); }
    posted++;
  }
  toast(posted ? `Posted ${plural(posted, 'claim')}` : 'Nothing to post'); render();
};

// ---------- job codes ----------
ACT.editJob = (el) => {
  const ex = (S.jobCodes || []).find(j => j.code === el.dataset.id);
  const j = ex ? clone(ex) : { code: '', name: '', division: UI.div !== 'all' ? UI.div : 'events', eventDate: today(), status: 'booked' };
  const ro = !can.edit();
  const f0 = ex ? jobFigures(j.code) : null;
  const sh = openSheet({ title: ex ? j.code : 'New job code', body: `<div class="grid cols-2">
    ${field('Code', inp('code', j.code, 'text', ex || ro ? 'readonly' : 'placeholder="EV-2611-01"'))}${field('Division', sel('division', divOptions(j.division, false), ro ? 'disabled' : ''))}
    ${field('Job name', inp('name', j.name, 'text', ro ? 'readonly' : ''), 2)}${field('Customer', sel('client', contactOptions(j.client, 'customer'), ro ? 'disabled' : ''))}${field('Event date', inp('eventDate', j.eventDate, 'date', ro ? 'readonly' : ''))}
    ${field('Notes', area('notes', j.notes, ro ? 'readonly' : ''), 2)}</div>
    ${f0 ? `<dl class="kv"><dt>Sales</dt><dd>${money(f0.rev)}</dd><dt>Direct costs</dt><dd>${money(f0.cost)}</dd><dt>Mileage</dt><dd>${f0.miles} miles · ${money(f0.mileCost)}</dd><dt>Profit</dt><dd><strong>${money(f0.profit)}</strong>${f0.rev ? ` · ${Math.round(f0.profit / f0.rev * 100)}% margin` : ''}</dd></dl>` : ''}`,
    foot: ro ? '' : `<button class="btn primary" data-c="save">Save</button>` });
  if (ro) return;
  sh.querySelector('[data-c="save"]').onclick = () => run(async () => {
    const f = readForm(sh); const code = (f.code || '').trim().toUpperCase();
    if (!code) throw new Error('Enter a code.'); if (!ex && (S.jobCodes || []).some(x => x.code === code)) throw new Error('That code already exists.');
    Object.assign(j, f, { code, client: f.client || null }); await persist('jobCodes', j, 'Saved'); closeSheet(); render();
  });
};

// ---------- dividends ----------
ACT.dividend = () => {
  const dirs = S.company.directors || []; const cy = E.companyYear(S.company, today());
  const bs = E.balanceSheet(S, { at: today() }); const ct = E.ctEstimate(S, cy);
  const reserves = bs.totals.equity - ((bs.equity.find(r => r.code === '3000') || {}).amount || 0) - ct.tax;
  const sh = openSheet({ title: 'Declare dividend', size: 'narrow', body: `${callout(reserves > 0 ? '' : 'bad', `Distributable reserves are about ${money(reserves)} after the corporation tax estimate. A dividend above that is unlawful. Confirm the figure with your accountant before declaring.`)}
    <div class="grid cols-2">${field('Total dividend', inp('amount', '', 'number', 'step="0.01"'))}${field('Date declared', inp('date', today(), 'date'))}</div>
    <p class="muted" style="margin:0;font-size:13px">Split by shareholding: ${dirs.map(d => `${esc(d.name)} ${d.share}%`).join(', ')}. Each share is credited to that director's loan account, ready to be paid out.</p>`,
    foot: `<button class="btn" data-c="x">Cancel</button><button class="btn primary" data-c="ok">Post dividend</button>` });
  sh.querySelector('[data-c="x"]').onclick = closeSheet;
  sh.querySelector('[data-c="ok"]').onclick = () => run(async () => {
    const f = readForm(sh); const total = E.P(f.amount); if (!(total > 0)) throw new Error('Enter an amount.');
    if (total > reserves && !await confirmSheet('Above reserves', `${money(total)} is more than the estimated reserves of ${money(reserves)}. Post anyway?`, 'Post anyway', true)) return;
    let left = total; const lines = [{ account: '3200', debit: E.L(total), credit: 0, description: 'Interim dividend' }];
    dirs.forEach((d, i) => { const share = i === dirs.length - 1 ? left : Math.round(total * d.share / 100); left -= share; lines.push({ account: d.dla, debit: 0, credit: E.L(share), description: `Dividend — ${d.name} ${d.share}%` }); });
    await persist('txns', { id: uid(), type: 'journal', date: f.date, ref: 'DIV-' + f.date, description: 'Interim dividend declared', status: 'approved', lines }, 'Dividend posted'); closeSheet(); render();
  });
};

// ---------- VAT filing ----------
function vatPeriodByKey(key) { return E.vatPeriods(S.company, E.addMonths(today(), 3)).find(p => p.key === key); }
ACT.exportVat = async (el) => {
  const p = vatPeriodByKey(el.dataset.key); const r = E.vatReturn(S, p);
  const f = (S.vatReturns || []).find(x => x.from === p.from && x.status === 'filed'); const B = f ? f.boxes : r.boxes;
  const labels = ['VAT due on sales and other outputs', 'VAT due on acquisitions from the EU', 'Total VAT due', 'VAT reclaimed on purchases and other inputs', 'Net VAT to pay or reclaim', 'Total value of sales excluding VAT', 'Total value of purchases excluding VAT', 'Total value of supplies to the EU', 'Total value of acquisitions from the EU'];
  const csv = toCSV([{ h: 'vrn', v: () => S.company.vatNumber || '' }, { h: 'period_from', v: () => p.from }, { h: 'period_to', v: () => p.to }, { h: 'box', v: 'n' }, { h: 'description', v: 'l' }, { h: 'value', v: r2 => r2.n >= 6 ? String(Math.trunc(r2.v / 100)) : dec(r2.v) }], labels.map((l, i) => ({ n: i + 1, l, v: B[i + 1] })));
  await saveFile(`vat-return-${p.from}-to-${p.to}.csv`, csv, 'text/csv');
};
ACT.fileVat = (el) => {
  const p = vatPeriodByKey(el.dataset.key); const r = E.vatReturn(S, p); const B = r.boxes;
  const sh = openSheet({ title: `File VAT ${fdate(p.from)} – ${fdate(p.to)}`, size: 'narrow', body: `<dl class="kv"><dt>Box 1</dt><dd>${money(B[1])}</dd><dt>Box 4</dt><dd>${money(B[4])}</dd><dt>Box 5</dt><dd><strong>${money(B[5])}</strong></dd><dt>Box 6</dt><dd>${money0(B[6])}</dd><dt>Box 7</dt><dd>${money0(B[7])}</dd></dl>
    ${field('HMRC submission receipt or reference', inp('receipt', '', 'text', 'placeholder="From your MTD software"'))}
    ${callout('', `Marking filed stores these figures, posts a journal clearing 2200 and 2201 to 2202 VAT control, and locks every date up to ${fdate(p.to)}.`)}`,
    foot: `<button class="btn" data-c="x">Cancel</button><button class="btn primary" data-c="ok">Mark as filed</button>` });
  sh.querySelector('[data-c="x"]').onclick = closeSheet;
  sh.querySelector('[data-c="ok"]').onclick = () => run(async () => {
    const f = readForm(sh);
    const lines = [{ account: '2200', debit: E.L(B[1]), credit: 0, description: 'Box 1 output VAT' }, { account: '2201', debit: 0, credit: E.L(B[4]), description: 'Box 4 input VAT' }];
    lines.push(B[5] >= 0 ? { account: '2202', debit: 0, credit: E.L(B[5]), description: 'Box 5 due to HMRC' } : { account: '2202', debit: E.L(-B[5]), credit: 0, description: 'Box 5 repayable by HMRC' });
    const j = { id: uid(), type: 'journal', date: p.to, ref: 'VAT-' + p.to.slice(0, 7), description: `VAT return ${fdate(p.from)} – ${fdate(p.to)}`, status: 'approved', lines: lines.filter(l => E.P(l.debit) || E.P(l.credit)) };
    if (j.lines.length >= 2) await persist('txns', j);
    await store.save('vatReturns', { id: uid(), from: p.from, to: p.to, boxes: B, status: 'filed', filedAt: nowIso(), filedBy: store.user.name || store.user.email, receipt: f.receipt || '', journalId: j.id });
    const c = Object.assign({}, S.company); if (!c.lockDate || c.lockDate < p.to) c.lockDate = p.to; await saveCompany(c);
    closeSheet(); toast('Return filed and period locked'); render();
  });
};
