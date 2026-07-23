# Frame-vocabulary asks from building the replay viewer

Two gaps found while building frame playback (`get-diced.com` Run It Back replay
viewer, against `schemas/v1/match_record.md` schema_version 1). Both are things a
viewer cannot work around, because the information never reaches the frame.

Neither is urgent, and neither blocks anything already shipped — the viewer plays
back full and observer records today. Both look additive (no `schema_version`
bump under the stated policy).

## 1. A pass produces no frame

`take_turn_action` offers `{"kind":"pass"}` and, when chosen, calls `do_pass`,
which logs only the `bury` of one card from discard — and logs *nothing at all*
when the passing player's discard is empty. The `Decision` event that carries the
pass is dropped from the frame projection (correctly — its `legal` list
enumerates the hand).

So a replay cannot say "the opponent passed." The board simply doesn't change and
the viewer has nothing to show. In live play this is the single most confusing
moment: your turn comes back around with no explanation.

**Ask:** project a chosen `turn_action` whose `chosen.kind == "pass"` into a new
frame action:

```jsonc
{ "type": "pass", "player": "A" }
```

Only the seat is needed. `chosen` for a pass carries no card, so nothing hidden
leaks — this is strictly less information than the `bury` frame that already
follows it when the discard is non-empty.

## 2. A `roll` frame is not the value that decided the roll-off

`Event::Roll` is logged inside `roll_for`, before `offer_switches`,
`offer_roll_boost`, `apply_in_roll_mods` and `offer_rerolls` have run, and
`roll_winner` may be comparing with `lowest_wins()` set. The result is frames
where the seat that took the turn has the visibly lower number and nothing
explains why — e.g. from `srg record decks/bull.yaml decks/fae.yaml --seed 42`:

```
seq 17  roll         A Technique base 6 value 6
seq 18  roll         B Submission base 9 value 9
seq 19  turn_result  winner A  tie_bumps 0
```

A viewer showing "6 … 9 … A takes the turn" looks broken. We currently render a
note saying the numbers aren't necessarily the ones compared, which is honest but
not satisfying — the roll-off is the beat every turn hinges on.

**Ask, in preference order:**

1. Carry the value that entered the comparison on the frame — either by logging
   `Roll` after the modification stages, or by adding a `final` field alongside
   `value` (`value` = as rolled, `final` = as compared). The existing `mods`
   array is the natural home for the post-roll deltas, since it already carries
   `{src, delta}`.
2. Put the comparison direction on `turn_result`, e.g. `"lowest_wins": true`, so
   a viewer can at least say *why* the smaller number won.

(1) alone fixes most cases; (1) and (2) together make the panel fully explicable.

## Not asks

- The `note` action already covers everything a transcriber needs; nothing about
  hand-authoring an observer archive was missing.
- `state as of the action, not after it settles` reads oddly at first for `play`
  (the card shows up in `in_play` a frame later) but is right, and once the
  viewer surfaces the action itself it stops being confusing.
