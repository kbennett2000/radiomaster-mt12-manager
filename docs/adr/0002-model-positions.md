# ADR 0002: Model positions

- Date: 2026-10-10
- Status: accepted

## Context

The radio keeps its models in a list of 60 numbered places, and its own menus show those numbers. The app has to
show each model's position and let people change it. It has to follow the radio's rules exactly, so that the order
the app shows is the order the radio will show.

## Decisions

1. **Places.** The list has 60 places, numbered 1 to 60. A place holds one model or is empty.
2. **A position is data on the model.** `Model.position` in `src/domain/model.ts` holds it. I never use a model's
   place in an array to mean its position, because that cannot describe an empty place.
3. **Delete** leaves the model's place empty. Nothing else moves.
4. **Move** from place A to place B shifts everything between them one place toward A. Empty places shift with the
   models. This is what the radio's own Move does. Example: with models in 1, 2, 4 and 5, moving the model in 1 to
   place 4 gives models in 1, 3, 4 and 5, and the empty place has gone from 3 to 2.
5. **Copy** puts the copy in the first empty place after the original. If there is none after it, the copy goes
   in the lowest-numbered empty place before it, as if the search wrapped round from 60 to 1.
6. **Undo and Restore** put a model back in its old place if that place is still empty. Otherwise it goes where a
   copy made from that place would go, and the message says which place that is.
7. **Add a model** will use the lowest-numbered empty place.

## How I apply these

- Every rule is a pure function in `src/domain/positions.ts`, with unit tests beside it. The app state calls those
  functions and nothing else decides where a model goes.
- "Your models" lists the places in order. An empty place between two models gets its own row. The empty places
  after the last model are summed up in one line.
- Dragging a row and the Move dialog both end in the same move. The dialog says what is in the target place and
  what else will shift before anything changes.

## Consequences

- A move can carry an empty place along with it. That is the radio's behaviour, so the app shows it rather than
  tidying it away.
- A copy can land far from its original. The confirmation names the position it went to.
- I have not checked these rules on a real radio yet. Two details are my reading of the rule as I was given it:
  "the first empty place before it" in decision 5 meaning the lowest-numbered one, and decision 6 using the same
  search when nothing is empty after the old place. Both live in one function, `firstEmptyAfter`, so either is a
  one-line change.
