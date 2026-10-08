-- Digby's Accounts: let signed-in users reach the co_ tables (row level security still decides what each role sees)
grant usage on schema public to authenticated;
grant select, insert, update, delete on co_users, co_settings, co_accounts, co_contacts, co_job_codes, co_txns, co_bank_lines, co_staff, co_payroll_runs, co_mileage, co_vat_returns, co_bank_rules to authenticated;
grant select on co_audit to authenticated;
grant execute on function co_role(), co_lock_date() to authenticated;
