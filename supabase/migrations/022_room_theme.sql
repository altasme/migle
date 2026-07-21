-- Visual customization for hangouts. name/topic already existed on rooms;
-- this just adds a preset color theme, applied to the room header.
alter table rooms
  add column if not exists theme text not null default 'purple'
    check (theme in ('purple', 'pink', 'blue', 'green', 'orange'));
