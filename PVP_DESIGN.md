# Run It Back — Player-vs-Player design note

**Status:** proposal for review · **Author:** drafted with Claude Code, 2026-08-29
**Tracking:** srg_sim todo #141 (epic) → #148 (protocol), #142–147, #149 (push); #80 (native engine, separate)

## Why

We need **real human-vs-human games recorded** so we can inspect them. Two payoffs:

1. **Ground truth for the AI.** Every attempt to strengthen the Run It Back AI stalled
   on the same wall — we have no strong player to validate against. Real 2-human games
   are exactly that signal (how strong players actually build, hold stops, time
   finishes), feeding both a better policy and its validation.
2. **PvP is a headline product feature** on its own.

## What already exists (the pleasant surprise)

The **srg-core engine is already PvP-ready** — no engine work required:

- **Two remote-human seats are first-class and tested.** The seat model is symmetric
  (`Seat::Remote` / `Seat::Local`, per seat, no cap on remotes); `{"A":"remote","B":"remote"}`
  is valid input; `tests/session.rs` exercises both seats parking at every decision.
- **Per-viewer fog-of-war is correct.** Each decision request carries `observable(viewer)`
  — a seat sees its own hand, the opponent as counts only (reveals/peeks handled).
- **Server-authoritative by design.** A session is a *pure function of its snapshot*
  `(seed, decks, seats, decisions[])`; decisions are submitted by idempotent `request_id`
  (safe on reconnect/resend); the doc calls the anti-cheat boundary "reused as the network
  trust boundary."
- **Recording a 2-human match already works.** A finished PvP game is a normal `full`/`site`
  `GameRecord` (seat-based, human/AI-agnostic; frames never leak hidden zones), so **the
  inspection/replay loop is free** the moment a game can be hosted.

## Why a server is required

Run It Back today runs the engine **entirely in the browser** (WASM) vs a **local AI**
(`frontend/src/runitback/engine.js`). Two independent clients **cannot** share hidden
state (deck order, hands) without a trusted referee — either player could cheat. PvP
therefore requires a **server-authoritative session** that holds the hidden state and
adjudicates. The solo human-vs-AI path stays exactly as it is.

## Mobile-readiness (design constraints)

The game will be **embedded in a native mobile app**, so the design is client-agnostic
from the start. The load-bearing insight:

> **A PvP client needs no engine.** The server runs `srg_core`; each client only renders
> `observable_state` and submits an option *index* — both plain JSON. So a web PvP client
> and a native-mobile PvP client are **identical thin protocol clients**. The on-device
> engine (native Rust — the same substrate that ships as WASM for web) is needed **only for
> offline solo vs-AI**.

This splits cleanly and both shells are first-class:

| Mode | Where the engine runs | Client is |
|---|---|---|
| Solo / vs-AI | On-device (WASM web · native mobile), fully offline | Engine host + UI |
| **PvP** | **Server only** | **Thin protocol client (no engine)** |

Constraints this imposes on the server↔client contract:

1. **Client-agnostic, versioned protocol.** REST + (optional) WS + JSON, transport-explicit,
   with the existing engine/schema version stamp negotiated so an old mobile build can't
   silently desync. No browser-only assumptions (no cookies, no DOM, no WASM required to
   *play* PvP).
2. **Async-first, not live-first.** Mobile turns can be minutes or days apart, app
   backgrounded or closed. Model every match as a **durable async session**: the Rust
   service is **snapshot-authoritative** — Postgres is the source of truth, it rehydrates a
   match on demand and keeps only *live* matches hot in memory. "Live" is just the case where
   both players are connected at once. (Cheaper than persistent sockets everywhere, too.)
3. **Push notifications (APNs/FCM) for "your turn."** Required — a web-only design would have
   leaned on an open socket the mobile OS won't keep alive in the background.
4. **Token auth, not cookies.** A FastAPI-issued **signed seat token** (bearer/JWT) serves
   browser and native identically; cookie-sessions don't port to a native app.
5. **Instant resync.** A freshly launched/foregrounded app calls one endpoint to get its
   seat's current `observable_state` + any outstanding decision. Reconnection is safe because
   submit is idempotent on `request_id` and the match restores from its snapshot.

## Architecture — standalone Rust session service (decided)

A new **long-lived Rust service** (`srg-match-server`, its own consumer crate — `srg_core`
must not depend on a consumer) embeds `srg_core` and holds live `Session` objects in memory,
keyed by match id. Each move it snapshots to Postgres for durability (restart/redeploy →
`Session::restore`).

```
  A: web (WASM) OR ─┐   observable(A) + push  ┌─ Postgres
     native mobile  │◄──REST / WS / APNs·FCM─►│   • users, decks   (FastAPI-owned)
  FastAPI (users,   │                         │   • rib_matches    (snapshot = source of truth)
  decks, auth) ─────┼──signed seat token──► srg-match-server (Rust, srg_core)
                    │                         │   • snapshot-authoritative; live matches hot
  B: web OR mobile ─┘   observable(B) + push  └─ rehydrate on demand, persist each move
```

- Clients are **thin and interchangeable** — web and native mobile speak the same protocol;
  neither runs the engine for PvP.
- **FastAPI stays the authority** for users, decks (enrichment via `rib_engine.enrich_deck`),
  and auth. It issues a **signed seat token** (bearer/JWT) the match service trusts — chosen
  over cookie-sessions so native mobile works identically.
- **`srg-match-server` is snapshot-authoritative.** Postgres holds each match's snapshot; the
  service rehydrates on demand and keeps only *live* matches hot in memory. Seed + all hidden
  zones stay server-side; only `observable(seat)` crosses the wire.

### Access & auth model (identity-rooted)

A match is **private to its two players**, and access is rooted in **login identity**, not a
shared per-game secret — so every human move is attributable to a real account (matters for
the ground-truth data and the `actor: human/ai` flag), and a leaked link can't impersonate a
seat.

- **Bindings are the authz truth.** `rib_matches` binds seat A / seat B to two known
  `rib_users`. Your **games list** is just "matches where I'm a seat," derived from your login.
- **Join key = one-time invite, not ongoing access.** The creator generates a key and shares
  it out-of-band; the first logged-in player to redeem it is **bound to seat B**, then the key
  is spent. (Also support **direct invite by account**; keep the key for the "send a link to
  whoever" case.) After binding, neither player uses the key again.
- **Ongoing access = identity vs. seat binding.** Every state read / submit is authorized by
  who you're logged in as against the seat bindings.
- **Service trust handshake.** FastAPI owns identity + bindings; when you open one of your
  games it **mints a short-lived signed seat token** `{user, match, seat, exp}` (because you're
  authed *and* the DB says you own that seat). `srg-match-server` only **verifies the
  signature** and serves `observable(seat)` / accepts that seat's submit — it never parses
  cookies/sessions and needs no user table. Mechanism: **HMAC-signed JWT with a shared secret**
  between the two services (JWKS/asymmetric is the later upgrade). Both services share one
  Postgres (FastAPI: users/decks; match-server: `rib_matches`), so it runs as its own service
  without duplicating auth.

### Two host duties the engine leaves to us (do not skip)

1. **Seat-ownership auth on submit.** The engine no-ops a stale `request_id` but does *not*
   check identity — the service must prove `submit` came from the user bound to the
   outstanding `viewer` seat, so B can't answer A's decision.
2. **Per-seat projection only.** Send each human `observable(their_seat)` — **never** the
   loss-less `full_state`/`debug_state` (it contains all hands, deck order, and the RNG).

## Data model (new)

`rib_matches`: id, **creator/owner**, seat-A user FK, seat-B user FK, seat-A deck, seat-B
deck, current `snapshot` (text), status/whose-turn, seq, **turn-timer config**, **per-turn
deadline**, **visibility** (private default; creator may set public), created/updated, and (on
finish) a link to the saved `GameRecord`. No lobby/matchmaking table yet — a shareable **join
code** is enough for two known humans.

**Turn-timer sweep:** a background job (or lazy check on next access) finds matches past their
per-turn deadline and has the **server AI play the outstanding decision** for the timed-out
seat, tagging that decision `actor: ai` in the frame/record. Reuses the same `Session::submit`
path — the policy just stands in for the human on that one decision.

> Caveat: `GameRecord.decisions` is a single flat human-decision list (a single-player
> ergonomic). A PvP match stores answers **per seat**, so treat the **snapshot** as the source
> of truth for replay, not the flat `decisions` column (`match_record.md:161-163`).

## Lifecycle — correspondence / play-by-email

The whole model is turn-based correspondence (like play-by-email / correspondence chess), not
a live session. It maps 1:1 onto the engine's guarantee that **there is exactly one
outstanding decision at a time, tagged with the seat that owns it** — so "whose turn" is never
tracked separately; it is read off the snapshot.

- **Home screen = your games list.** One indexed query over `rib_matches` for the user,
  bucketed **needs-your-move / waiting-on-opponent / finished**. This is also the badge/push
  source. (Requires an index on the per-seat outstanding-viewer/status.)
- **The loop:** `GET state` → if the outstanding decision is yours, render + `POST` it → the
  POST response returns the new state, which is one of: *another decision for you* (keep
  going), *the opponent's turn now* (you're done — leave), or *game over*. So you never poll
  *within* your own decision run; you only "come back later" once control has passed.
- **A "turn" is several decisions, and reactive ones cross over.** SRG has multi-decision
  turns (Lead → "additional card?" → …) and reactive decisions (a stop) that land during the
  opponent's turn. All of this is transparent: "yours" always just means you own the
  outstanding decision.
- **No connection state.** Every interaction is a stateless GET/POST; a half-played turn
  persists as the outstanding decision. "Reconnection window" is therefore N/A in the baseline
  (it matters only for the optional live/WS layer, which degrades to this pull model).
- **Resign / abandon.** Explicit `POST /match/{id}/resign` → opponent wins, recorded. Ghosting
  is covered by the turn-timer + AI-fill (already decided); after **K consecutive AI-filled
  turns** the absent player is **auto-resigned** so a dead game doesn't limp on (K
  configurable; disabled for untimed games).
- **No GC needed in the baseline.** Timed games self-resolve via timer + AI-fill; untimed
  "friendly" games are cheap rows and may sit indefinitely.

## Move flow (async-first)

1. **Resync / open:** `GET /match/{id}/state` → the caller's own `observable(seat)`,
   whose-turn, `seq`, and any outstanding `request_id`. A freshly launched app calls this
   to catch up; it is the single source a client renders from.
2. **Decide:** when it's your turn, render the decision (Play.jsx already does this) and
   `POST /match/{id}/submit` with the option index + echoed `request_id` (idempotent on
   resend/reconnect).
3. **Adjudicate:** service verifies seat ownership → `Session::submit` → persists the new
   snapshot → notifies the seat that must decide next:
   - **backgrounded / offline:** push notification (APNs/FCM) — the async path;
   - **foregrounded / live:** WS push (or the client's poll picks up the new `seq`).

Because the match is a durable snapshot, step 3's recipient can act seconds or days later on
any device; nothing is lost if either client disconnects between turns.

## Phased milestones (→ todo)

| # | Milestone | Task |
|---|---|---|
| 0 | **Client-agnostic protocol spec** (versioned; web & mobile build against it) | #148 |
| 1 | Standalone Rust match-session service (snapshot-authoritative, hot cache) | #142 |
| 2 | `rib_matches` table + create / join-by-code + seat binding (token auth) | #143 |
| 3 | Per-move endpoints: per-seat state/resync + **seat-authorized** submit | #144 |
| 4 | Persist finished match as `GameRecord` (record all; creator visibility; actor flag) + **inspection loop** (the payoff) | #147 |
| 5 | Turn timers + expiry → **server AI plays the turn** (flagged `actor: ai`) | #151 |
| 6 | Async **push** turn delivery (APNs/FCM) | #149 |
| 7 | Live transport (WebSocket push; polling fallback) | #145 |
| 8 | Client two-human flow — web (React) first; then Kotlin & Swift against the same protocol | #146 |

Milestones 0–4 are the shortest path to a **first recorded, inspectable real game** (drive two
seats over curl before any UI). Do #0 (the protocol) up front so all three clients target one
contract. `srg-match-server` lives in the `srg_sim` repo as a new workspace member (consumer
of `srg_core`). 5–7 make it pleasant across devices. Matchmaking, lobbies, ranked, spectating
are later.

**Mobile embedding, in parallel:** the on-device engine for offline solo/vs-AI — `srg_core`
bound to Kotlin **and** Swift via **uniffi** (one Rust interface, both bindings) — is task
**#80**, a separate workstream from PvP (engine-free on the client), sequenced after the PvP
path is proven.

## Client surfaces (decided)

The game embeds into **existing get-diced apps** — there is already a web client plus **two
native mobile apps**: Android (Kotlin, Gradle) `srg_collection_manager_app` and iOS (Swift,
Xcode) `srg_collection_manager_app_ios`. They are separate native codebases, not a
cross-platform framework, so the PvP client is implemented **three times** (React web, Kotlin,
Swift) — but each is a *thin REST/WS/JSON client with no engine*, so the reimplementation is
shallow and all three target the one protocol spec (#148).

Consequence for sequencing: **mobile PvP needs no native engine binding.** The harder
`srg_core`→native binding (#80, via **uniffi** — one Rust interface generates both Kotlin and
Swift) is only for *offline solo vs-AI* and can come later.

## Resolved

- **Auth:** FastAPI-issued **signed seat token** (bearer/JWT), not cookie-sessions — browser
  and native identical.
- **Transport:** **async-first with push** (APNs/FCM) baseline; WS/poll for live foreground.
- **Session hosting:** **snapshot-authoritative** (Postgres = truth, rehydrate on demand, hot
  cache for live matches) — required for day-apart async turns.
- **Client scope:** PvP clients are **engine-free**; the on-device engine is solo-only.
- **Where the service runs:** a **separate service** alongside the existing get-diced
  frontend/backend.
- **Where the code lives:** the **`srg_sim` repo**, as a new **consumer crate**
  (`srg-match-server`) — the protocol spec ships with it. Converts `srg_sim` to a Cargo
  workspace (`srg-core` lib + `srg` bin + `srg-match-server`); the crate-graph rule holds —
  the service depends on `srg_core`, never the reverse.
- **Turn timers:** **custom, settable per match** (async games carry a per-turn clock). On
  expiry the **server AI plays that turn** (a policy — `heuristic`/`veteran`, later the
  stronger AI — not a bare auto-pass). This is nearly free: the match-server already embeds
  `srg_core` + policies. **AI-filled turns are flagged in the record** so the ground-truth
  human data stays clean (see Recording). This is also where the AI-policy work pays into PvP.
- **Recording:** **record every PvP game.** The **match creator sets visibility** (private by
  default; creator may share publicly). Frames/decisions carry a **per-decision actor flag**
  (`human` vs `ai` for a timer-filled turn).
- **Deck submission:** all surfaces (web + both native apps) submit a deck the service
  **enriches server-side** (`rib_engine.enrich_deck`); the native apps source it from their
  local `srg_cards_mobile.db` build.
- **Push channel:** **FCM (Firebase) for all surfaces.** Android background push requires
  FCM/Firebase regardless (no viable direct path), and the existing Android app has *no* push
  infra to reuse — so once Firebase exists for Android, routing iOS through it too (via the
  uploaded APNs p8 key) gives **one** server-side integration, **uniform per-device tokens**
  (one token type, one send path), and web-push later for free through the same project. Cost:
  the Firebase SDK in the iOS Swift app — the conventional tradeoff. Web stays WS-live +
  email-away for v1. Push is **best-effort over the authoritative resync**: payloads carry
  **no game state** (just match id + "your turn"; the app pulls state), so a missed push only
  means the player sees it on next open.

## Design status

All design questions are **resolved** (engine, protocol shape, service home, identity/auth,
transport, push channel, recording, turn timers, lifecycle, deployment/token-trust). What
remains is **implementation** — starting with the protocol spec (#148), the contract all three
clients and the service build against.

Deferred *product* choices (not blockers): matchmaking/lobby beyond join-by-code, ranked/ELO,
spectating, web-push, and the concrete value of `K` (consecutive AI-fills → auto-resign).
