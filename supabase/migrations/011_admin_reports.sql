-- Minimal admin role: one flag, used only to gate reading/resolving
-- reports. Not a general permissions system — just enough to have a
-- single moderator role for now.
alter table profiles add column if not exists is_admin boolean not null default false;

drop policy if exists read_own_reports on reports;
create policy read_own_reports on reports for select
  using (
    reporter_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and is_admin)
  );

create policy admin_update_reports on reports for update
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));
