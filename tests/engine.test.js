const E = require('../src/engine.js');
const Seed = require('../src/seed.js');
const s = Seed('2026-10-08');
const fmt = p => (p/100).toFixed(2);
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
console.log('txns', s.txns.length, 'bank', s.bankLines.length, 'jobs', s.jobCodes.length);
const tb = E.trialBalance(s, {});
ok(tb.balanced, `TB balanced ${fmt(tb.totals.debit)} = ${fmt(tb.totals.credit)}`);
let unb = 0; s.txns.forEach(t => { const ps = E.postings(t); const d = ps.reduce((a,p)=>a+p.debit,0), c = ps.reduce((a,p)=>a+p.credit,0); if (d!==c) { unb++; console.log(' unbalanced', t.type, t.ref, d, c); } });
ok(unb === 0, 'every transaction balances');
const bs = E.balanceSheet(s, { at: '2026-10-08' });
ok(bs.balanced, `BS balanced net assets ${fmt(bs.totals.netAssets)} equity ${fmt(bs.totals.equity)}`);
const p = E.pnl(s, { from: '2026-04-01', to: '2027-03-31' });
console.log('Income', fmt(p.totals.income.total), 'GP', fmt(p.totals.grossProfit.total), 'NP', fmt(p.totals.netProfit.total));
E.DIV_IDS.concat('none').forEach(d => console.log('  ', d, 'inc', fmt(p.totals.income.cols[d]), 'np', fmt(p.totals.netProfit.cols[d])));
const per = E.vatPeriods(s.company, '2026-12-31'); console.log('VAT periods', per.map(x=>x.from+'..'+x.to+' due '+x.due).join(' | '));
per.forEach(pp => { const r = E.vatReturn(s, pp); console.log('  boxes', pp.to, Object.entries(r.boxes).map(([k,v])=>k+':'+fmt(v)).join(' ')); });
// VAT control: after Q1 journal, 2200+2201 balance at 30 Jun should be zero
const tbq = E.trialBalance(s, { to: '2026-06-30' });
const vb = tbq.rows.filter(r => ['2200','2201'].includes(r.code)).reduce((a,r)=>a+r.balance,0);
ok(vb === 0, 'VAT control cleared at Q1 end ('+fmt(vb)+')');
// Q2 box 5 equals 2200+2201 movement Jul–Sep
const q2 = E.vatReturn(s, per[1]); const led = E.ledger(s, { from: per[1].from, to: per[1].to }).filter(x=>['2200','2201'].includes(x.account)).reduce((a,x)=>a+x.credit-x.debit,0);
ok(q2.boxes[5] === led, `Q2 box 5 ${fmt(q2.boxes[5])} matches VAT accounts ${fmt(led)}`);
const bank = E.trialBalance(s, {}).rows.find(r=>r.code==='1200');
const recon = s.bankLines.filter(b=>b.status==='reconciled').reduce((a,b)=>a+E.P(b.amount),0);
ok(bank.balance === recon, `ledger bank ${fmt(bank.balance)} equals reconciled feed ${fmt(recon)}`);
const ag = E.aged(s, { at: '2026-10-08', kind: 'debtors' }); console.log('Debtors', fmt(ag.totals.total), ag.rows.length, 'customers');
const ct = E.ctEstimate(s, E.companyYear(s.company, '2026-10-08')); console.log('CT', JSON.stringify(ct));
const dl = E.dla(s, '2300'); console.log('DLA James', fmt(dl.balance));
const m = E.mileageClaims(s, 2026); console.log('Mileage', m.map(x=>x.driver+' '+x.miles+'mi £'+fmt(x.claim)).join(', '));
const pe = E.payrollEstimate(1600, 'monthly', '1257L'); console.log('payroll 1600/m', JSON.stringify(pe));
const pe2 = E.payrollEstimate(300, 'weekly', '1257L'); console.log('payroll 300/w', JSON.stringify(pe2));
const hc = E.healthChecks(s, '2026-10-08'); console.log('health', hc.issues.map(i=>i.level+': '+i.text).join(' | '));
const rt = E.rollingTurnover(s, '2026-10-08'); console.log('rolling turnover', fmt(rt.total));
// flat rate + cash scheme sanity
const sc = JSON.parse(JSON.stringify(s)); sc.company.vatScheme='cash'; const qc = E.vatReturn(sc, per[1]); console.log('cash scheme Q2', Object.entries(qc.boxes).map(([k,v])=>k+':'+fmt(v)).join(' '));
const sf = JSON.parse(JSON.stringify(s)); sf.company.vatScheme='flat'; const qf = E.vatReturn(sf, per[1]); console.log('flat Q2', Object.entries(qf.boxes).map(([k,v])=>k+':'+fmt(v)).join(' '), qf.frs);
console.log(fails ? fails+' FAILED' : 'ALL PASS');
