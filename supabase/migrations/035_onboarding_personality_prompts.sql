-- Expanded onboarding: personality traits (choose up to 3) and "question
-- card" prompt answers (choose 3 prompts, write a short answer to each)
-- replace a free-text bio as the fun, low-effort way to fill out a profile.
-- No array-length CHECK here, same as interests (012) - enforced client-side
-- only, consistent with how that column already works.
alter table profiles
  add column if not exists personality_traits text[] not null default '{}',
  add column if not exists prompt_answers jsonb not null default '[]';
