# CLAUDE.md — Mingle (single source of truth)

Read this fully before writing any code. It is the product vision, the launch spec, and the engineering rules in one place. There is no other doc. The FIVE RULES are non-negotiable — breaking them costs real money or puts real people at risk.

═══════════════════════════════════════════════════════════
PART 1 — WHAT MINGLE IS
═══════════════════════════════════════════════════════════

Mingle is a **friendship-first social app where strangers become friends — and romance is allowed to happen.**

We do not market it as a dating app, but we design honestly: the app has gifting, relationship features, strangers, and a real risk of minors trying to get in. We build the safety for what it actually is, not for the marketing line.

**Core promise:** "Meet someone in seconds. Keep the connection if it matters."

**North-star metric:** Friendships Created Per Day. Not downloads, not MAU, not screen time. If strangers are becoming mutual friends, the product works. Everything is measured against this.

If a feature doesn't help users *meet people, build friendships, strengthen them, or spend more time together* — it doesn't belong in early versions.

═══════════════════════════════════════════════════════════
PART 2 — THE CORE LOOP
═══════════════════════════════════════════════════════════

Open → VibeMatch → meet a stranger (text or voice) → become friends (both accept) → create a private hangout → invite friends → repeat.

That is the entire product. Everything else is secondary.

Why this shape: a public room needs ~10 people to feel alive. A 1:1 match needs only ONE other person online. We launch with the mechanic that works with a tiny user base and grow into rooms later.

═══════════════════════════════════════════════════════════
PART 3 — TWO LAUNCH CONSTRAINTS WE DO NOT GET TO IGNORE
═══════════════════════════════════════════════════════════

These are named here so they never get "postponed" into launch by accident.

**A. The gender ratio.** Random voice with strangers skews male fast. A woman's second-night experience decides whether she ever comes back, and once a pool tips heavily male it does not recover. Friendship framing helps lower the temperature, but every design choice must ask: does this make it safer/better for the underrepresented side? Instant block/next and a real report pipeline are part of this, not separate from it.

**B. Moderation is the license to operate.** Omegle died from unmoderatable random matching — and Omegle is our cautionary tale, not our model. Report/Block are not just buttons; what happens AFTER a tap matters. At launch that means: reports are logged with session id + partner id + timestamp, blocks are permanent and enforced in matching, and repeat-reported accounts can be banned (profiles.is_banned). We launch regional (see Part 6) specifically so moderation stays inside a language/culture we can handle.

═══════════════════════════════════════════════════════════
PART 4 — MVP (build ONLY this)
═══════════════════════════════════════════════════════════

1. **Auth** — Email + username + 18+ age gate (a DB constraint, already live).
   Google/Apple login: NOT at launch. Add before public launch. Email only for now.

2. **Pixel avatar** — hair, eyes, skin, top, bottom, shoes, accessories. Basic.

3. **VibeMatch (the hero feature)** — pick Text or Voice → instantly matched with someone in the same region. On-screen ALWAYS: Add Friend · Next · Block · Report.

4. **Friends** — when BOTH accept: persistent friendship, chat history, voice calls, hangout invites.

5. **Private Hangouts** — invite-only, FRIENDS ONLY, text + voice. You may only invite an existing friend. Never invite by username, never a stranger. No public discovery.

6. **Coins** — earned from daily login and, importantly, from the **mutual friend-add** (the outcome we want). Do NOT reward coins per conversation or per "next" — that incentivises spamming through humans to farm coins and poisons the north-star. Coins buy cosmetics and gifts.

**Onboarding ends in a conversation, not a dashboard:**
Splash → Login → Birthday → Username → Avatar → Start Your First VibeMatch.
(Interests: cut from launch onboarding. Matching is regional, not interest-based, so interests would collect data that does nothing yet. Add later only if it actually filters matches.)

═══════════════════════════════════════════════════════════
PART 5 — DO NOT BUILD YET
═══════════════════════════════════════════════════════════

Public rooms · discovery feed · room browser/search · communities · gems · Play Billing · premium/VIP · stories · livestreams · image sharing · voice notes · mini-games · public profiles · apartments/furniture · pets · marketplace · DMs to strangers.

If unsure whether something belongs, ask: "Does this help strangers become friends *at launch scale*?" If no, postpone.

═══════════════════════════════════════════════════════════
PART 6 — REGIONAL MATCHING
═══════════════════════════════════════════════════════════

Global listing, regional matching. Anyone can download (keeps the monetization ceiling); matching pools by region (protects moderation + the 3am pool).

- profiles.region text not null default 'GLOBAL'. Set 'PH' when signup detects +63 phone or PH IP. Treat IP as a correctable guess, never gospel.
- Start with only two buckets: PH and GLOBAL. Split further only when a bucket is big enough to stand alone.
- app_config.allow_cross_region_match = 'false'. Queue matches WITHIN region unless true. Ship OFF, no UI toggle yet — plumbing in now, switch stays dark until we have volume and a moderation answer for cross-language.
- region is a MATCHING BUCKET ONLY. Never expose another user's region/location anywhere in the UI. This keeps us clear of location-based stalking.

═══════════════════════════════════════════════════════════
PART 7 — 🔴 THE FIVE RULES. NEVER BREAK THESE.
═══════════════════════════════════════════════════════════

**1. The client NEVER writes to wallets.** No INSERT/UPDATE policy on that table, ever. Money moves ONLY through the send_gift(), buy_cosmetic(), equip() RPCs. If a feature seems to need client-side wallet writes, the feature is wrong.

**2. Never weaken RLS or drop a constraint to make something work.** A failing query is fixed with a correct RPC — never disable row level security, never a permissive write policy. The adults_only and premium_slots_are_gems_only constraints are load-bearing.

**3. Free coins can NEVER buy premium slots.** frame, entrance, wings, aura, pet are gems-only, enforced by DB constraint. If free users can get status items, paying users stop paying.

**4. Mic permission is granted in the LiveKit token, not the UI.** The Edge Function checks membership and only sets canPublish for a valid, unmuted participant. Never grant canPublish: true unconditionally. Hiding a button is not security.

**5. Every gift must be seen by the other person in real time** (the whole room, in a room; the partner, in a match/DM). A gift with no visible animation is a broken feature. Purchases must be witnessed or nobody buys.

═══════════════════════════════════════════════════════════
PART 8 — STACK (do not add to this)
═══════════════════════════════════════════════════════════

React + TypeScript + Vite + Tailwind + Zustand · Phaser 3 (avatar canvas only) · Supabase (Postgres, Auth, Realtime, Storage) · LiveKit (Singapore region, voice) · Cloudflare Pages.

**Rejected — do not introduce:** Node/Express, Socket.IO, Redis, Railway, Prisma, Next.js, Firebase, any other state or CSS library. Supabase Realtime handles presence + chat. Text matches use a Supabase Realtime channel (no LiveKit, no minutes cost); voice matches use a LiveKit room per pair.

═══════════════════════════════════════════════════════════
PART 9 — THE MATCH QUEUE (build SLOWLY — the one tricky piece)
═══════════════════════════════════════════════════════════

- Waiting user enters a queue keyed by (region, mode) where mode = text|voice.
- Pair two waiting users in the same bucket; both leave the queue ATOMICALLY. Two users must never each get paired to a third (no double-pairing under race).
- NEVER pair users who have blocked each other (either direction).
- Avoid immediately re-pairing the same two on consecutive "next" (short cooldown).
- "Next"/"skip": tear down the session cleanly; both re-enter the queue.
- No partner available → waiting state ("Looking for someone…"), NEVER an error, NEVER "no match found".
- Report captures session id + partner id + timestamp.
- The queue lives behind an RPC / Edge Function. The client asks to be matched and subscribes for a result — the client NEVER picks its own partner.

═══════════════════════════════════════════════════════════
PART 10 — HOW WE WORK
═══════════════════════════════════════════════════════════

- I (the owner) direct; I don't hand-write code. Edit files directly — never hand me code to paste (that corrupted my last project).
- **Vertical slices only.** One small thing, working end-to-end, testable on my phone. Never "all the schema, then all the UI."
- After each change: tell me exactly what to test and what I should see.
- One feature's worth of change at a time.
- If I ask for something that breaks a rule here, SAY SO AND STOP. Don't quietly comply.
- Schema changes require explicit approval: propose the migration, explain why, wait.

═══════════════════════════════════════════════════════════
PART 11 — BUILD ORDER (do not skip ahead)
═══════════════════════════════════════════════════════════

1. Migration: region column + allow_cross_region_match flag. Propose SQL, wait for OK.
2. **Text** VibeMatch first (cheaper, moderatable, no LiveKit). Two phones matched + chatting, with working Next / Block / Report.
3. Voice VibeMatch (LiveKit room per pair).
4. Add-friend after a match (both accept).
5. Private hangouts (friends-only invite).
6. Gifting inside match + hangout.
7. Safety pass: confirm block enforced in queue, reports logged, ban path works.
8. Cosmetics/wardrobe polish → launch into one region, one time-window, one push.

Test every step with TWO phones before moving on. Never build step N+1 until step N works on real devices.

═══════════════════════════════════════════════════════════
PART 12 — EVOLUTION (never before V1 succeeds)
═══════════════════════════════════════════════════════════

V1 Meet someone (this doc) → V2 Strengthen friendships (gifts, streaks, better avatars, better hangouts) → V3 Communities (public rooms, clubs, events, discover) → V4 Social entertainment (karaoke, activities, mini-games, apartments, pets).

Never build V3 before V1 succeeds. Success = Friendships Created Per Day is real and growing.
