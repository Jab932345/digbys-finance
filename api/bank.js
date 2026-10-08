// Vercel serverless function: Starling Bank proxy for Digby's & Co Limited.
// Keeps the token on the server. Set STARLING_TOKEN in Vercel → Settings → Environment Variables.
// The token must belong to the company's own Starling business account, with these scopes:
// account:read, account-list:read, balance:read, transaction:read.
//
// GET /api/bank?from=YYYY-MM-DD&to=YYYY-MM-DD
// → { accountName, currency, balance, clearedBalance, fromDate, toDate, count, transactions: [...] }
// Only settled transactions are returned, so the feed reconciles to the cleared balance.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ error: 'Use GET' }); return; }

  const token = process.env.STARLING_TOKEN;
  if (!token) { res.status(500).json({ error: 'STARLING_TOKEN is not set in Vercel' }); return; }

  // Only people signed in to the books, and listed in co_users, may read the bank feed
  const SUPA_URL = process.env.SUPABASE_URL || 'https://jaajrllkozknilvmdezt.supabase.co';
  const SUPA_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphYWpybGxrb3prbmlsdm1kZXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjQxNDAsImV4cCI6MjA5MjYwMDE0MH0.09U5cba3JxRmysrn2X3TxPqr-q6jJE4QhyeKQwEK03M';
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) { res.status(401).json({ error: 'Sign in to read the bank feed' }); return; }
  const who = await fetch(`${SUPA_URL}/auth/v1/user`, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${bearer}` } });
  if (!who.ok) { res.status(401).json({ error: 'Your session has expired. Sign in again.' }); return; }
  const user = await who.json();
  const member = await fetch(`${SUPA_URL}/rest/v1/co_users?select=role&email=eq.${encodeURIComponent((user.email || '').toLowerCase())}`, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${bearer}` } });
  const rows = member.ok ? await member.json() : [];
  if (!rows.length) { res.status(403).json({ error: 'This account does not have access to the books' }); return; }

  const api = async (path) => {
    const r = await fetch('https://api.starlingbank.com/api/v2' + path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!r.ok) { const detail = await r.text(); const e = new Error(`Starling ${r.status} on ${path.split('?')[0]}`); e.status = r.status; e.detail = detail; throw e; }
    return r.json();
  };
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

  try {
    const { accounts } = await api('/accounts');
    const account = (accounts || []).find(a => a.accountType === 'PRIMARY') || (accounts || [])[0];
    if (!account) { res.status(404).json({ error: 'No Starling account found for this token' }); return; }

    const today = new Date().toISOString().slice(0, 10);
    const from = isDate(req.query.from) ? req.query.from : new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    const to = isDate(req.query.to) ? req.query.to : today;
    const min = new Date(from + 'T00:00:00Z').toISOString();
    const max = new Date(to + 'T23:59:59.999Z').toISOString();

    const [feed, bal] = await Promise.all([
      api(`/feed/account/${account.accountUid}/category/${account.defaultCategory}/transactions-between?minTransactionTimestamp=${encodeURIComponent(min)}&maxTransactionTimestamp=${encodeURIComponent(max)}`),
      api(`/accounts/${account.accountUid}/balance`)
    ]);

    const transactions = (feed.feedItems || [])
      .filter(i => i.status === 'SETTLED')
      .map(i => ({
        feedItemUid: i.feedItemUid,
        date: (i.transactionTime || i.settlementTime || '').slice(0, 10),
        counterParty: i.counterPartyName || '',
        reference: i.reference || '',
        txType: i.source || '',
        amount: (i.direction === 'IN' ? 1 : -1) * (i.amount?.minorUnits || 0) / 100,
        starlingCat: i.spendingCategory || ''
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const minor = (x) => (x && typeof x.minorUnits === 'number') ? x.minorUnits / 100 : null;
    res.status(200).json({
      accountName: account.name || 'Starling business account',
      currency: account.currency || 'GBP',
      balance: minor(bal.clearedBalance) ?? minor(bal.totalClearedBalance),
      effectiveBalance: minor(bal.effectiveBalance),
      fromDate: from, toDate: to, count: transactions.length, transactions
    });
  } catch (e) {
    res.status(e.status && e.status < 500 ? 502 : 500).json({ error: e.message, detail: e.detail ? String(e.detail).slice(0, 500) : undefined });
  }
}
