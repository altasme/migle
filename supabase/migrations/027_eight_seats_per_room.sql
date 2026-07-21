-- Hangout rooms are fixed at 8 mic seats. No client UI has ever set
-- max_seats (createHangout doesn't pass it, relies entirely on whatever
-- the column's default was), so this just makes 8 the one and only value.
update rooms set max_seats = 8 where max_seats <> 8;

alter table rooms
  alter column max_seats set default 8;

alter table rooms
  add constraint max_seats_is_eight check (max_seats = 8);
