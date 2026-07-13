-- Mirrors the existing one_active_partner_a/b pattern on relationships:
-- a user can own at most one active room at a time. To open a new one
-- they close their current room first (sets is_active = false), which
-- the client now exposes as a "Close" button on your own room.
create unique index one_active_room_per_owner on rooms (owner_id) where is_active;
