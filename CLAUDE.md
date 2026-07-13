# CLAUDE.md — Mingle

Read this fully before writing any code. These rules exist because breaking them costs real money or puts real people at risk.

---

## What we're building

**Mingle** — a pixel-avatar social hangout app. Voice rooms with mic seats, text chat, gifting, cosmetics, and relationship rings. Filipino market, mobile-first, **web app** (not native — audio was tested and survives a locked Android screen).

Positioning is **hangout-first, dating-adjacent**. People come to hang out; relationships happen. We never market it as a dating app.

---

## Stack — do not add to this

| Layer | Tool |
|---|---|
| App | React + TypeScript + Vite + Tailwind + Zustand |
| Avatar canvas | Phaser 3 (room only — nothing else) |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) |
| Voice | LiveKit (Singapore region) |
| Hosting | Cloudflare Pages |

**Explicitly rejected — do not introduce:** Node/Express, Socket.IO, Redis, Railway, Prisma, Next.js, Firebase, any state library other than Zustand, any CSS framework other than Tailwind.

Supabase Realtime handles presence and chat. If you think we need a second realtime system, you're wrong — say why and stop.

---

## 🔴 THE FIVE RULES. NEVER BREAK THESE.

**1. The client NEVER writes to `wallets`.**
There is no INSERT/UPDATE policy on that table and there never will be. Money moves ONLY through the `send_gift()`, `buy_cosmetic()`, and `equip()` RPCs. If a feature seems to need client-side wallet writes, the feature is wrong — not the rule.

**2. Never weaken RLS or drop a constraint to make something work.**
If a query fails because of RLS, the fix is a correct RPC — never `disable row level security`, never a permissive `using (true)` on a write policy. The `adults_only` constraint and the `premium_slots_are_gems_only` constraint are load-bearing. Do not touch them.

**3. Free coins can NEVER buy premium slots.**
`frame`, `entrance`, `wings`, `aura`, `pet` are gems-only. This is enforced by a DB constraint. It exists because if free users can get status items, paying users stop paying. Don't route around it.

**4. Mic permission is granted in the LiveKit token, not the UI.**
The Edge Function checks `room_members.seat_index` and only sets `canPublish` if the user is seated and unmuted. Never grant `canPublish: true` unconditionally. Hiding the mic button in the UI is not security.

**5. Every gift must be seen by the whole room, in real time.**
Gifting is not a transaction — it's the product. A gift with no room-wide animation is a broken feature. Same for the supporter board: purchases must be *visible to other people* or nobody buys anything.

---

## Schema (already deployed — do not recreate)

`app_config` · `profiles` · `rooms` · `room_members` · `room_messages` · `dm_threads` · `dm_messages` · `blocks` · `reports` · `wallets` · `transactions` · `cosmetic_items` · `user_inventory` · `gift_catalog` · `gifts_sent` · `relationships`

RPCs: `send_gift()` · `buy_cosmetic()` · `equip()`
View: `room_supporters`

**Schema changes require explicit approval.** Propose the migration, explain why, wait.

---

## Key design notes

- **Cosmetics are data.** New items = INSERT into `cosmetic_items` + upload a PNG. Never hardcode an item in the app.
- **Avatar compositor:** `profiles.equipped` (jsonb) → composite the layers to ONE offscreen canvas → cache as a single Phaser texture, keyed by a hash of equipped IDs. A room of 30 people must be 30 sprites, not 300 layers. Cheap Android phones are the target.
- **`hides_slots`:** a hat declares `hides_slots: ['hair_front']`. Never special-case hat/hair conflicts in code.
- **Rooms have slugs** (`/r/night-owls`). Shareable URLs are our main growth mechanic — never break them.
- **DM approach cost lives in `app_config`**, currently `0`. It's a dial we may turn later. Never hardcode it.

---

## How to work with me (the owner)

I direct, I don't hand-write code. So:

- **Vertical slices only.** One small thing, working end-to-end, testable on my phone. Never "build all the schema, then all the UI."
- **Edit files directly.** Never hand me code to paste — that's how files got corrupted on my last project.
- **After each change, tell me exactly what to test and what I should see.**
- **Never make more than one feature's worth of changes at a time.**
- If I ask for something that breaks a rule above, **say so and stop.** Don't quietly comply.

---

## Build order (do not skip ahead)

1. **Auth** — email + Google, username claim, birthdate (18+ is a DB constraint)
2. **Room** — LiveKit mic seats + Supabase chat. **Placeholder circles, no pixel art.** Stop when two phones can talk.
3. **Avatars** — compositor + wardrobe
4. **Gifts** — `send_gift()` → room-wide animation → supporter board
5. **Discovery + DMs** — open browse, free approach, Requests bucket
6. **Rings + CP leaderboard**
7. **Safety** — report, block, owner mute/kick
8. Launch

**Not in v1, do not build:** gems, Play Billing, My Room/furniture, mini-games, friends graph, seasons, VIP, feeds, images in DMs, voice messages.

---

## Safety is not a later feature

This app has money, strangers, and a real risk of minors. Report, block, owner mute/kick, and the age gate ship **before** any public launch — not after.
