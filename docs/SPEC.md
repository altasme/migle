# Mingle — As-Built Spec

What's actually implemented, as of 2026-07-27. CLAUDE.md is the product
vision and the rules; this doc is the current state of the build against
it. Update this alongside significant feature work — don't let it go
stale the way the old README pointer to "the full spec" did.

═══════════════════════════════════════════════════════════
SHIPPED & WORKING
═══════════════════════════════════════════════════════════

## Auth & onboarding
- Email + password signup via Supabase Auth, 18+ age gate enforced by a
  DB constraint on `profiles.birthdate`.
- Google and Discord OAuth are also wired and live (`src/lib/googleAuth.ts`,
  `src/lib/discordAuth.ts`, `OAuthRow.tsx`) — ahead of CLAUDE.md Part 4,
  which specs email-only at launch and Apple/Google added later.
- Onboarding flow (`src/components/onboarding/`): birthday → username →
  avatar → gender → bio → interests/personality chip-picker → prompts →
  visual tutorial → first VibeMatch. Broader than the minimal sequence in
  CLAUDE.md Part 4 (which explicitly cuts interests from launch); still
  being iterated on (see open tasks below).

## Pixel avatar
- Hair, eyes, skin, top, bottom, shoes, accessories.
- Avatar catalog gender-gated, 16 options per gender (`036`), with a
  guardrail trigger preventing mismatched gender/item combos (`038`).
- Canvas rendering via Phaser 3 (`src/lib/compositor.ts`, `AvatarImage.tsx`).

## VibeMatch (text + voice)
- `request_match()` RPC: atomic pairing within an advisory-locked queue,
  keyed by (region, mode). Same-pair re-match cooldown (30s). Blocked
  pairs excluded via `is_blocked_pair()`.
- Optional mutual gender/age preference filtering — matches only when
  each side satisfies the other's stated preference (`039`).
- Voice capped at 5 mingles/day per user, tracked on `profiles`;
  text is uncapped (LiveKit minutes cost money, Supabase Realtime chat
  doesn't).
- On-screen always: Add Friend, Next, Block, Report.
- Stale queue/session sweeping so abandoned entries don't wedge the
  queue (`028`–`030`).
- Text runs over a Supabase Realtime channel; voice runs over a LiveKit
  room per pair, token minted by an Edge Function that checks membership
  before granting `canPublish`.
- **Fixed 2026-07-27** (`043`): banned users could queue and text-chat
  because `request_match()` had silently forked into two overloaded
  signatures and the ban/limit checks lived only on the one the client
  no longer called. Consolidated back to one function; both checks
  restored.

## Friends
- Mutual add-friend from a match (`016`); friendship persists with full
  chat history carried over from the match conversation (`040`).
- Friend voice calls, friend chat threads.
- Block severs an existing friendship in both directions (`020`).

## Private hangouts
- Invite-only rooms, friends-only (`invite_friend_to_room` — never by
  username, never a stranger).
- Text + voice, up to 8 seats (`027`).
- Room mate role: owner can delegate limited permissions (mute/kick,
  watch-party control) to a trusted friend instead of only the owner
  holding them (`033`, `034`).
- Watch Party (shared YouTube playback, `src/lib/youtube.ts`) and Karaoke
  (`src/lib/karaokeScore.ts`, Jamendo-backed) both live inside hangouts,
  drivable by any member/room-mate, not just the owner.
- Hangout presence indicator + bio surfaced in-room (`032`).

## Safety & moderation
- Add Friend / Next / Block / Report always on-screen during a match.
- Reports logged with session id, partner id, timestamp (`AdminReports.tsx`,
  migration `011`).
- Blocks permanent, enforced in the match queue and in room membership.
- `ban_user()` RPC sets `profiles.is_banned`; enforced in matching as of
  `043` (previously text-mode only enforced pre-`039`, see above).
- Owner/room-mate mute and kick inside hangouts (`008`, `033`).

## Coins & cosmetics (economy)
- Wallet, gift-sending (`send_gift`, `007`), and relationship/ring
  proposal RPCs (`006`) exist and work end-to-end.
- Entire economy UI is currently hidden behind `ECONOMY_ENABLED = false`
  in `src/lib/featureFlags.ts` — an explicit, reversible product call to
  focus the UI on the core meet-people loop first. Backend is untouched
  and ready to flip back on.
- **Not yet built:** `buy_cosmetic()` and `equip()` RPCs referenced in
  CLAUDE.md's Five Rules don't exist yet — `Wardrobe.tsx` is a
  "coming soon" stub. Coin-earning triggers for daily login and
  mutual-friend-add are not yet wired to a coins balance either.

## Regional matching
- `profiles.region` (default `GLOBAL`) and `app_config.allow_cross_region_match`
  (`false`) are live and enforced in `request_match()` (`014`, `015`).
- **Not yet built:** nothing sets `region = 'PH'` on signup — no +63
  phone or PH-IP detection exists yet, so everyone currently lands in
  `GLOBAL`. The bucketing plumbing works; the signal to bucket by
  doesn't exist.

## Push notifications
- DM messages, new friendships, and room invites trigger push (`041`).
- A 7-day re-engagement campaign (morning + evening, capped at 2/day)
  (`042`), plus a fix for foreground pushes silently not displaying on
  Android.

═══════════════════════════════════════════════════════════
LEFTOVER FROM THE PRE-CLAUDE.MD ROOMS-ERA PRODUCT
═══════════════════════════════════════════════════════════

Still present in the codebase and reachable by direct URL, though removed
from bottom nav. Not deleted, not audited for RLS coverage in every case.
CLAUDE.md Part 5 explicitly defers these past V1 — flagging here so they
don't get rediscovered as a surprise:

- `/rooms` (`Rooms.tsx`) — public room browser/discovery.
- `/discover` (`Discover.tsx`) — profile grid with stranger DM/follow.
- `FollowList.tsx`, `DmThread.tsx` — follows and stranger DMs
  (`approach_user` RPC, `005`).
- Relationship "rings"/CP mechanic (`006`, `007`) — flagged off with the
  rest of the economy.

═══════════════════════════════════════════════════════════
IN PROGRESS
═══════════════════════════════════════════════════════════

- Onboarding upgrades: gender picker, required picks, bio step, copy
  fixes, visual tutorial polish.
- Broader onboarding expansion: avatar, interests, personality, prompts,
  tutorial sequencing.

═══════════════════════════════════════════════════════════
TECHNICAL REFERENCE
═══════════════════════════════════════════════════════════

- Stack: React + TypeScript + Vite + Tailwind + Zustand, Phaser 3 (avatar
  canvas only), Supabase (Postgres/Auth/Realtime/Storage), LiveKit
  (Singapore, voice), Cloudflare Pages. See CLAUDE.md Part 8 for what's
  explicitly rejected.
- 43 tracked migrations as of this doc (`supabase/migrations/001`–`043`).
- Core RPCs: `request_match`, `end_match`, `like_match_partner`,
  `mark_match_ready`, `invite_friend_to_room`, `open_friend_chat`,
  `approach_user`, `propose_relationship` / `respond_relationship` /
  `end_relationship`, `send_gift`, `ban_user`, `owner_mute_member`,
  `owner_kick_member`, `set_room_mate`, `start_watch_party` /
  `stop_watch_party` / `sync_watch_party_position`, `notify_push` and its
  triggers, `run_promo_push_sweep`.
- Five Rules (CLAUDE.md Part 7) status: #1 (wallet writes RPC-only) held —
  no client wallet writes found. #2 (never weaken RLS) — base `profiles`
  RLS predates tracked migrations and wasn't re-verified in this pass.
  #3 (gems-only premium slots) — enforced by DB constraint, not
  reachable from UI yet since Wardrobe is a stub. #4 (mic permission via
  LiveKit token) — held, Edge Function gates `canPublish`. #5 (gifts
  witnessed in real time) — `send_gift` exists but the whole feature is
  behind `ECONOMY_ENABLED`, so it's unverified against a live gift
  animation.
