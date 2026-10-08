-- =====================================================================
-- Digby's & Co Limited — company books
-- Supabase project jaajrllkozknilvmdezt. Paste into SQL Editor and run.
-- The books run as the sole trader from 6 April 2026; switch to the limited company in Settings on incorporation.
-- Safe to run again: it only adds what is missing.
--
-- What this sets up
--   * co_* tables for the limited company (the sole-trader finance_* tables are left untouched)
--   * sign-in required: only emails listed in co_users can read or write
--   * roles: owner, director, bookkeeper, accountant
--   * period lock enforced by the database, not just the screen
--   * audit trail written by triggers; nobody can edit or delete it
-- =====================================================================

-- ---------- tables ----------
create table if not exists co_users        (email text primary key, name text, role text not null check (role in ('owner','director','bookkeeper','accountant')), data jsonb not null default '{}'::jsonb, updated_by text, updated_at timestamptz default now());
create table if not exists co_settings     (id text primary key, data jsonb not null default '{}'::jsonb, updated_by text, updated_at timestamptz default now());
create table if not exists co_accounts     (code text primary key, type text not null, archived boolean not null default false, data jsonb not null, updated_by text, updated_at timestamptz default now());
create table if not exists co_contacts     (id text primary key, kind text, name text, data jsonb not null, updated_by text, updated_at timestamptz default now());
create table if not exists co_job_codes    (code text primary key, division text, event_date date, data jsonb not null, updated_by text, updated_at timestamptz default now());
create table if not exists co_txns         (id text primary key, type text not null, date date not null, status text not null default 'approved', data jsonb not null, updated_by text, updated_at timestamptz default now());
create table if not exists co_bank_lines   (id text primary key, date date not null, status text not null default 'unreconciled', amount numeric(14,2), data jsonb not null, updated_by text, updated_at timestamptz default now());
create table if not exists co_staff        (id text primary key, name text, active boolean not null default true, data jsonb not null, updated_by text, updated_at timestamptz default now());
create table if not exists co_payroll_runs (id text primary key, pay_date date, status text, data jsonb not null, updated_by text, updated_at timestamptz default now());
create table if not exists co_mileage      (id text primary key, date date, driver text, data jsonb not null, updated_by text, updated_at timestamptz default now());
create table if not exists co_vat_returns  (id text primary key, period_from date, period_to date, status text, data jsonb not null, updated_by text, updated_at timestamptz default now());
create table if not exists co_bank_rules   (id text primary key, match text, data jsonb not null, updated_by text, updated_at timestamptz default now());
create table if not exists co_audit        (id bigint generated always as identity primary key, ts timestamptz not null default now(), user_email text, action text not null, entity text not null, entity_id text, summary text, before jsonb, after jsonb);

create index if not exists co_txns_date_idx on co_txns (date);
create index if not exists co_txns_type_idx on co_txns (type);
create index if not exists co_bank_lines_status_idx on co_bank_lines (status);
create index if not exists co_audit_ts_idx on co_audit (ts desc);

-- ---------- helpers ----------
create or replace function co_role() returns text
language sql stable security definer set search_path = public as $$
  select role from co_users where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function co_lock_date() returns date
language sql stable security definer set search_path = public as $$
  select nullif(data ->> 'lockDate', '')::date from co_settings where id = 'company'
$$;

-- ---------- period lock ----------
create or replace function co_enforce_lock() returns trigger
language plpgsql security definer set search_path = public as $$
declare lk date := co_lock_date();
begin
  if lk is not null then
    if tg_op in ('UPDATE', 'DELETE') and old.date <= lk then
      raise exception 'Locked period: % is on or before the lock date %', old.date, lk;
    end if;
    if tg_op in ('INSERT', 'UPDATE') and new.date <= lk then
      raise exception 'Locked period: % is on or before the lock date %', new.date, lk;
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists co_txns_lock on co_txns;
create trigger co_txns_lock before insert or update or delete on co_txns for each row execute function co_enforce_lock();

-- only the owner or the accountant may move the lock date
create or replace function co_guard_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id = 'company'
     and coalesce(new.data ->> 'lockDate', '') is distinct from coalesce(old.data ->> 'lockDate', '')
     and coalesce(co_role(), '') not in ('owner', 'accountant') then
    raise exception 'Only the owner or the accountant can change the lock date';
  end if;
  return new;
end $$;
drop trigger if exists co_settings_guard on co_settings;
create trigger co_settings_guard before update on co_settings for each row execute function co_guard_settings();

-- ---------- audit trail ----------
create or replace function co_audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
begin
  insert into co_audit (user_email, action, entity, entity_id, summary, before, after)
  values (
    lower(coalesce(auth.jwt() ->> 'email', 'system')),
    case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end,
    tg_table_name,
    coalesce(r ->> 'id', r ->> 'code', r ->> 'email'),
    nullif(concat_ws(' ', r ->> 'type', r -> 'data' ->> 'ref', r -> 'data' ->> 'description', r -> 'data' ->> 'name'), ''),
    o -> 'data',
    n -> 'data'
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['co_users','co_settings','co_accounts','co_contacts','co_job_codes','co_txns','co_bank_lines','co_staff','co_payroll_runs','co_mileage','co_vat_returns','co_bank_rules'] loop
    execute format('drop trigger if exists %I on %I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function co_audit_row()', t || '_audit', t);
  end loop;
end $$;

-- ---------- row level security ----------
do $$
declare t text;
begin
  foreach t in array array['co_users','co_settings','co_accounts','co_contacts','co_job_codes','co_txns','co_bank_lines','co_staff','co_payroll_runs','co_mileage','co_vat_returns','co_bank_rules','co_audit'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('drop policy if exists co_read on %I', t);
    execute format('drop policy if exists co_write on %I', t);
  end loop;
end $$;

-- reading: any listed person, except staff records and the audit trail
create policy co_read on co_users        for select to authenticated using (co_role() is not null);
create policy co_read on co_settings     for select to authenticated using (co_role() is not null);
create policy co_read on co_accounts     for select to authenticated using (co_role() is not null);
create policy co_read on co_contacts     for select to authenticated using (co_role() is not null);
create policy co_read on co_job_codes    for select to authenticated using (co_role() is not null);
create policy co_read on co_txns         for select to authenticated using (co_role() is not null);
create policy co_read on co_bank_lines   for select to authenticated using (co_role() is not null);
create policy co_read on co_mileage      for select to authenticated using (co_role() is not null);
create policy co_read on co_vat_returns  for select to authenticated using (co_role() is not null);
create policy co_read on co_bank_rules   for select to authenticated using (co_role() is not null);
create policy co_read on co_payroll_runs for select to authenticated using (co_role() is not null);
create policy co_read on co_staff        for select to authenticated using (co_role() in ('owner','director','accountant'));
create policy co_read on co_audit        for select to authenticated using (co_role() in ('owner','director','accountant'));

-- writing
create policy co_write on co_users        for all to authenticated using (co_role() = 'owner') with check (co_role() = 'owner');
create policy co_write on co_settings     for all to authenticated using (co_role() is not null) with check (co_role() is not null);
create policy co_write on co_accounts     for all to authenticated using (co_role() in ('owner','director','bookkeeper')) with check (co_role() in ('owner','director','bookkeeper'));
create policy co_write on co_contacts     for all to authenticated using (co_role() in ('owner','director','bookkeeper')) with check (co_role() in ('owner','director','bookkeeper'));
create policy co_write on co_job_codes    for all to authenticated using (co_role() in ('owner','director','bookkeeper')) with check (co_role() in ('owner','director','bookkeeper'));
create policy co_write on co_bank_lines   for all to authenticated using (co_role() in ('owner','director','bookkeeper')) with check (co_role() in ('owner','director','bookkeeper'));
create policy co_write on co_mileage      for all to authenticated using (co_role() in ('owner','director','bookkeeper')) with check (co_role() in ('owner','director','bookkeeper'));
create policy co_write on co_bank_rules   for all to authenticated using (co_role() in ('owner','director','bookkeeper')) with check (co_role() in ('owner','director','bookkeeper'));
create policy co_write on co_staff        for all to authenticated using (co_role() in ('owner','director')) with check (co_role() in ('owner','director'));
create policy co_write on co_payroll_runs for all to authenticated using (co_role() in ('owner','director')) with check (co_role() in ('owner','director'));
create policy co_write on co_vat_returns  for all to authenticated using (co_role() in ('owner','director','accountant')) with check (co_role() in ('owner','director','accountant'));
-- the accountant may add and change journals only; everyone else with write access may post anything
create policy co_write on co_txns for all to authenticated
  using (co_role() in ('owner','director','bookkeeper') or (co_role() = 'accountant' and type = 'journal'))
  with check (co_role() in ('owner','director','bookkeeper') or (co_role() = 'accountant' and type = 'journal'));
-- co_audit has no write policy: only the trigger above can add to it
revoke insert, update, delete, truncate on co_audit from anon, authenticated;

-- ---------- starting data ----------
insert into co_users (email, name, role) values ('james@digbysevents.co.uk', 'James Brierley', 'owner') on conflict (email) do nothing;

insert into co_settings (id, data) values ('company', /*COMPANY*/) on conflict (id) do nothing;

insert into co_accounts (code, type, archived, data) values
/*ACCOUNTS*/
on conflict (code) do nothing;

insert into co_bank_rules (id, match, data) values
/*RULES*/
on conflict (id) do nothing;

-- carry staff records and job codes over from the sole-trader tables, if they exist
do $$
begin
  begin
  if to_regclass('public.finance_staff') is not null then
    insert into co_staff (id, name, active, data)
    select id::text, name, coalesce(active, true), jsonb_strip_nulls(jsonb_build_object(
      'id', id::text, 'name', name, 'dob', dob, 'niNumber', ni_number, 'start', employment_start, 'address', address, 'email', email, 'phone', phone,
      'bankSort', bank_sort_code, 'bankAccount', bank_account, 'bankName', bank_name, 'payRate', pay_rate,
      'payFrequency', case when pay_frequency ilike 'week%' then 'weekly' else 'monthly' end, 'taxCode', coalesce(tax_code, '1257L'),
      'rtwDoc', rtw_doc_type, 'rtwDate', rtw_check_date, 'emergencyName', emergency_contact_name, 'emergencyRel', emergency_contact_relation,
      'emergencyPhone', emergency_contact_phone, 'emergency2Name', emergency_contact_2_name, 'emergency2Phone', emergency_contact_2_phone,
      'allergies', allergies, 'dietary', dietary_requirements, 'medical', medical_notes, 'foodHygiene', food_hygiene_level,
      'foodHygieneExpiry', food_hygiene_expiry, 'firstAid', first_aid_trained, 'firstAidExpiry', first_aid_expiry, 'driving', driving_licence,
      'drivingCats', driving_licence_categories, 'uniform', uniform_size, 'notes', notes, 'active', coalesce(active, true), 'rolledUpHoliday', true))
    from finance_staff
    on conflict (id) do nothing;
  end if;
  exception when others then raise notice 'Staff not copied (%): add them in the app instead', sqlerrm;
  end;
  begin
  if to_regclass('public.finance_job_codes') is not null then
    insert into co_job_codes (code, division, event_date, data)
    select code, 'events', event_date, jsonb_strip_nulls(jsonb_build_object('code', code, 'name', name, 'division', 'events', 'eventDate', event_date, 'notes', notes, 'status', 'booked'))
    from finance_job_codes
    on conflict (code) do nothing;
  end if;
  exception when others then raise notice 'Job codes not copied (%)', sqlerrm;
  end;
  begin
  if to_regclass('public.finance_mileage') is not null then
    insert into co_mileage (id, date, driver, data)
    select id::text, date, coalesce(driver, 'James Brierley'), jsonb_strip_nulls(jsonb_build_object('id', id::text, 'date', date, 'miles', miles, 'purpose', purpose,
      'driver', coalesce(nullif(driver, 'Manual'), 'James Brierley'), 'jobCode', job_code, 'passengers', 0, 'method', 'manual'))
    from finance_mileage where date >= '2026-04-06'
    on conflict (id) do nothing;
  end if;
  exception when others then raise notice 'Mileage not copied (%)', sqlerrm;
  end;
end $$;

-- Done. Next: Authentication → Providers → Email must be on.
-- Add your accountant: Settings → People with access in the app (owner only).
