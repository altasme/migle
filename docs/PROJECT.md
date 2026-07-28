# Mingle

## What it is

Mingle is a mobile-first social app built on a simple bet: most people
don't want another feed to scroll or another profile to swipe — they
want to talk to somebody, right now, and see if it goes anywhere. Mingle
matches strangers into a live conversation (text or voice) in seconds,
and gives both people a clean way to turn a good conversation into a
lasting friendship.

We don't market it as a dating app. But we're not naive about it either:
the app has gifting, relationship features, real strangers, and a real
risk of romance happening alongside friendship. We design the safety
and moderation systems for what the app actually is, not for the
marketing copy on the store listing.

**The promise:** meet someone in seconds, keep the connection if it
matters.

**The metric that matters:** Friendships Created Per Day — not installs,
not daily actives, not minutes in-app. If two strangers are becoming
mutual friends, the product is working. Every feature decision gets
measured against whether it moves that number.

## The core loop

```
Open app
  → VibeMatch (pick text or voice)
  → instantly paired with a stranger in the same region
  → talk
  → both tap Add Friend
  → persistent friendship: chat history, voice calls, hangout invites
  → invite them (and other friends) into a private hangout
  → repeat
```

That's the whole product. Everything else — the avatar, the coins, the
cosmetics, the hangout activities — exists to make that loop feel good
and to give people a reason to come back to it.

The loop is shaped around one deliberate constraint: a public room needs
roughly ten simultaneous people to feel alive, but a 1:1 match only
needs one other person online at the same time as you. Early on, with a
small user base, that difference decides whether the app feels populated
or dead. Mingle launches on the mechanic that works at small scale
(1:1 matching) and grows into group spaces (public rooms, communities)
later, once there's enough volume to support them.

## Why the hard parts are hard

Two constraints shape almost every product decision in this app, and
they don't get to be postponed to "later" by accident:

**The gender ratio.** Random matching with strangers skews male fast,
and once a matching pool tips heavily male it tends not to recover on
its own. A woman's second night on the app decides whether she comes
back a third time. Friendship-first framing helps lower the temperature
of the interaction, but every design choice has to ask: does this make
the experience safer or better for whoever's on the underrepresented
side of the pool? Instant block/next and a report pipeline that actually
does something aren't bolted-on extras here — they're part of the core
matching design.

**Moderation is the license to operate.** Omegle — anonymous,
unmoderated random video chat — died because it never solved this. It's
Mingle's cautionary tale, not a model to follow. Report and Block have
to do something after the tap: reports are logged with enough context
to act on (session, partner, timestamp), blocks are permanent and
actually enforced in the matching queue (not just hidden in the UI),
and accounts with a pattern of reports can be banned outright. Launching
region-by-region (see below) is partly a moderation decision — it keeps
the userbase inside a language and culture the safety team can actually
review.

## What a new user experiences

Splash screen → email signup with an 18+ age check → pick a birthday and
username → build a pixel avatar (hair, eyes, skin, outfit, accessories)
→ straight into a first VibeMatch. Onboarding is designed to end in a
live conversation, not a dashboard — the fastest path to the thing that
actually hooks someone is getting them talking to a real person.

From there, the loop above takes over: match, maybe add a friend, maybe
get invited into a hangout, maybe start a private hangout of their own
and invite friends into it.

## Features, in more depth

**VibeMatch.** The hero feature. Choose text or voice, get matched
instantly with someone in the same regional pool. While matched,
Add Friend / Next / Block / Report are always visible — never buried in
a menu, never a second tap away. Text runs over a lightweight realtime
channel (cheap, easy to moderate, no per-minute cost); voice runs over a
dedicated call room per pair and is capped per day per user, since voice
minutes cost real money at scale. Matching itself never surfaces an
error to a waiting user — no partner available just means "looking for
someone…" for as long as it takes.

**Friends.** A friendship only exists when both people opt in — one
person adding the other isn't enough. Once mutual, it's persistent:
chat history carries over from the original match conversation, voice
calls are available any time, and either friend can invite the other
into a hangout.

**Private hangouts.** Small invite-only spaces for friends — never
discoverable, never joinable by a stranger, never invitable by typing in
a username. You can only bring people who are already your friends.
Inside a hangout: text and voice for the group, shared activities like
watch parties and karaoke, and the ability for an owner to delegate
limited host permissions to a trusted friend instead of being the only
person who can run things.

**Pixel avatar.** A lightweight customizable character — hair, eyes,
skin, top, bottom, shoes, accessories — that represents each user across
matches, friend lists, and hangouts. It's deliberately simple: enough
identity and personality to make someone recognizable and give them
something to express themselves with, without turning the app into an
avatar-customization game in its own right.

**Coins & cosmetics.** Coins are earned from daily login and — this is
the important one — from *mutual* friend-adds, not from chatting or
skipping through matches. That's a deliberate incentive design: rewarding
conversation volume would encourage people to burn through strangers to
farm currency, which actively works against the thing the app is trying
to produce (real friendships). Coins spend on cosmetics. A separate tier
of premium cosmetic slots (special frames, entrances, auras, and similar
status items) can only be bought with paid currency, never earned for
free — otherwise free users reach the same status as paying ones and the
paid tier stops being worth paying for.

**Regional matching.** Anyone, anywhere, can download and create an
account — that keeps the ceiling on how big the app can eventually get
uncapped. But who you get matched with is scoped to a region, because
moderation, safety norms, and language all get much harder to manage
once matching goes global on day one. Region is purely a backend
matching bucket: it's never shown to another user, and it's never used
to expose anyone's location. It exists to keep matching pools coherent
and moderation tractable, not as a location feature.

## Where the money is, and where it isn't

The economy exists to fund cosmetic self-expression and to reward the
outcome the product wants (friendships), not to gate the core
experience. Matching, chatting, calling, adding friends, and hosting
hangouts are all free. What costs money is looking distinctive while you
do it. This keeps the free experience genuinely good — which matters a
lot for a product that depends on both sides of a match wanting to be
there — while still giving people with money to spend a real place to
spend it.

## What Mingle deliberately isn't (yet)

Public rooms, a discovery feed, room browsing/search, communities,
livestreams, image sharing, voice notes, mini-games, public profiles,
a marketplace, DMs to strangers outside of a match — all real product
ideas, all explicitly out of scope for this stage. The test for whether
something belongs is narrow: does it help strangers become friends *at
launch scale*? If the answer is no, or "maybe, once we have volume," it
waits. Building a discovery feed for an app with a few hundred users
produces an empty, dead-feeling feed — worse than not having one.

## How the product evolves

1. **V1 — Meet someone** (this document, this build): VibeMatch, add
   friend, private hangouts, coins, basic avatar. Success is Friendships
   Created Per Day, real and growing.
2. **V2 — Strengthen friendships**: gifting, streaks, deeper avatars,
   richer hangouts.
3. **V3 — Communities**: public rooms, clubs, events, discovery.
4. **V4 — Social entertainment**: karaoke, shared activities,
   mini-games, apartments, pets.

Each stage only starts once the one before it has actually succeeded by
its own metric — V3's public rooms and discovery feed don't get built
just because V1 shipped; they get built once V1's north-star metric
proves the friendship loop works.

## Technical shape

React + TypeScript + Vite + Tailwind on the frontend, with Zustand for
state and Phaser 3 purely for rendering the avatar canvas. Supabase
provides Postgres, auth, realtime channels, and storage — it's the
backend, there's no separate application server. Voice calls run through
LiveKit (hosted in Singapore for the initial regional footprint).
Cloudflare Pages serves the built app. The stack is intentionally narrow
— no Node/Express API layer, no Socket.IO, no Redis, no separate ORM —
because a small team keeping the surface area small is a feature, not a
limitation, at this stage.

Money-moving operations (gifts, cosmetic purchases, equipping items) go
through database functions the client calls, never through direct writes
to balance tables — the client can ask the database to move money, it
can never move money itself. Voice permission is granted the same way:
by the service that mints the call token, checked server-side, never by
a UI toggle the client controls.

## Where the build actually stands today

This document describes what Mingle is and why it's built the way it
is. For a feature-by-feature account of what's actually shipped, what's
mid-build, and what's speced but not yet started, see
[`docs/SPEC.md`](./SPEC.md) — it's kept up to date alongside the code
and is the more accurate source once a feature is in flight.
