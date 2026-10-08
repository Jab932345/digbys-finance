/* ============================================================
   Data layer. Two adapters, one interface:
   - LiveStore: Supabase (login-gated, row level security, server audit)
   - DemoStore: in-memory fictional company, kept in this browser only
   ============================================================ */
(function (root) {
  'use strict';

  // entity -> table, primary key, and the indexed columns kept beside the JSON document
  const ENTITIES = {
    accounts:    { table: 'co_accounts',     key: 'code',  cols: o => ({ type: o.type, archived: !!o.archived }) },
    contacts:    { table: 'co_contacts',     key: 'id',    cols: o => ({ kind: o.kind, name: o.name }) },
    jobCodes:    { table: 'co_job_codes',    key: 'code',  cols: o => ({ division: o.division || null, event_date: o.eventDate || null }) },
    txns:        { table: 'co_txns',         key: 'id',    cols: o => ({ type: o.type, date: o.date, status: o.status || 'approved' }) },
    bankLines:   { table: 'co_bank_lines',   key: 'id',    cols: o => ({ date: o.date, status: o.status, amount: o.amount }) },
    staff:       { table: 'co_staff',        key: 'id',    cols: o => ({ name: o.name, active: o.active !== false }) },
    payrollRuns: { table: 'co_payroll_runs', key: 'id',    cols: o => ({ pay_date: o.payDate, status: o.status }) },
    mileage:     { table: 'co_mileage',      key: 'id',    cols: o => ({ date: o.date, driver: o.driver || null }) },
    vatReturns:  { table: 'co_vat_returns',  key: 'id',    cols: o => ({ period_from: o.from, period_to: o.to, status: o.status }) },
    rules:       { table: 'co_bank_rules',   key: 'id',    cols: o => ({ match: o.match }) },
    users:       { table: 'co_users',        key: 'email', cols: o => ({ name: o.name || null, role: o.role }) }
  };
  const uuid = () => (root.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  // ---------------- Demo ----------------
  function DemoStore() {
    const KEY = 'digbys-co-demo-v1';
    let state = null;
    const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: demo still works for this visit */ } };
    return {
      mode: 'demo',
      user: { email: 'james@digbysevents.co.uk', name: 'James Brierley', role: 'owner' },
      async init() { return true; },
      async load() {
        try { const raw = localStorage.getItem(KEY); if (raw) state = JSON.parse(raw); } catch (e) { state = null; }
        if (!state) state = root.DemoSeed();
        return state;
      },
      async save(entity, obj) {
        const cfg = ENTITIES[entity]; const k = cfg ? cfg.key : 'id';
        if (!obj[k]) obj[k] = uuid();
        const arr = state[entity] = state[entity] || [];
        const i = arr.findIndex(x => x[k] === obj[k]);
        const before = i >= 0 ? arr[i] : null;
        if (i >= 0) arr[i] = obj; else arr.push(obj);
        this.audit(before ? 'update' : 'create', entity, obj[k], summarise(entity, obj), before, obj);
        persist(); return obj;
      },
      async saveCompany(company) { const before = state.company; state.company = company; this.audit('update', 'company', 'company', 'Company settings updated', before, company); persist(); return company; },
      async remove(entity, idv) {
        const cfg = ENTITIES[entity]; const k = cfg ? cfg.key : 'id';
        const arr = state[entity] || []; const i = arr.findIndex(x => x[k] === idv);
        if (i >= 0) { const before = arr[i]; arr.splice(i, 1); this.audit('delete', entity, idv, summarise(entity, before), before, null); }
        persist();
      },
      audit(action, entity, entityId, summary, before, after) {
        state.audit = state.audit || [];
        state.audit.push({ id: uuid(), ts: new Date().toISOString(), user: this.user.email, action, entity, entityId, summary, before: before || null, after: after || null });
      },
      async saveMany(entity, objs) { for (const o of objs) await this.save(entity, o); },
      reset() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } state = null; },
      async starling() {
        // The demo feed returns the bank lines already in the data set
        return { balance: state.starlingBalance, transactions: [] };
      },
      setRole(role, email, name) { this.user = { role, email, name }; }
    };
  }

  function summarise(entity, o) {
    if (!o) return entity;
    if (entity === 'txns') return `${o.type.replace('_', ' ')} ${o.ref || ''} ${o.description || ''}`.replace(/\s+/g, ' ').trim();
    return `${entity} ${o.name || o.code || o.ref || o.id || ''}`.trim();
  }

  // ---------------- Live (Supabase) ----------------
  function LiveStore(cfg) {
    const sb = root.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    let state = null;
    const store = {
      mode: 'live', sb, user: null,
      async session() { const { data } = await sb.auth.getSession(); return data.session; },
      async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
      async sendLink(email) { const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false } }); if (error) throw error; },
      async signOut() { await sb.auth.signOut(); location.reload(); },
      async init() {
        const s = await this.session();
        if (!s) return false;
        const email = (s.user.email || '').toLowerCase();
        const { data, error } = await sb.from('co_users').select('email,data,role,name').eq('email', email).maybeSingle();
        if (error) {
          const code = error.code || '', msg = error.message || '';
          const missing = code === 'PGRST205' || code === '42P01' || /could not find the table|does not exist/i.test(msg);
          const denied = code === '42501' || /permission denied/i.test(msg);
          if (missing || denied) { const e = new Error(msg || code); e.setup = missing ? 'missing' : 'grants'; e.detail = `${code} ${msg}`.trim(); throw e; }
          throw new Error(msg || String(error));
        }
        if (!data) throw new Error(`${email} is signed in but has not been given access. Ask the account owner to add this email under Settings → Users.`);
        this.user = { email, name: data.name || (data.data || {}).name || email, role: data.role };
        return true;
      },
      async load() {
        const read = async (table, order) => {
          const all = []; let from = 0; const size = 1000;
          for (;;) {
            let q = sb.from(table).select('*').range(from, from + size - 1);
            if (order) q = q.order(order, { ascending: true });
            const { data, error } = await q;
            if (error) throw new Error(`${table}: ${error.message}`);
            all.push(...data); if (data.length < size) break; from += size;
          }
          return all;
        };
        const names = Object.keys(ENTITIES);
        const results = await Promise.all(names.map(n => read(ENTITIES[n].table)));
        state = {};
        names.forEach((n, i) => { state[n] = results[i].map(r => Object.assign({}, r.data || {}, { [ENTITIES[n].key]: r[ENTITIES[n].key] })); });
        const settings = await read('co_settings');
        state.company = ((settings.find(r => r.id === 'company') || {}).data) || {};
        const { data: aud } = await sb.from('co_audit').select('*').order('ts', { ascending: false }).limit(1000);
        state.audit = (aud || []).map(a => ({ id: a.id, ts: a.ts, user: a.user_email, action: a.action, entity: a.entity, entityId: a.entity_id, summary: a.summary, before: a.before, after: a.after }));
        if (!state.accounts.length) state.accounts = root.Engine.DEFAULT_ACCOUNTS.map(a => Object.assign({}, a));
        // Read-only links into the rest of the Digby's system, all in the same database.
        // Old finance app categories become coding hints; CPS job codes appear in every job picker.
        // Some of these tables are readable with the public key but not granted to signed-in users, so fall back to it
        let anonSb = null;
        const tryRead = async (client, table, cols) => { try { const { data, error } = await client.from(table).select(cols || '*').limit(5000); return error ? null : (data || []); } catch (e) { return null; } };
        const opt = async (table, cols) => {
          const r = await tryRead(sb, table, cols); if (r) return r;
          anonSb = anonSb || root.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'digbys-public' } });
          return (await tryRead(anonSb, table, cols)) || [];
        };
        const [li, le, cj] = await Promise.all([opt('finance_income', 'date,amount,stream,description'), opt('finance_expenses', 'date,amount,category,description'), opt('job_codes')]);
        state.legacy = li.map(r => ({ date: r.date, amount: +r.amount, category: r.stream, desc: r.description }))
          .concat(le.map(r => ({ date: r.date, amount: -Math.abs(+r.amount), category: r.category, desc: r.description })));
        const have = new Set(state.jobCodes.map(j => j.code));
        cj.forEach(r => {
          const code = String(r.code || r.job_code || r.name || '').trim(); if (!code || have.has(code)) return;
          have.add(code);
          state.jobCodes.push({ code, name: r.name && r.name !== code ? r.name : (r.description || r.client || r.client_name || code), division: r.division || 'events', eventDate: (r.event_date || r.date || '').slice(0, 10) || null, source: 'cps' });
        });
        return state;
      },
      async save(entity, obj) {
        const c = ENTITIES[entity];
        if (!obj[c.key]) obj[c.key] = uuid();
        const row = Object.assign({ [c.key]: obj[c.key], data: obj, updated_by: this.user.email, updated_at: new Date().toISOString() }, c.cols(obj));
        const { error } = await sb.from(c.table).upsert(row, { onConflict: c.key });
        if (error) throw new Error(friendly(error));
        const arr = state[entity] = state[entity] || [];
        const i = arr.findIndex(x => x[c.key] === obj[c.key]);
        if (i >= 0) arr[i] = obj; else arr.push(obj);
        return obj;
      },
      async saveCompany(company) {
        const { error } = await sb.from('co_settings').upsert({ id: 'company', data: company, updated_by: this.user.email, updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw new Error(friendly(error));
        state.company = company; return company;
      },
      async saveMany(entity, objs) {
        if (!objs.length) return;
        const c = ENTITIES[entity]; const now = new Date().toISOString();
        const rows = objs.map(obj => { if (!obj[c.key]) obj[c.key] = uuid(); return Object.assign({ [c.key]: obj[c.key], data: obj, updated_by: this.user.email, updated_at: now }, c.cols(obj)); });
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await sb.from(c.table).upsert(rows.slice(i, i + 200), { onConflict: c.key });
          if (error) throw new Error(friendly(error));
        }
        const arr = state[entity] = state[entity] || [];
        objs.forEach(o => { const i = arr.findIndex(x => x[c.key] === o[c.key]); if (i >= 0) arr[i] = o; else arr.push(o); });
      },
      async remove(entity, idv) {
        const c = ENTITIES[entity];
        const { error } = await sb.from(c.table).delete().eq(c.key, idv);
        if (error) throw new Error(friendly(error));
        state[entity] = (state[entity] || []).filter(x => x[c.key] !== idv);
      },
      audit() { /* written by database triggers in live mode */ },
      async starling(from, to) {
        const { data } = await sb.auth.getSession();
        const r = await fetch(`/api/bank?from=${from}&to=${to}`, { headers: { Authorization: 'Bearer ' + ((data.session || {}).access_token || '') } });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `Bank feed returned ${r.status}`);
        return body;
      }
    };
    return store;
  }

  function friendly(error) {
    const m = error.message || String(error);
    if (/locked period/i.test(m)) return 'That date is inside a locked period. Ask your accountant to move the lock date if it needs changing.';
    if (/row-level security|permission denied/i.test(m)) return 'Your role does not allow this change.';
    return m;
  }

  root.Stores = { DemoStore, LiveStore, ENTITIES, uuid };
})(typeof window !== 'undefined' ? window : globalThis);
