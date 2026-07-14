-- gifts_sent had no RLS at all, so a client could insert a fake row
-- directly, bypassing send_gift() entirely — faking a spot on the
-- supporter board without actually paying. Mirrors the wallets pattern:
-- readable by anyone (the board is meant to be public), no write
-- policies, so every gift must go through the send_gift() RPC.
alter table gifts_sent enable row level security;

create policy read_gifts_sent on gifts_sent for select using (true);
