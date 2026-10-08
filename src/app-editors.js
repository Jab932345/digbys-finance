/* ============================================================
   Editors: invoices, bills, bank coding, journals, payments
   ============================================================ */
const DOC_TITLES = { invoice: 'Invoice', credit_note: 'Credit note', bill: 'Bill', supplier_credit: 'Supplier credit', receipt: 'Receive money', spend: 'Spend money' };
const isSalesType = (t) => ['invoice', 'credit_note', 'receipt'].includes(t);
const incomeDivision = (code) => Object.keys(E.INCOME_FOR_DIVISION).find(k => E.INCOME_FOR_DIVISION[k] === code) || null;
const clone = (o) => JSON.parse(JSON.stringify(o));

function blankLine(type, division) {
  const account = isSalesType(type) ? (E.INCOME_FOR_DIVISION[division] || '4000') : '5000';
  const a = ACC()[account] || {};
  return { id: uid(), description: '', account, qty: isSalesType(type) && type !== 'receipt' ? 1 : null, unitPrice: null, amount: '', vatCode: a.vatDefault || 'S20', net: 0, vat: 0, division: division || null };
}
function recalcLine(l, inclusive, active) {
  if (!active) { l.vatCode = 'NR'; }
  if (l.qty != null && l.unitPrice !== null && l.unitPrice !== '' && l.qty !== '') l.amount = E.r2((+l.qty || 0) * (+l.unitPrice || 0));
  const c = E.calcLine(+l.amount || 0, l.vatCode, inclusive);
  l.net = c.net; l.vat = c.vat;
}

function txnEditor(existing, preset) {
  const t0 = existing ? clone(existing) : Object.assign({ id: uid(), type: preset.type, date: today(), status: preset.type === 'invoice' || preset.type === 'credit_note' ? 'draft' : 'approved', division: UI.div !== 'all' ? UI.div : null, lines: [] }, preset || {});
  const doc = t0;
  const readOnly = !can.edit() || lockedDate(doc.date) || doc.status === 'void';
  if (!doc.lines.length) doc.lines.push(blankLine(doc.type, doc.division));
  if (doc.dueDate == null && ['invoice', 'bill'].includes(doc.type)) doc.dueDate = E.addDays(doc.date, +S.company.paymentTerms || 30);
  doc.lines.forEach(l => { if (l.amount == null || l.amount === '') l.amount = doc.inclusive ? E.r2(+l.net + +l.vat) : +l.net; });
  const sales = isSalesType(doc.type);
  const bankTyped = ['receipt', 'spend'].includes(doc.type);
  const showQty = ['invoice', 'credit_note'].includes(doc.type);

  const headFields = () => `<div class="grid cols-4">
    ${field(sales ? 'Customer' : 'Supplier', sel('contactId', contactOptions(doc.contactId, sales ? 'customer' : 'supplier'), readOnly ? 'disabled' : 'data-h="1"'), 2)}
    ${field('Date', inp('date', doc.date, 'date', readOnly ? 'readonly' : 'data-h="1"'))}
    ${['invoice', 'bill', 'credit_note', 'supplier_credit'].includes(doc.type) ? field('Due', inp('dueDate', doc.dueDate || '', 'date', readOnly ? 'readonly' : 'data-h="1"')) : field('Bank account', sel('bankAccount', accountOptions(doc.bankAccount || '1200', a => a.type === 'bank'), readOnly ? 'disabled' : 'data-h="1"'))}
    ${field('Division', sel('division', divOptions(doc.division), readOnly ? 'disabled' : 'data-h="1"'))}
    ${field('Job code', sel('jobCode', jobOptions(doc.jobCode), readOnly ? 'disabled' : 'data-h="1"'))}
    ${field(doc.type === 'invoice' ? 'Invoice number' : 'Reference', inp('ref', doc.type === 'invoice' && !doc.ref ? '' : doc.ref || '', 'text', (doc.type === 'invoice' ? 'readonly placeholder="Given when approved"' : readOnly ? 'readonly' : 'data-h="1"')))}
    ${field('Amounts are', sel('inclusive', `<option value="0"${!doc.inclusive ? ' selected' : ''}>VAT exclusive</option><option value="1"${doc.inclusive ? ' selected' : ''}>VAT inclusive</option>`, readOnly || !vatOn(doc.date) ? 'disabled' : 'data-h="1"'))}
    ${field('Description', inp('description', doc.description || '', 'text', readOnly ? 'readonly' : 'data-h="1"'), 4)}
  </div>`;
  const linesHtml = () => {
    const active = vatOn(doc.date);
    return `<div class="lines">
      <div class="line head"><span>Description</span><span>Account</span><span>${showQty ? 'Qty' : ''}</span><span>${showQty ? 'Unit price' : ''}</span><span>${doc.inclusive ? 'Gross' : 'Net'} amount</span><span>VAT code</span><span>VAT · division</span><span></span></div>
      ${doc.lines.map((l, i) => `<div class="line">
        <input class="input" data-l="description" data-i="${i}" value="${esc(l.description || '')}" placeholder="Description" aria-label="Line description" ${readOnly ? 'readonly' : ''}>
        <select class="input" data-l="account" data-i="${i}" aria-label="Account" ${readOnly ? 'disabled' : ''}>${accountOptions(l.account)}</select>
        ${showQty ? `<input class="input num" type="number" step="any" data-l="qty" data-i="${i}" value="${l.qty == null ? '' : l.qty}" aria-label="Quantity" ${readOnly ? 'readonly' : ''}>` : '<span></span>'}
        ${showQty ? `<input class="input num" type="number" step="0.01" data-l="unitPrice" data-i="${i}" value="${l.unitPrice == null ? '' : l.unitPrice}" aria-label="Unit price" ${readOnly ? 'readonly' : ''}>` : '<span></span>'}
        <input class="input num" type="number" step="0.01" data-l="amount" data-i="${i}" value="${l.amount === '' ? '' : l.amount}" aria-label="Amount" ${readOnly || (showQty && l.unitPrice != null && l.unitPrice !== '') ? 'readonly' : ''}>
        <select class="input" data-l="vatCode" data-i="${i}" aria-label="VAT code" ${readOnly || !active ? 'disabled' : ''}>${vatOptions(active ? l.vatCode : 'NR')}</select>
        <div style="display:grid;gap:4px"><input class="input num" type="number" step="0.01" data-l="vat" data-i="${i}" value="${(+l.vat).toFixed(2)}" aria-label="VAT amount" ${readOnly || !active ? 'readonly' : ''}><select class="input" data-l="division" data-i="${i}" aria-label="Line division" ${readOnly ? 'disabled' : ''}>${divOptions(l.division)}</select></div>
        ${readOnly ? '<span></span>' : `<button class="btn sm plain" data-rm="${i}" aria-label="Remove line">${ico('x')}</button>`}
      </div>`).join('')}
      ${readOnly ? '' : `<div><button class="btn sm tinted" data-addline="1">${ico('plus')} Add line</button></div>`}
    </div>`;
  };
  const totalsHtml = () => { const tt = E.lineTotals(doc.lines); return `<div class="totals"><div><span class="muted">Net</span><span>${money(tt.net)}</span></div>${vatOn(doc.date) ? `<div><span class="muted">VAT</span><span>${money(tt.vat)}</span></div>` : ''}<div class="grand"><span>Total</span><span>${money(tt.gross)}</span></div></div>`; };

  const st = existing && ['invoice', 'bill', 'credit_note', 'supplier_credit'].includes(doc.type) ? E.docStatus(S, existing, today()) : null;
  const notes = [];
  if (lockedDate(doc.date)) notes.push(callout('warn', `Dated inside the locked period (up to ${fdate(S.company.lockDate)}). Read only.`));
  if (doc.status === 'void') notes.push(callout('warn', 'This document is void and posts nothing.'));
  if (!vatOn(doc.date) && S.company.vatRegistered) notes.push(callout('', 'Dated before VAT registration, so no VAT applies.'));

  const foot = readOnly ? `<button class="btn" data-sheet-close-btn>Close</button>` :
    `<span class="left">${st ? statusPill(st) : ''}</span>
    ${existing && doc.status !== 'void' ? (doc.type === 'invoice' && doc.ref ? `<button class="btn danger" data-x="void">Void</button>` : `<button class="btn danger" data-x="delete">Delete</button>`) : ''}
    ${doc.type === 'invoice' || doc.type === 'credit_note' ? (doc.status === 'draft' ? `<button class="btn" data-x="draft">Save draft</button><button class="btn primary" data-x="approve">Approve${doc.type === 'invoice' ? ' and number' : ''}</button>` : `<button class="btn primary" data-x="save">Save</button>`) :
      `${doc.status === 'draft' ? `<button class="btn" data-x="draft">Save draft</button>` : ''}<button class="btn primary" data-x="approve">${existing ? 'Save' : 'Save and post'}</button>`}`;

  const sheet = openSheet({ title: `${DOC_TITLES[doc.type]}${doc.ref ? ' ' + doc.ref : existing ? '' : ' — new'}`, size: 'wide', sticky: true,
    body: `${notes.join('')}<div id="ed-head">${headFields()}</div><div id="ed-lines">${linesHtml()}</div><div id="ed-totals" style="display:grid">${totalsHtml()}</div>`, foot });
  const refresh = (all) => keepFocus(sheet, () => { if (all) $('#ed-head', sheet).innerHTML = headFields(); $('#ed-lines', sheet).innerHTML = linesHtml(); $('#ed-totals', sheet).innerHTML = totalsHtml(); });
  const closeBtn = sheet.querySelector('[data-sheet-close-btn]'); if (closeBtn) closeBtn.onclick = closeSheet;

  sheet.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.h) {
      const k = el.getAttribute('data-k'); const prevDiv = doc.division;
      doc[k] = k === 'inclusive' ? el.value === '1' : (el.value || null);
      if (k === 'division') doc.lines.forEach(l => { if (!l.division || l.division === prevDiv) { l.division = doc.division; if (isSalesType(doc.type) && incomeDivision(l.account) && E.INCOME_FOR_DIVISION[doc.division]) { l.account = E.INCOME_FOR_DIVISION[doc.division]; const a = ACC()[l.account]; if (a) l.vatCode = a.vatDefault; } } });
      if (k === 'contactId' && !existing) { const c = (S.contacts || []).find(x => x.id === doc.contactId); if (c && c.division && !doc.division) { doc.division = c.division; doc.lines.forEach(l => { if (!l.division) { l.division = c.division; if (isSalesType(doc.type) && incomeDivision(l.account) && E.INCOME_FOR_DIVISION[c.division]) { l.account = E.INCOME_FOR_DIVISION[c.division]; const a = ACC()[l.account]; if (a) l.vatCode = a.vatDefault; } } }); } }
      if (k === 'date' && ['invoice', 'bill'].includes(doc.type) && !existing) doc.dueDate = E.addDays(doc.date, +S.company.paymentTerms || 30);
      doc.lines.forEach(l => recalcLine(l, doc.inclusive, vatOn(doc.date)));
      refresh(k === 'date' || k === 'contactId' || k === 'division'); return;
    }
    if (el.dataset.l) {
      const l = doc.lines[+el.dataset.i]; const k = el.dataset.l; let v = el.value;
      if (['qty', 'unitPrice', 'amount', 'vat'].includes(k)) v = v === '' ? (k === 'amount' ? '' : null) : +v;
      if (k === 'division') v = v || null;
      l[k] = v;
      if (k === 'account') { const a = ACC()[v]; if (a && vatOn(doc.date)) l.vatCode = a.vatDefault || l.vatCode; const d = incomeDivision(v); if (d) l.division = d; }
      if (k === 'vat') { l.vat = E.r2(+v || 0); l.net = doc.inclusive ? E.r2((+l.amount || 0) - l.vat) : E.r2(+l.amount || 0); }
      else recalcLine(l, doc.inclusive, vatOn(doc.date));
      refresh(false);
    }
  });
  sheet.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]'); if (rm) { doc.lines.splice(+rm.dataset.rm, 1); if (!doc.lines.length) doc.lines.push(blankLine(doc.type, doc.division)); refresh(false); return; }
    if (e.target.closest('[data-addline]')) { doc.lines.push(blankLine(doc.type, doc.division)); refresh(false); return; }
    const x = e.target.closest('[data-x]'); if (!x) return;
    run(async () => {
      const action = x.dataset.x;
      if (action === 'delete') {
        if (!await confirmSheet('Delete', 'Delete this entry? It will be removed from the ledger. The audit trail keeps a copy.', 'Delete', true)) return;
        await removeRec('txns', doc.id, 'Deleted'); if (doc.bankLineId) await unlinkBankLine(doc.bankLineId); closeSheet(); render(); return;
      }
      if (action === 'void') {
        if (!await confirmSheet('Void invoice', `Void ${doc.ref}? It keeps its number in the sequence but posts nothing. Any payments allocated to it stay on the customer's account.`, 'Void', true)) return;
        doc.status = 'void'; doc.voidedAt = nowIso(); await persist('txns', doc, `${doc.ref} voided`); closeSheet(); render(); return;
      }
      // validate
      doc.lines = doc.lines.filter(l => (+l.amount || 0) !== 0 || (l.description || '').trim());
      if (!doc.lines.length) throw new Error('Add at least one line with an amount.');
      if (doc.lines.some(l => !l.account)) throw new Error('Every line needs an account.');
      if (['invoice', 'credit_note', 'bill', 'supplier_credit'].includes(doc.type) && !doc.contactId) throw new Error(`Choose a ${sales ? 'customer' : 'supplier'}.`);
      if (!doc.date) throw new Error('Enter a date.');
      doc.lines.forEach(l => { if (!vatOn(doc.date)) { l.vatCode = 'NR'; l.vat = 0; l.net = E.r2(+l.amount || 0); } });
      if (action === 'draft') doc.status = 'draft';
      if (action === 'approve') {
        if ((doc.type === 'invoice' || doc.type === 'credit_note') && !doc.ref) {
          const c = Object.assign({}, S.company); const no = +c.nextInvoiceNo || 1;
          doc.ref = (doc.type === 'credit_note' ? 'CN-' : (c.invoicePrefix || '')) + no;
          c.nextInvoiceNo = no + 1; await saveCompany(c);
        }
        doc.status = 'approved';
        if (doc.type === 'credit_note' && doc.creditFor && !(doc.allocations || []).length) {
          const inv = (S.txns || []).find(x => x.id === doc.creditFor);
          if (inv) { const due = E.docStatus(S, inv, today()).due; const amt = Math.min(due, E.lineTotals(doc.lines).gross); if (amt > 0) doc.allocations = [{ txnId: inv.id, amount: E.L(amt) }]; }
        }
      }
      await persist('txns', doc, `${DOC_TITLES[doc.type]} ${doc.ref || ''} saved`.replace(/\s+/g, ' '));
      if (preset && preset.bankLineId) { const bl = (S.bankLines || []).find(b => b.id === preset.bankLineId); if (bl) { bl.status = 'reconciled'; bl.txnId = doc.id; await store.save('bankLines', bl); } }
      closeSheet(); render();
      if (doc.type === 'invoice' && action === 'approve' && !existing) invoiceView(doc.id);
    });
  });
}

async function unlinkBankLine(blId) { const bl = (S.bankLines || []).find(b => b.id === blId); if (bl) { bl.status = 'unreconciled'; bl.txnId = null; await store.save('bankLines', bl); } }

ACT.newDoc = (el) => txnEditor(null, { type: el.dataset.type });
ACT.openDoc = (el) => openDoc(el.dataset.id);
function openDoc(idv) {
  const t = (S.txns || []).find(x => x.id === idv); if (!t) return;
  if (t.type === 'invoice' || t.type === 'credit_note') return t.status === 'draft' && can.edit() ? txnEditor(t) : invoiceView(t.id);
  if (['bill', 'supplier_credit', 'receipt', 'spend'].includes(t.type)) return txnEditor(t);
  if (t.type === 'journal' || t.type === 'payroll') return journalEditor(t);
  return paymentView(t);
}

// ---------- invoice document ----------
function invoiceDoc(inv) {
  const c = S.company; const d = E.DIVISIONS.find(x => x.id === inv.division);
  const cust = (S.contacts || []).find(x => x.id === inv.contactId) || {};
  const tt = E.lineTotals(inv.lines); const vat = vatOn(inv.date);
  const job = (S.jobCodes || []).find(j => j.code === inv.jobCode);
  const st = E.docStatus(S, inv, today());
  const isCN = inv.type === 'credit_note';
  const m = (p) => money(p);
  const vatByRate = {}; if (vat) inv.lines.forEach(l => { if (E.P(l.vat)) { const k = vatShort(l.vatCode); vatByRate[k] = (vatByRate[k] || 0) + E.P(l.vat); } });
  return `<div class="inv-doc">
    <div class="inv-top"><div class="inv-brand"><div class="nm">DIGBY'S</div><div class="st">${esc(d ? d.strap : 'Events & Catering')}</div></div>
      <div class="inv-title"><div class="w">${isCN ? 'CREDIT NOTE' : 'INVOICE'}</div><div class="no">${esc(inv.ref || 'DRAFT')}</div><div style="font-size:13px;margin-top:4px">${fdate(inv.date)}</div></div></div>
    <div class="inv-rule"></div>
    <div class="inv-two"><div><h4>Bill to</h4><div>${esc(cust.name || '')}</div>${cust.address ? `<div>${esc(cust.address).replace(/\n/g, '<br>')}</div>` : ''}${cust.email ? `<div>${esc(cust.email)}</div>` : ''}</div>
      <div><h4>${job ? 'Event' : 'Details'}</h4>${job ? `<div>${esc(job.name)}</div>${job.eventDate ? `<div>${fdate(job.eventDate)}</div>` : ''}` : ''}${inv.jobCode ? `<div>Job code ${esc(inv.jobCode)}</div>` : ''}${inv.description && !job ? `<div>${esc(inv.description)}</div>` : ''}${vat ? `<div>Tax point ${fdate(inv.date)}</div>` : ''}</div></div>
    <table class="inv-table"><thead><tr><th>Description</th><th class="r">Unit price</th><th class="r">Qty</th>${vat ? '<th class="r">VAT</th>' : ''}<th class="r">Total</th></tr></thead><tbody>
      ${inv.lines.map(l => `<tr><td>${esc(l.description || acctName(l.account))}</td><td class="r">${l.unitPrice != null && l.unitPrice !== '' ? m(E.P(l.unitPrice)) : ''}</td><td class="r">${l.qty != null && l.qty !== '' ? l.qty : ''}</td>${vat ? `<td class="r">${vatShort(l.vatCode)}</td>` : ''}<td class="r">${m(E.P(l.net))}</td></tr>`).join('')}
    </tbody></table>
    <div class="inv-sum"><div><span>Subtotal</span><span>${m(tt.net)}</span></div>${vat ? Object.entries(vatByRate).map(([k, v]) => `<div><span>VAT at ${k}</span><span>${m(v)}</span></div>`).join('') : ''}${st.paid && !isCN ? `<div><span>Paid</span><span>−${m(st.paid)}</span></div>` : ''}</div>
    <div class="inv-due"><span>${isCN ? 'TOTAL CREDIT' : 'TOTAL DUE'}</span><span>${m(isCN ? tt.gross : (st.key === 'draft' ? tt.gross : st.due))}</span></div>
    ${isCN ? '' : `<div class="inv-pay"><div><h4 style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a807a">Payment details</h4>Account name: ${esc(c.bankAccountName || c.name)}<br>Sort code: ${esc(c.bankSort || '')}<br>Account number: ${esc(c.bankAccountNo || '')}<br>Reference: ${esc(inv.jobCode || inv.ref || '')}</div>
      <div><h4 style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a807a">Terms</h4>Payment due by ${fdate(inv.dueDate)}${c.paymentTerms ? ` (${c.paymentTerms} days)` : ''}.<br>${c.email ? esc(c.email) : ''}${c.phone ? '<br>' + esc(c.phone) : ''}</div></div>`}
    <div class="inv-thanks">Thank you for choosing Digby's.</div>
    <div class="inv-legal">${esc(c.name)} · Registered in ${esc(c.registeredIn || 'England and Wales')} · Company no. ${esc(c.companyNo || '')} · Registered office: ${esc(c.regOffice || '')}${vat ? ' · VAT no. ' + esc(c.vatNumber || '') : ''}</div>
  </div>`;
}
function invoiceStandalone(inv) {
  const css = Array.from(document.styleSheets).map(s => { try { return Array.from(s.cssRules).map(r => r.cssText).filter(t => /\.inv-/.test(t)).join('\n'); } catch (e) { return ''; } }).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.ref || 'Invoice')} — ${esc(S.company.name)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap"><style>:root{--font-brand:"Lora",Georgia,serif;--font:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;--shadow:none}body{margin:0;background:#fff}@page{size:A4;margin:0}${css}</style></head><body>${invoiceDoc(inv)}</body></html>`;
}

function invoiceView(idv) {
  const inv = (S.txns || []).find(x => x.id === idv); if (!inv) return;
  const st = E.docStatus(S, inv, today());
  const pays = (S.txns || []).filter(t => (t.allocations || []).some(a => a.txnId === inv.id) && E.POSTED(t));
  const editable = can.edit() && !lockedDate(inv.date) && inv.status !== 'void';
  const sh = openSheet({ title: `${inv.type === 'credit_note' ? 'Credit note' : 'Invoice'} ${inv.ref || 'draft'}`, size: 'wide', noFocus: true,
    body: `<div class="head-actions" style="justify-content:space-between">${statusPill(st)}<span class="muted" style="font-size:13px">${divChip(inv.division)} ${inv.sentAt ? '· sent ' + fdate(inv.sentAt) : ''} ${lockedDate(inv.date) ? '· locked' : ''}</span></div>
      ${invoiceDoc(inv)}
      ${pays.length ? `<section class="panel"><div class="panel-head"><h2>Payments</h2></div><div class="list">${pays.map(p => `<button class="list-row" data-act="openDoc" data-id="${p.id}"><span class="grow"><span class="title">${fdate(p.date)}</span><span class="meta">${esc(p.type.replace('_', ' '))} ${esc(p.ref || '')}</span></span><span class="num">${money(E.P((p.allocations.find(a => a.txnId === inv.id) || {}).amount))}</span></button>`).join('')}</div></section>` : ''}`,
    foot: `<span class="left">${money(st.gross)} · ${st.due ? money(st.due) + ' outstanding' : 'settled'}</span>
      <button class="btn" data-v="download">${ico('down')} Download</button>
      ${!inArtifact() ? `<button class="btn" data-v="print">Print or save PDF</button>` : ''}
      ${editable && inv.type === 'invoice' && inv.status !== 'draft' ? `<button class="btn" data-v="credit">Credit note</button>` : ''}
      ${editable ? `<button class="btn" data-v="edit">Edit</button>` : ''}
      ${editable && inv.type === 'invoice' && !inv.sentAt && inv.status === 'approved' ? `<button class="btn tinted" data-v="sent">Mark sent</button>` : ''}
      ${can.edit() && st.due > 0 && inv.type === 'invoice' && inv.status === 'approved' ? `<button class="btn primary" data-v="pay">Record payment</button>` : ''}` });
  sh.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    run(async () => {
      const v = b.dataset.v;
      if (v === 'download') return saveFile(`${inv.ref || 'invoice-draft'}.html`, invoiceStandalone(inv), 'text/html');
      if (v === 'print') { const w = window.open('', '_blank'); if (!w) throw new Error('Allow pop-ups to print the invoice.'); w.document.write(invoiceStandalone(inv)); w.document.close(); setTimeout(() => w.print(), 600); return; }
      if (v === 'edit') { closeSheet(); return txnEditor(inv); }
      if (v === 'sent') { inv.sentAt = today(); await persist('txns', inv, 'Marked sent'); closeSheet(); render(); return invoiceView(inv.id); }
      if (v === 'pay') { closeSheet(); return paymentSheet(inv); }
      if (v === 'credit') { closeSheet(); return txnEditor(null, { type: 'credit_note', contactId: inv.contactId, division: inv.division, jobCode: inv.jobCode, description: `Credit against ${inv.ref}`, creditFor: inv.id, allocations: [], lines: inv.lines.map(l => Object.assign(clone(l), { id: uid() })) }); }
    });
  });
}

// ---------- payments ----------
function paymentSheet(doc, bankLine) {
  const st = E.docStatus(S, doc, today()); const sales = doc.type === 'invoice';
  const amt = bankLine ? Math.abs(E.P(bankLine.amount)) : st.due;
  const sh = openSheet({ title: `Record ${sales ? 'payment received' : 'payment made'}`, size: 'narrow',
    body: `<p class="muted" style="margin:0">${esc(doc.ref || '')} · ${esc(contactName(doc.contactId))} · ${money(st.due)} outstanding</p>
    <div class="grid cols-2">${field('Amount', inp('amount', (amt / 100).toFixed(2), 'number', 'step="0.01"'))}${field('Date', inp('date', bankLine ? bankLine.date : today(), 'date'))}${field('Paid into', sel('bankAccount', accountOptions('1200', a => a.type === 'bank')))}${field('Reference', inp('ref', bankLine ? bankLine.reference : doc.ref))}</div>`,
    foot: `<button class="btn" data-p="cancel">Cancel</button><button class="btn primary" data-p="ok">Save payment</button>` });
  sh.querySelector('[data-p="cancel"]').onclick = closeSheet;
  sh.querySelector('[data-p="ok"]').onclick = () => run(async () => {
    const f = readForm(sh); const a = E.r2(f.amount);
    if (!(a > 0)) throw new Error('Enter an amount above zero.');
    if (E.P(a) > st.due + 1) throw new Error(`That is more than the ${money(st.due)} outstanding.`);
    const p = { id: uid(), type: sales ? 'customer_payment' : 'supplier_payment', date: f.date, contactId: doc.contactId, amount: a, bankAccount: f.bankAccount, ref: f.ref, description: `Payment ${doc.ref || ''}`.trim(), division: doc.division, allocations: [{ txnId: doc.id, amount: a }], status: 'approved', bankLineId: bankLine ? bankLine.id : null };
    await persist('txns', p, 'Payment saved');
    if (bankLine) { bankLine.status = 'reconciled'; bankLine.txnId = p.id; await store.save('bankLines', bankLine); }
    closeSheet(); render();
  });
}
function paymentView(t) {
  const docs = (t.allocations || []).map(a => ({ a, d: (S.txns || []).find(x => x.id === a.txnId) }));
  const sh = openSheet({ title: t.type === 'customer_payment' ? 'Payment received' : t.type === 'supplier_payment' ? 'Payment made' : 'Transfer', size: 'narrow', noFocus: true,
    body: `<dl class="kv"><dt>Date</dt><dd>${fdate(t.date)}</dd><dt>Amount</dt><dd>${money(E.P(t.amount))}</dd><dt>Contact</dt><dd>${esc(contactName(t.contactId))}</dd><dt>Account</dt><dd>${esc(acctLabel(t.bankAccount || '1200'))}</dd><dt>Reference</dt><dd>${esc(t.ref || '')}</dd>
      <dt>Allocated to</dt><dd>${docs.map(x => `${esc(x.d ? x.d.ref || 'document' : 'removed document')} · ${money(E.P(x.a.amount))}`).join('<br>') || '—'}</dd></dl>`,
    foot: can.edit() && !lockedDate(t.date) ? `<button class="btn danger" data-p="del">Delete payment</button><button class="btn" data-p="close">Close</button>` : `<button class="btn" data-p="close">Close</button>` });
  sh.querySelector('[data-p="close"]').onclick = closeSheet;
  const del = sh.querySelector('[data-p="del"]');
  if (del) del.onclick = () => run(async () => { if (!await confirmSheet('Delete payment', 'Delete this payment? The invoice or bill goes back to outstanding and the bank line back to the reconcile list.', 'Delete', true)) return; await removeRec('txns', t.id, 'Payment deleted'); if (t.bankLineId) await unlinkBankLine(t.bankLineId); closeSheet(); render(); });
}

// ---------- journals ----------
function journalEditor(existing) {
  const j = existing ? clone(existing) : { id: uid(), type: 'journal', date: today(), ref: '', description: '', status: 'approved', lines: [{ account: '', description: '', division: null, debit: 0, credit: 0 }, { account: '', description: '', division: null, debit: 0, credit: 0 }] };
  const readOnly = !can.journal() || lockedDate(j.date) || j.type === 'payroll' || (existing && !can.edit() && existing.createdBy !== store.user.email);
  const body = () => { const dr = j.lines.reduce((s, l) => s + E.P(l.debit), 0), cr = j.lines.reduce((s, l) => s + E.P(l.credit), 0);
    return `${j.type === 'payroll' ? callout('', 'Posted from a pay run. Change it on the Payroll page.') : ''}${lockedDate(j.date) ? callout('warn', 'Inside the locked period. Read only.') : ''}
    <div class="grid cols-3">${field('Date', inp('date', j.date, 'date', readOnly ? 'readonly' : ''))}${field('Reference', inp('ref', j.ref, 'text', readOnly ? 'readonly' : ''))}${field('Narrative', inp('description', j.description, 'text', readOnly ? 'readonly' : ''))}</div>
    <div class="lines"><div class="line j head"><span>Account</span><span>Description</span><span>Division</span><span>Debit</span><span>Credit</span><span></span></div>
    ${j.lines.map((l, i) => `<div class="line j"><select class="input" data-j="account" data-i="${i}" aria-label="Account" ${readOnly ? 'disabled' : ''}><option value="">Choose…</option>${accountOptions(l.account)}</select><input class="input" data-j="description" data-i="${i}" value="${esc(l.description || '')}" aria-label="Line description" ${readOnly ? 'readonly' : ''}><select class="input" data-j="division" data-i="${i}" aria-label="Division" ${readOnly ? 'disabled' : ''}>${divOptions(l.division)}</select><input class="input num" type="number" step="0.01" data-j="debit" data-i="${i}" value="${+l.debit || ''}" aria-label="Debit" ${readOnly ? 'readonly' : ''}><input class="input num" type="number" step="0.01" data-j="credit" data-i="${i}" value="${+l.credit || ''}" aria-label="Credit" ${readOnly ? 'readonly' : ''}>${readOnly ? '<span></span>' : `<button class="btn sm plain" data-jrm="${i}" aria-label="Remove line">${ico('x')}</button>`}</div>`).join('')}
    ${readOnly ? '' : `<div><button class="btn sm tinted" data-jadd="1">${ico('plus')} Add line</button></div>`}</div>
    <div class="totals"><div><span class="muted">Debits</span><span>${money(dr)}</span></div><div><span class="muted">Credits</span><span>${money(cr)}</span></div><div class="grand"><span>Difference</span><span class="${dr !== cr ? 'neg' : ''}">${money(dr - cr)}</span></div></div>`; };
  const sh = openSheet({ title: existing ? `${j.type === 'payroll' ? 'Payroll journal' : 'Journal'} ${j.ref || ''}` : 'New journal', size: 'wide', sticky: !readOnly, body: `<div id="jb">${body()}</div>`,
    foot: readOnly ? `<button class="btn" data-jx="close">Close</button>` : `${existing ? `<button class="btn danger" data-jx="delete">Delete</button>` : ''}<button class="btn" data-jx="close">Cancel</button><button class="btn primary" data-jx="save">Post journal</button>` });
  const re = () => keepFocus(sh, () => { $('#jb', sh).innerHTML = body(); });
  sh.addEventListener('change', (e) => { const el = e.target; if (el.dataset.j) { const l = j.lines[+el.dataset.i]; l[el.dataset.j] = ['debit', 'credit'].includes(el.dataset.j) ? E.r2(+el.value || 0) : (el.value || null); if (el.dataset.j === 'debit' && l.debit) l.credit = 0; if (el.dataset.j === 'credit' && l.credit) l.debit = 0; re(); } else if (el.dataset.k) { j[el.dataset.k] = el.value; if (el.dataset.k === 'date') re(); } });
  sh.addEventListener('click', (e) => {
    if (e.target.closest('[data-jadd]')) { j.lines.push({ account: '', description: '', division: null, debit: 0, credit: 0 }); re(); return; }
    const rm = e.target.closest('[data-jrm]'); if (rm) { j.lines.splice(+rm.dataset.jrm, 1); re(); return; }
    const x = e.target.closest('[data-jx]'); if (!x) return;
    run(async () => {
      if (x.dataset.jx === 'close') return closeSheet();
      if (x.dataset.jx === 'delete') { if (!await confirmSheet('Delete journal', 'Delete this journal?', 'Delete', true)) return; await removeRec('txns', j.id, 'Journal deleted'); closeSheet(); render(); return; }
      j.lines = j.lines.filter(l => l.account && (E.P(l.debit) || E.P(l.credit)));
      const dr = j.lines.reduce((s, l) => s + E.P(l.debit), 0), cr = j.lines.reduce((s, l) => s + E.P(l.credit), 0);
      if (j.lines.length < 2) throw new Error('A journal needs at least two lines.');
      if (dr !== cr) throw new Error(`Debits and credits differ by ${money(dr - cr)}.`);
      if (!j.description) throw new Error('Add a narrative so the entry explains itself.');
      await persist('txns', j, 'Journal posted'); closeSheet(); render();
    });
  });
}
ACT.newJournal = () => journalEditor(null);

// ---------- bank reconciliation ----------
async function postFromBank(bl, opts) {
  const amt = E.P(bl.amount); const type = amt > 0 ? 'receipt' : 'spend';
  const active = vatOn(bl.date); const code = active ? (opts.vatCode || 'NR') : 'NR';
  const c = E.calcLine(Math.abs(amt) / 100, code, true);
  const t = { id: uid(), type, date: bl.date, contactId: opts.contactId || null, description: opts.description || `${bl.counterparty} ${bl.reference || ''}`.trim(), division: opts.division || null, jobCode: opts.jobCode || null,
    bankAccount: bl.account || '1200', status: 'approved', inclusive: true, bankLineId: bl.id,
    lines: [{ id: uid(), description: opts.description || bl.reference || bl.counterparty, account: opts.account, vatCode: code, net: c.net, vat: c.vat, amount: Math.abs(amt) / 100, division: opts.division || null, jobCode: opts.jobCode || null }] };
  await persist('txns', t);
  bl.status = 'reconciled'; bl.txnId = t.id; await store.save('bankLines', bl);
  return t;
}
async function acceptSuggestion(bl) {
  const sg = suggestFor(bl); if (!sg) return false;
  if (lockedDate(bl.date)) throw new Error(`${fdate(bl.date)} is in the locked period.`);
  if (sg.kind === 'match') {
    const doc = sg.doc; const a = Math.abs(E.P(bl.amount)) / 100;
    const p = { id: uid(), type: doc.type === 'invoice' ? 'customer_payment' : 'supplier_payment', date: bl.date, contactId: doc.contactId, amount: a, bankAccount: bl.account || '1200', ref: bl.reference || doc.ref, description: `Payment ${doc.ref || ''}`.trim(), division: doc.division, allocations: [{ txnId: doc.id, amount: a }], status: 'approved', bankLineId: bl.id };
    await persist('txns', p); bl.status = 'reconciled'; bl.txnId = p.id; await store.save('bankLines', bl);
  } else {
    const r = sg.rule; await postFromBank(bl, { account: r.account, vatCode: r.vatCode, division: r.division, contactId: r.contactId, jobCode: r.jobCode });
  }
  return true;
}
ACT.acceptLine = async (el) => { const bl = S.bankLines.find(b => b.id === el.dataset.id); if (await acceptSuggestion(bl)) { toast('Reconciled'); render(); } };
ACT.acceptAll = async () => { let n = 0; for (const bl of S.bankLines.filter(b => b.status === 'unreconciled')) { if (suggestFor(bl) && !lockedDate(bl.date)) { await acceptSuggestion(bl); n++; } } toast(`${plural(n, 'line')} reconciled`); render(); };
ACT.excludeLine = async (el) => { const bl = S.bankLines.find(b => b.id === el.dataset.id); if (!await confirmSheet('Exclude bank line', `Exclude ${esc(bl.counterparty)} ${money(E.P(bl.amount))} from reconciliation? Use this only for duplicates or lines that never cleared.`, 'Exclude')) return; bl.status = 'excluded'; await store.save('bankLines', bl); toast('Excluded'); render(); };
ACT.codeLine = (el) => {
  const bl = S.bankLines.find(b => b.id === el.dataset.id); const amt = E.P(bl.amount); const sg = suggestFor(bl); const r = sg && sg.kind === 'rule' ? sg.rule : {};
  const sales = amt > 0; const defAcc = r.account || (sales ? '4000' : '5000');
  const sh = openSheet({ title: `${sales ? 'Money in' : 'Money out'} · ${money(amt)}`, size: 'narrow',
    body: `<p class="muted" style="margin:0">${fdate(bl.date)} · ${esc(bl.counterparty)} · ${esc(bl.reference || '')}</p>
    <div class="grid cols-2">${field('Account', sel('account', accountOptions(defAcc)), 2)}${field('VAT code', sel('vatCode', vatOptions(vatOn(bl.date) ? (r.vatCode || (ACC()[defAcc] || {}).vatDefault || 'S20') : 'NR'), vatOn(bl.date) ? '' : 'disabled'))}${field('Division', sel('division', divOptions(r.division || incomeDivision(defAcc))))}
    ${field(sales ? 'Customer' : 'Supplier', sel('contactId', contactOptions(r.contactId, sales ? 'customer' : 'supplier')))}${field('Job code', sel('jobCode', jobOptions(r.jobCode)))}${field('Description', inp('description', `${bl.counterparty} ${bl.reference || ''}`.trim()), 2)}
    ${can.edit() ? `<div style="grid-column:1/-1">${chk('makeRule', false, `Always code ${bl.counterparty} like this`)}</div>` : ''}</div>`,
    foot: `<button class="btn" data-c="x">Cancel</button><button class="btn primary" data-c="ok">Reconcile</button>` });
  sh.querySelector('[data-k="account"]').addEventListener('change', (e) => { const a = ACC()[e.target.value]; if (a && vatOn(bl.date)) $('[data-k="vatCode"]', sh).value = a.vatDefault || 'S20'; const d = incomeDivision(e.target.value); if (d) $('[data-k="division"]', sh).value = d; });
  sh.querySelector('[data-c="x"]').onclick = closeSheet;
  sh.querySelector('[data-c="ok"]').onclick = () => run(async () => {
    const f = readForm(sh); if (lockedDate(bl.date)) throw new Error('That date is in the locked period.');
    await postFromBank(bl, f);
    if (f.makeRule) await store.save('rules', { id: uid(), match: (bl.counterparty || '').toUpperCase(), direction: sales ? 'in' : 'out', action: 'code', account: f.account, vatCode: f.vatCode, division: f.division || null, contactId: f.contactId || null });
    closeSheet(); toast('Reconciled'); render();
  });
};
ACT.matchLine = (el) => {
  const bl = S.bankLines.find(b => b.id === el.dataset.id); const amt = E.P(bl.amount);
  const docs = (S.txns || []).filter(x => (amt > 0 ? x.type === 'invoice' : x.type === 'bill') && E.POSTED(x)).map(x => ({ x, st: E.docStatus(S, x, today()) })).filter(d => d.st.due > 0).sort((a, b) => Math.abs(a.st.due - Math.abs(amt)) - Math.abs(b.st.due - Math.abs(amt)));
  const sh = openSheet({ title: `Match ${money(amt)} to ${amt > 0 ? 'an invoice' : 'a bill'}`, size: 'narrow', noFocus: true,
    body: docs.length ? `<div class="panel"><div class="list">${docs.slice(0, 30).map(d => `<button class="list-row" data-m="${d.x.id}"><span class="grow"><span class="title">${esc(d.x.ref || '')} · ${esc(contactName(d.x.contactId))}</span><span class="meta">${fdate(d.x.date)} · ${divName(d.x.division)}</span></span><span class="num">${money(d.st.due)}</span>${d.st.due === Math.abs(amt) ? '<span class="pill good">Exact</span>' : ''}</button>`).join('')}</div></div>` : emptyState('Nothing open', `No ${amt > 0 ? 'invoices' : 'bills'} are waiting for payment.`) });
  sh.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b) return; const doc = S.txns.find(x => x.id === b.dataset.m); closeSheet(); paymentSheet(doc, bl); });
};
ACT.syncBank = async () => {
  if (store.mode === 'demo') { S.lastSync = nowIso(); toast('Bank feed is up to date'); render(); return; }
  const from = E.addDays(today(), -45); const res = await store.starling(S.company.incorporated && S.company.incorporated > from ? S.company.incorporated : from, today());
  const have = new Set((S.bankLines || []).map(b => b.id)); let n = 0;
  for (const tx of (res.transactions || [])) {
    if (!tx.feedItemUid || have.has(tx.feedItemUid)) continue;
    if (S.company.incorporated && tx.date < S.company.incorporated) continue;
    await store.save('bankLines', { id: tx.feedItemUid, account: '1200', date: tx.date, amount: E.r2(tx.amount), counterparty: tx.counterParty, reference: tx.reference, category: tx.starlingCat || '', status: 'unreconciled', txnId: null }); n++;
  }
  if (res.balance != null) S.starlingBalance = res.balance;
  S.lastSync = nowIso(); toast(n ? `${plural(n, 'new bank line')}` : 'Bank feed is up to date'); render();
};
