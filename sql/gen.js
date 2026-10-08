const E = require('../src/engine.js');
const q = (s) => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const j = (o) => q(JSON.stringify(o)) + '::jsonb';
const accounts = E.DEFAULT_ACCOUNTS.map(a => `  (${q(a.code)}, ${q(a.type)}, false, ${j(a)})`).join(',\n');
const company = { entityType: 'sole_trader', name: "Digby's Events & Catering", tradingName: "Digby's", ownerName: 'James Brierley', booksStart: '2026-04-06',
  registeredIn: 'England and Wales', yearEnd: '04-05', associatedCompanies: 0,
  vatRegistered: false, vatScheme: 'standard', vatStagger: 1, flatRate: 12.5, invoicePrefix: 'INV-', nextInvoiceNo: 188, paymentTerms: 30,
  email: 'james@digbysevents.co.uk', bankName: 'Starling Bank', bankAccountName: 'James Brierley',
  directors: [{ name: 'James Brierley', share: 100, dla: '2300' }] };
const rules = [
  { id: 'rule-produce-warriors', match: 'PRODUCE WARRIORS', direction: 'out', action: 'code', account: '5000', vatCode: 'Z0', division: 'events' },
  { id: 'rule-booker', match: 'BOOKER', direction: 'out', action: 'code', account: '5000', vatCode: 'Z0', division: null },
  { id: 'rule-oxhay', match: 'OXHAY', direction: 'out', action: 'code', account: '5010', vatCode: 'Z0', division: 'butchery' },
  { id: 'rule-plato', match: 'PLATO', direction: 'out', action: 'code', account: '5030', vatCode: 'S20', division: 'events' },
  { id: 'rule-brierley', match: 'BRIERLEY J', direction: 'any', action: 'code', account: '2300', vatCode: 'OS', division: null },
  { id: 'rule-james-brierley', match: 'JAMES BRIERLEY', direction: 'any', action: 'code', account: '2300', vatCode: 'OS', division: null },
  { id: 'rule-jeffries-in', match: 'JEFFRIES', direction: 'in', action: 'code', account: '2301', vatCode: 'OS', division: null },
  { id: 'rule-hmrc-out', match: 'HMRC', direction: 'out', action: 'code', account: '2210', vatCode: 'OS', division: null }
];
const tpl = require('fs').readFileSync(__dirname + '/schema.template.sql', 'utf8');
process.stdout.write(tpl.replace('/*ACCOUNTS*/', accounts).replace('/*COMPANY*/', j(company)).replace('/*RULES*/', rules.map(r => `  (${q(r.id)}, ${q(r.match)}, ${j(r)})`).join(',\n')));
