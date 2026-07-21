-- owner_pass_mic (023) assigned a seat directly with no consent from the
-- invited person. Replaced with a client-side invite/accept flow over
-- realtime broadcast (no DB write needed for the invite itself - the
-- invited user takes their own seat via the existing self-service path
-- once they accept, same RLS as any other self-seating). Drop the
-- now-unused function.
drop function if exists owner_pass_mic(uuid, uuid);
