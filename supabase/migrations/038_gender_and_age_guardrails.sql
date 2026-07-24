-- Age guardrail: reject anyone claiming to be 70+, mirroring the existing
-- adults_only (18+) check already enforced on this table. This is a new,
-- additive constraint only - adults_only is untouched.
-- NOT VALID: a plain ADD CONSTRAINT validates every existing row up front
-- and fails the whole migration if even one predates this rule (e.g. an
-- old test account). NOT VALID skips that retroactive check but still
-- applies in full to every signup and every future update from here on -
-- exactly the guardrail we want going forward, without needing to hunt
-- down and fix historical rows first.
alter table profiles drop constraint if exists profiles_max_age_check;
alter table profiles
  add constraint profiles_max_age_check check (birthdate > current_date - interval '70 years') not valid;

-- Gender is a one-time identity choice made in the avatar step (Male/Female
-- toggle), not just a UI filter - stored so it can be shown on the profile
-- and enforced server-side against whichever avatar look ends up equipped.
alter table profiles add column if not exists gender text;
alter table profiles drop constraint if exists profiles_gender_check;
alter table profiles
  add constraint profiles_gender_check check (gender is null or gender in ('male', 'female'));

-- Belt-and-suspenders: the client only ever offers looks matching the
-- chosen gender, but enforce it here too so a mismatch can't happen through
-- any other write path. Avatar look ids are prefixed av_male_/av_female_
-- (see 036) - anything not explicitly av_female_* counts as male, same
-- rule the client's genderOf() helper uses.
create or replace function enforce_avatar_gender() returns trigger
language plpgsql as $$
begin
  if new.gender = 'male' and (new.equipped->>'body') like 'av\_female\_%' escape '\' then
    raise exception 'Selected avatar does not match your gender.';
  end if;
  if new.gender = 'female' and (new.equipped->>'body') not like 'av\_female\_%' escape '\'
     and new.equipped ? 'body' then
    raise exception 'Selected avatar does not match your gender.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_avatar_gender on profiles;
create trigger profiles_enforce_avatar_gender
  before insert or update on profiles
  for each row execute function enforce_avatar_gender();
