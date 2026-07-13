-- Adds the missing INSERT policy on profiles so a signed-in user can create
-- their own profile row during the username-claim step. Scoped identically
-- to the existing edit_own_profile UPDATE policy — a user can only ever
-- insert a row whose id matches their own auth uid. The adults_only and
-- username-length constraints still apply and still block bad inserts.
create policy create_own_profile on profiles for insert
  with check (id = auth.uid());
